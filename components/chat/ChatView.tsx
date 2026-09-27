'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageCircle,
  Search,
  Send,
  ArrowLeft,
  User,
  GraduationCap,
  Users,
  Shield,
  Clock,
  Check,
  CheckCheck,
  Sparkles,
} from 'lucide-react';
import type { UserProfile, UserRole } from '@/components/auth/AuthModal';
import type { ChatMessage, ChatConversation, ChatContact, MessageType } from '@/types/chat';
import { chatService, makeConversationId } from '@/lib/chatService';

interface ChatViewProps {
  currentUser: UserProfile | null;
  usersList: UserProfile[];
  courses?: any[];
  initialTargetUser?: UserProfile | null;
  onOpenAuth?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  currentUser,
  usersList,
  courses = [],
  initialTargetUser,
  onOpenAuth,
}) => {
  // 對話與聯絡人狀態
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activePartner, setActivePartner] = useState<ChatContact | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // 視圖標籤：'conversations' (進行中對話) 或 'contacts' (可聯絡人)
  const [activeSubTab, setActiveSubTab] = useState<'conversations' | 'contacts'>('conversations');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 滾動至最新訊息
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. 嚴格身分過濾：計算當前使用者可發起私訊的聯絡人名單
  const eligibleContacts = useMemo<ChatContact[]>(() => {
    if (!currentUser) return [];

    const myRole = currentUser.role;
    const myUsername = currentUser.username.toLowerCase();

    // 取得家長的所有子女資料
    const parentChildrenUsernames = new Set(
      (currentUser.childrenUsernames || []).map((u) => u.toLowerCase())
    );

    return usersList
      .filter((u) => {
        const uUsername = u.username.toLowerCase();
        if (uUsername === myUsername) return false; // 排除自己

        // ⭐ 規則 1：學生 只能找 導師、助教、管理員 (嚴格禁止學生找學生、學生找家長)
        if (myRole === 'student') {
          return u.role === 'teacher' || u.role === 'assistant' || u.role === 'admin';
        }

        // ⭐ 規則 2：家長 只能找 導師、助教、管理員 (嚴格禁止家長找家長、家長找其他學生)
        if (myRole === 'parent') {
          return u.role === 'teacher' || u.role === 'assistant' || u.role === 'admin';
        }

        // ⭐ 規則 3：導師 與 助教 可找 學生、家長、同事(導師/助教)、管理員
        if (myRole === 'teacher' || myRole === 'assistant') {
          return true; // 導師可直接聯繫所有學生與家長
        }

        // ⭐ 規則 4：管理員 可找 全員
        if (myRole === 'admin') {
          return true;
        }

        return false;
      })
      .map((u) => {
        // 若為家長，帶上子女名稱方便辨識
        let childrenNames: string[] = [];
        if (u.role === 'parent' && u.childrenUsernames) {
          const cSet = new Set(u.childrenUsernames.map((c) => c.toLowerCase()));
          childrenNames = usersList
            .filter((st) => cSet.has(st.username.toLowerCase()))
            .map((st) => st.name || st.username);
        }

        return {
          username: u.username,
          name: u.name || u.username,
          role: u.role,
          branch: u.branch,
          className: u.className,
          email: u.email,
          childrenNames,
        };
      });
  }, [currentUser, usersList]);

  // 2. 載入對話清單
  const fetchConversations = async () => {
    if (!currentUser) return;
    try {
      const list = await chatService.getConversations(currentUser.username);
      setConversations(list);
    } catch (e) {
      console.warn('載入對話失敗:', e);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [currentUser]);

  // 3. Appwrite Realtime 監聽新訊息
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = chatService.subscribeToNewMessages(currentUser.username, (newMsg) => {
      // 若當前正開啟此對話室，立即追加訊息並標記已讀
      if (activeConversationId && newMsg.conversationId === activeConversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.$id === newMsg.$id)) return prev;
          return [...prev, newMsg];
        });
        chatService.markMessagesAsRead(activeConversationId, currentUser.username);
        setTimeout(() => scrollToBottom('smooth'), 100);
      }

      // 更新對話列表摘要
      fetchConversations();
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser, activeConversationId]);

  // 4. 支援從外部傳入 initialTargetUser 直接開啟對話
  useEffect(() => {
    if (initialTargetUser && currentUser && initialTargetUser.username !== currentUser.username) {
      const targetContact = eligibleContacts.find(
        (c) => c.username.toLowerCase() === initialTargetUser.username.toLowerCase()
      ) || {
        username: initialTargetUser.username,
        name: initialTargetUser.name || initialTargetUser.username,
        role: initialTargetUser.role,
        branch: initialTargetUser.branch,
        className: initialTargetUser.className,
      };
      startChatWithPartner(targetContact);
    }
  }, [initialTargetUser, currentUser, eligibleContacts]);

  // 5. 點擊開啟與對象的對話室
  const startChatWithPartner = async (partner: ChatContact) => {
    if (!currentUser) return;
    setLoading(true);
    setActivePartner(partner);
    const convId = makeConversationId(currentUser.username, partner.username);
    setActiveConversationId(convId);

    try {
      const msgs = await chatService.getMessages(convId);
      setMessages(msgs);
      await chatService.markMessagesAsRead(convId, currentUser.username);
      fetchConversations();
    } catch (e) {
      console.warn('開啟對話室失敗:', e);
    } finally {
      setLoading(false);
      setTimeout(() => scrollToBottom('auto'), 150);
    }
  };

  // 6. 點擊對話清單開啟對話
  const openConversation = (conv: ChatConversation) => {
    if (!currentUser) return;
    const partnerUsername = conv.participants.find(
      (p) => p.toLowerCase() !== currentUser.username.toLowerCase()
    );
    if (!partnerUsername) return;

    // 從 usersList 或 eligibleContacts 找出對方完整資料
    const found = eligibleContacts.find(
      (c) => c.username.toLowerCase() === partnerUsername.toLowerCase()
    ) || {
      username: partnerUsername,
      name:
        conv.participantNames?.[conv.participants.indexOf(partnerUsername)] || partnerUsername,
      role:
        conv.participantRoles?.[conv.participants.indexOf(partnerUsername)] ||
        ('teacher' as UserRole),
      branch: conv.branch,
      className: conv.className,
    };

    startChatWithPartner(found);
  };

  // 7. 發送訊息
  const handleSendMessage = async (customContent?: string, type: MessageType = 'text') => {
    const textToSend = (customContent !== undefined ? customContent : inputText).trim();
    if (!textToSend || !currentUser || !activePartner || !activeConversationId || sending) {
      return;
    }

    setSending(true);
    if (!customContent) {
      setInputText('');
    }

    try {
      const newMsg = await chatService.sendMessage({
        conversationId: activeConversationId,
        sender: currentUser,
        receiver: activePartner,
        content: textToSend,
        type,
        branch: activePartner.branch || currentUser.branch,
        className: activePartner.className || currentUser.className,
      });

      setMessages((prev) => [...prev, newMsg]);
      scrollToBottom('smooth');
      fetchConversations();
    } catch (err) {
      console.error('發送訊息失敗:', err);
    } finally {
      setSending(false);
    }
  };

  // 8. 快捷主題標籤點擊：填入結構化模板
  const handleQuickTopic = (templateText: string) => {
    setInputText(templateText);
  };

  // 依身分與姓名過濾聯絡人
  const filteredContacts = useMemo(() => {
    return eligibleContacts.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        (c.className && c.className.toLowerCase().includes(q)) ||
        (c.branch && c.branch.toLowerCase().includes(q))
      );
    });
  }, [eligibleContacts, searchQuery]);

  // 過濾進行中對話
  const filteredConversations = useMemo(() => {
    if (!currentUser) return [];
    const myLower = currentUser.username.toLowerCase();
    return conversations.filter((conv) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const partnerName =
        conv.participantNames?.find(
          (_, idx) => conv.participants[idx]?.toLowerCase() !== myLower
        ) || '';
      return (
        partnerName.toLowerCase().includes(q) ||
        (conv.lastMessage && conv.lastMessage.toLowerCase().includes(q))
      );
    });
  }, [conversations, currentUser, searchQuery]);

  // 取得對話未讀數
  const getUnreadCount = (conv: ChatConversation): number => {
    if (!currentUser) return 0;
    try {
      const map = JSON.parse(conv.unreadCountMap || '{}');
      return map[currentUser.username.toLowerCase()] || 0;
    } catch {
      return 0;
    }
  };

  // 角色中文與徽章顏色
  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold flex items-center gap-0.5">
            <Shield size={10} /> 管理員
          </span>
        );
      case 'teacher':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold flex items-center gap-0.5">
            <GraduationCap size={10} /> 導師
          </span>
        );
      case 'assistant':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 font-bold flex items-center gap-0.5">
            <Users size={10} /> 助教
          </span>
        );
      case 'parent':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold flex items-center gap-0.5">
            <User size={10} /> 家長
          </span>
        );
      case 'student':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold flex items-center gap-0.5">
            <User size={10} /> 學生
          </span>
        );
    }
  };

  // 若尚未登入，提示登入
  if (!currentUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white h-full">
        <div className="w-16 h-16 rounded-full bg-red-50 text-[#FF6B57] flex items-center justify-center mb-4">
          <MessageCircle size={32} />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">請先登入帳戶</h3>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">
          即時訊息提供學生作業發問、家長請假及學習諮詢通道，請先登入以開啟專屬對話。
        </p>
        {onOpenAuth && (
          <button
            onClick={onOpenAuth}
            className="px-6 py-2.5 bg-[#FF6B57] text-white rounded-xl font-bold hover:bg-[#ff5540] transition-colors shadow-md"
          >
            立即登入
          </button>
        )}
      </div>
    );
  }

  // ============================================================================
  // 子視圖 1：開啟特定聯絡人的聊天室 (Chat Room)
  // ============================================================================
  if (activePartner && activeConversationId) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 h-full overflow-hidden">
        {/* 聊天室頂部資訊列 */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActivePartner(null);
                setActiveConversationId(null);
                fetchConversations();
              }}
              className="p-1.5 -ml-1 text-gray-500 hover:text-gray-800 rounded-full hover:bg-gray-100 transition-colors"
              title="返回清單"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[#FF6B57] to-[#FFA07A] text-white font-bold flex items-center justify-center text-sm shadow-xs">
                {activePartner.name.substring(0, 1)}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-gray-800 text-sm">{activePartner.name}</span>
                {renderRoleBadge(activePartner.role)}
              </div>
              <div className="text-[11px] text-gray-400 flex items-center gap-1">
                {activePartner.branch && <span>{activePartner.branch}</span>}
                {activePartner.className && <span>· {activePartner.className}</span>}
                {activePartner.childrenNames && activePartner.childrenNames.length > 0 && (
                  <span>· ({activePartner.childrenNames.join(', ')} 的家長)</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 快捷諮詢標籤列 (Quick Topic Chips) */}
        <div className="bg-white/80 backdrop-blur-xs border-b border-gray-100 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[11px] text-gray-400 font-medium shrink-0 flex items-center gap-0.5">
            <Sparkles size={12} className="text-amber-500" /> 快捷發送:
          </span>

          {/* 家長快捷鍵 */}
          {currentUser.role === 'parent' && (
            <>
              <button
                type="button"
                onClick={() =>
                  handleQuickTopic(
                    `【請假申請】\n學生姓名：\n請假日期：${new Date().toISOString().split('T')[0]}\n請假事由：病假 / 事假\n備註：`
                  )
                }
                className="text-[11px] px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors whitespace-nowrap font-medium"
              >
                📝 請假申請
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickTopic(
                    `【學習進度諮詢】\n老師好，我想了解孩子最近在課堂上的學習狀況與理解程度，謝謝！`
                  )
                }
                className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors whitespace-nowrap font-medium"
              >
                📊 學習進度
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickTopic(
                    `【日常表現反饋】\n老師好，想向您反饋學生在家的溫習情況：`
                  )
                }
                className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap font-medium"
              >
                💬 日常表現
              </button>
            </>
          )}

          {/* 學生快捷鍵 */}
          {currentUser.role === 'student' && (
            <>
              <button
                type="button"
                onClick={() =>
                  handleQuickTopic(
                    `【作業疑問諮詢】\n老師好，我在做本週功課時遇到了問題：\n題目/單元：\n疑問詳情：`
                  )
                }
                className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap font-medium"
              >
                ❓ 作業疑問發問
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickTopic(
                    `【課堂概念提問】\n老師好，我想請教課堂上講解的內容：`
                  )
                }
                className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 transition-colors whitespace-nowrap font-medium"
              >
                📖 課堂提問
              </button>
            </>
          )}

          {/* 導師/助教快捷鍵 */}
          {(currentUser.role === 'teacher' || currentUser.role === 'assistant') && (
            <>
              <button
                type="button"
                onClick={() =>
                  handleQuickTopic(
                    `【課堂學習進度通知】\n家長/同學您好，這是今日課堂學習進度與表現反饋：`
                  )
                }
                className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors whitespace-nowrap font-medium"
              >
                📢 學習通知
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickTopic(
                    `【作業指導與反饋】\n同學好，已查閱你的作業，以下是個別建議：`
                  )
                }
                className="text-[11px] px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors whitespace-nowrap font-medium"
              >
                💡 作業輔導
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickTopic(`【請假審批確認】\n已收到並批准學生的請假申請，祝早日康復！`)
                }
                className="text-[11px] px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors whitespace-nowrap font-medium"
              >
                ✅ 准假回覆
              </button>
            </>
          )}
        </div>

        {/* 聊天訊息流 */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-xs">
              <Clock className="w-4 h-4 animate-spin mr-1.5" /> 載入歷史對話中...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-gray-400 px-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2">
                <MessageCircle size={24} />
              </div>
              <p className="text-xs font-bold text-gray-600 mb-1">尚無對話記錄</p>
              <p className="text-[11px] text-gray-400 max-w-xs">
                點擊上方快捷標籤或在下方輸入框直接發送訊息，開始與 {activePartner.name} 溝通！
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.senderId.toLowerCase() === currentUser.username.toLowerCase();
              const showDate =
                index === 0 ||
                new Date(msg.timestamp).toDateString() !==
                  new Date(messages[index - 1].timestamp).toDateString();

              return (
                <React.Fragment key={msg.$id || index}>
                  {showDate && (
                    <div className="flex justify-center my-2">
                      <span className="text-[10px] bg-gray-200/80 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                        {new Date(msg.timestamp).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}

                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && (
                      <span className="text-[10px] text-gray-400 font-medium mb-0.5 ml-1">
                        {msg.senderName}
                      </span>
                    )}
                    <div
                      className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl shadow-xs whitespace-pre-wrap break-words text-xs leading-relaxed ${
                        isMe
                          ? 'bg-[#FF6B57] text-white rounded-br-xs'
                          : 'bg-white text-gray-800 border border-gray-100 rounded-bl-xs'
                      } ${
                        msg.type === 'leave_request'
                          ? 'border-l-4 border-l-red-500'
                          : msg.type === 'homework_qa'
                          ? 'border-l-4 border-l-emerald-500'
                          : ''
                      }`}
                    >
                      {msg.content}
                    </div>
                    <div
                      className={`flex items-center gap-1 mt-0.5 text-[9px] text-gray-400 ${
                        isMe ? 'mr-1' : 'ml-1'
                      }`}
                    >
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {isMe && (
                        <span>
                          {msg.isRead ? (
                            <CheckCheck size={12} className="text-blue-500 inline" title="已讀" />
                          ) : (
                            <Check size={12} className="text-gray-400 inline" title="已送達" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 底部輸入工具列 */}
        <div className="bg-white border-t border-gray-200 p-2.5 flex items-end gap-2 shrink-0">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="輸入訊息... (Enter 傳送，Shift+Enter 換行)"
            rows={1}
            className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:ring-1 focus:ring-[#FF6B57] focus:bg-white max-h-24 leading-normal transition-all"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || sending}
            className={`p-2 rounded-xl text-white transition-all shrink-0 ${
              inputText.trim() && !sending
                ? 'bg-[#FF6B57] hover:bg-[#ff5540] shadow-sm'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
            title="發送"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 子視圖 2：對話清單 & 聯絡人首頁
  // ============================================================================
  return (
    <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
      {/* 頂部搜尋與身分說明 */}
      <div className="p-3 border-b border-gray-100 bg-white shrink-0">
        <div className="relative mb-2.5">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋聯絡人、老師、學生或訊息摘要..."
            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-hidden focus:ring-1 focus:ring-[#FF6B57] focus:bg-white transition-all"
          />
        </div>

        {/* 雙分頁標籤 */}
        <div className="flex bg-gray-100 p-0.5 rounded-lg">
          <button
            onClick={() => setActiveSubTab('conversations')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeSubTab === 'conversations'
                ? 'bg-white text-gray-800 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <MessageCircle size={14} /> 進行中對話
            {conversations.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-200 text-gray-600">
                {conversations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('contacts')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeSubTab === 'contacts'
                ? 'bg-white text-gray-800 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Users size={14} /> 可聯絡人 (發起諮詢)
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-200 text-gray-600">
              {filteredContacts.length}
            </span>
          </button>
        </div>
      </div>

      {/* 列表內容區 */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {activeSubTab === 'conversations' ? (
          /* 對話列表 */
          filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <MessageCircle size={32} className="text-gray-300 mb-2" />
              <p className="text-xs font-bold text-gray-600 mb-1">暫無進行中的對話</p>
              <p className="text-[11px] text-gray-400 mb-4 max-w-xs">
                切換到「可聯絡人」分頁，即可直接向老師提問或提交請假諮詢。
              </p>
              <button
                onClick={() => setActiveSubTab('contacts')}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
              >
                尋找聯絡人
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const myLower = currentUser.username.toLowerCase();
              const partnerIdx = conv.participants.findIndex((p) => p.toLowerCase() !== myLower);
              const partnerName = conv.participantNames?.[partnerIdx] || conv.participants[partnerIdx];
              const partnerRole = conv.participantRoles?.[partnerIdx] || ('teacher' as UserRole);
              const unread = getUnreadCount(conv);

              return (
                <div
                  key={conv.conversationId}
                  onClick={() => openConversation(conv)}
                  className="p-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors"
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-linear-to-tr from-slate-600 to-slate-400 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                      {(partnerName || 'U').substring(0, 1)}
                    </div>
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
                        {unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-800 truncate">{partnerName}</span>
                        {renderRoleBadge(partnerRole)}
                      </div>
                      {conv.lastMessageTime && (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {new Date(conv.lastMessageTime).toLocaleDateString([], {
                            month: 'numeric',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] truncate ${
                        unread > 0 ? 'text-gray-900 font-bold' : 'text-gray-500'
                      }`}
                    >
                      {conv.lastMessage || '點擊開啟對話...'}
                    </p>
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* 聯絡人清單 (嚴格依身分過濾) */
          filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">沒有找到相符的聯絡人</div>
          ) : (
            filteredContacts.map((contact) => (
              <div
                key={contact.username}
                onClick={() => startChatWithPartner(contact)}
                className="p-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[#FF6B57] to-[#FFA07A] text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                    {contact.name.substring(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-800">{contact.name}</span>
                      {renderRoleBadge(contact.role)}
                    </div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1">
                      {contact.branch && <span>{contact.branch}</span>}
                      {contact.className && <span>· {contact.className}</span>}
                      {contact.childrenNames && contact.childrenNames.length > 0 && (
                        <span>· ({contact.childrenNames.join(', ')} 的家長)</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-2.5 py-1 text-[11px] bg-red-50 text-[#FF6B57] rounded-lg font-bold hover:bg-red-100 transition-colors"
                >
                  發起訊息
                </button>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};
