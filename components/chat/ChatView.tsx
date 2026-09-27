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
  ChevronDown,
  ChevronRight,
  ListFilter,
  Layers,
  Plus,
  Trash2,
  FolderPlus,
  Tag,
  X,
  GripVertical,
} from 'lucide-react';
import { ROLE_CONFIGS, type UserProfile, type UserRole } from '@/components/auth/AuthModal';
import type { ChatMessage, ChatConversation, ChatContact, MessageType, CustomChatGroup, RoleChatPermissions } from '@/types/chat';
import { chatService, makeConversationId } from '@/lib/chatService';

interface ChatViewProps {
  currentUser: UserProfile | null;
  usersList: UserProfile[];
  courses?: any[];
  initialTargetUser?: UserProfile | null;
  onOpenAuth?: () => void;
  roleChatPermissions?: RoleChatPermissions;
}

// 嚴格訊息去重輔助函數 (解決即時連線與樂觀更新造成的重複渲染)
function dedupeMessages(msgs: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  const seenIds = new Set<string>();

  for (const m of msgs) {
    if (!m) continue;
    // 1. 若已有相同 ID，略過
    if (m.$id && seenIds.has(m.$id)) continue;

    // 2. 檢查是否與已有訊息 (特別是 tempId 暫存訊息) 內容、發言者及時間極為接近
    const duplicateIdx = result.findIndex(
      (existing) =>
        existing.senderId.toLowerCase() === m.senderId.toLowerCase() &&
        existing.content === m.content &&
        Math.abs(new Date(existing.timestamp).getTime() - new Date(m.timestamp).getTime()) < 10000
    );

    if (duplicateIdx !== -1) {
      if (result[duplicateIdx].$id?.startsWith('temp_') && !m.$id?.startsWith('temp_')) {
        result[duplicateIdx] = m;
        if (m.$id) seenIds.add(m.$id);
      }
      continue;
    }

    if (m.$id) seenIds.add(m.$id);
    result.push(m);
  }

  return result;
}

export const ChatView: React.FC<ChatViewProps> = ({
  currentUser,
  usersList,
  courses = [],
  initialTargetUser,
  onOpenAuth,
  roleChatPermissions,
}) => {
  // ⭐ 檢查當前用戶角色之即時訊息是否啟用
  const isMyRoleChatEnabled = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (!roleChatPermissions) return true;
    return !!roleChatPermissions[currentUser.role as keyof RoleChatPermissions];
  }, [currentUser, roleChatPermissions]);
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

  // ⭐ 權限檢查：除學生與家長外，其他身分 (導師、助教、管理員) 可自訂對話分組
  const canManageCustomGroups = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.role === 'teacher' || currentUser.role === 'assistant';
  }, [currentUser]);

  // ⭐ 自訂分組狀態
  const [customGroups, setCustomGroups] = useState<CustomChatGroup[]>([]);
  const [activeFilterId, setActiveFilterId] = useState<string>('all'); // 'all', 'leave', 'parent', 'student', 'teacher', or custom group id
  const [groupViewMode, setGroupViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // 彈窗與互動狀態
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  const [contactToGroupModal, setContactToGroupModal] = useState<ChatContact | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 拖曳狀態 (Drag & Drop)
  const [draggingUsername, setDraggingUsername] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ⭐ 輸入框多於一行時自動延伸，最高延伸至 5 行高度 (約 120px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const nextHeight = Math.min(Math.max(scrollHeight, 38), 120);
      textareaRef.current.style.height = `${nextHeight}px`;
    }
  }, [inputText]);

  // 滾動至最新訊息
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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

        // ⭐ 規則 1：學生 只能找 導師、助教 以及 關聯家長 (不顯示系統管理員，嚴格禁止學生找其他學生或無關家長)
        if (myRole === 'student') {
          if (u.role === 'teacher' || u.role === 'assistant') {
            return true;
          }
          if (u.role === 'parent') {
            const linkedChildren = (u.childrenUsernames || []).map((cu) => cu.trim().toLowerCase());
            const isMyParent =
              linkedChildren.includes(myUsername) ||
              (u.childName && u.childName.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase()) ||
              (u.studentName && u.studentName.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase());
            return !!isMyParent;
          }
          return false;
        }

        // ⭐ 規則 2：家長 只能找 導師、助教 以及 關聯學生 (不顯示系統管理員，嚴格禁止家長找其他無關學生或無關家長)
        if (myRole === 'parent') {
          if (u.role === 'teacher' || u.role === 'assistant') {
            return true;
          }
          if (u.role === 'student') {
            const isMyChild =
              parentChildrenUsernames.has(u.username.toLowerCase()) ||
              (currentUser.childName && u.name && u.name.trim().toLowerCase() === currentUser.childName.trim().toLowerCase()) ||
              (currentUser.studentName && u.name && u.name.trim().toLowerCase() === currentUser.studentName.trim().toLowerCase());
            return !!isMyChild;
          }
          return false;
        }

        // 規則 3：導師 與 助教 可找 學生、家長、同事(導師/助教)、管理員
        if (myRole === 'teacher' || myRole === 'assistant') {
          return true;
        }

        // 規則 4：管理員 可找 全員
        if (myRole === 'admin') {
          return true;
        }

        return false;
      })
      .map((u) => {
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

  // 2. 載入對話清單與自訂分組
  const fetchConversations = async () => {
    if (!currentUser) return;
    try {
      const list = await chatService.getConversations(currentUser.username);
      setConversations(list);
    } catch (e) {
      console.warn('載入對話失敗:', e);
    }
  };

  const fetchCustomGroups = async () => {
    if (!currentUser || !canManageCustomGroups) return;
    try {
      const groups = await chatService.getCustomGroups(currentUser.username);
      setCustomGroups(groups);
    } catch (e) {
      console.warn('載入自訂分組失敗:', e);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchCustomGroups();
  }, [currentUser, canManageCustomGroups]);

  // 3. Appwrite Realtime 監聽新訊息 (防重覆機制)
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = chatService.subscribeToNewMessages(currentUser.username, (newMsg) => {
      if (activeConversationId && newMsg.conversationId === activeConversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.$id === newMsg.$id)) return prev;

          const tempIdx = prev.findIndex(
            (m) =>
              m.$id?.startsWith('temp_') &&
              m.senderId.toLowerCase() === newMsg.senderId.toLowerCase() &&
              m.content === newMsg.content &&
              Math.abs(new Date(m.timestamp).getTime() - new Date(newMsg.timestamp).getTime()) < 15000
          );

          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = newMsg;
            return dedupeMessages(next);
          }

          const isDup = prev.some(
            (m) =>
              m.senderId.toLowerCase() === newMsg.senderId.toLowerCase() &&
              m.content === newMsg.content &&
              Math.abs(new Date(m.timestamp).getTime() - new Date(newMsg.timestamp).getTime()) < 3000
          );
          if (isDup) return prev;

          return dedupeMessages([...prev, newMsg]);
        });

        chatService.markMessagesAsRead(activeConversationId, currentUser.username);
        setTimeout(() => scrollToBottom('smooth'), 100);
      }

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
      setMessages(dedupeMessages(msgs));
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

  // 7. 發送訊息 (防重覆機制：先發送暫存，再嚴格替換或忽略)
  const handleSendMessage = async (customContent?: string, type: MessageType = 'text') => {
    const textToSend = (customContent !== undefined ? customContent : inputText).trim();
    if (!textToSend || !currentUser || !activePartner || !activeConversationId || sending) {
      return;
    }

    setSending(true);
    if (!customContent) {
      setInputText('');
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMsg: ChatMessage = {
      $id: tempId,
      conversationId: activeConversationId,
      senderId: currentUser.username,
      senderName: currentUser.name || currentUser.username,
      senderRole: currentUser.role,
      receiverId: activePartner.username,
      content: textToSend,
      type,
      fileUrl: '',
      fileName: '',
      isRead: false,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => dedupeMessages([...prev, optimisticMsg]));
    scrollToBottom('smooth');

    try {
      const savedMsg = await chatService.sendMessage({
        conversationId: activeConversationId,
        sender: currentUser,
        receiver: activePartner,
        content: textToSend,
        type,
        branch: activePartner.branch || currentUser.branch,
        className: activePartner.className || currentUser.className,
      });

      setMessages((prev) => {
        const hasRealDoc = prev.some((m) => m.$id === savedMsg.$id);
        if (hasRealDoc) {
          return prev.filter((m) => m.$id !== tempId);
        }
        return prev.map((m) => (m.$id === tempId ? savedMsg : m));
      });

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

  // ⭐ 計算每個對話的詳細資訊與所屬自訂分組
  const annotatedConversations = useMemo(() => {
    if (!currentUser) return [];
    const myLower = currentUser.username.toLowerCase();

    return conversations.map((conv) => {
      const partnerIdx = conv.participants.findIndex((p) => p.toLowerCase() !== myLower);
      const partnerUsername = conv.participants[partnerIdx] || '';
      const partnerName = conv.participantNames?.[partnerIdx] || partnerUsername;

      const foundUser = usersList.find((u) => u.username.toLowerCase() === partnerUsername.toLowerCase());
      const partnerRole: UserRole = foundUser?.role || conv.participantRoles?.[partnerIdx] || 'teacher';

      let childrenNames: string[] = [];
      if (partnerRole === 'parent' && foundUser?.childrenUsernames) {
        const cSet = new Set(foundUser.childrenUsernames.map((c) => c.toLowerCase()));
        childrenNames = usersList
          .filter((st) => cSet.has(st.username.toLowerCase()))
          .map((st) => st.name || st.username);
      }

      const isLeave = (conv.lastMessage || '').includes('【請假申請】') || (conv.lastMessage || '').includes('請假');
      const isHomework = (conv.lastMessage || '').includes('【作業') || (conv.lastMessage || '').includes('功課');
      const unread = getUnreadCount(conv);

      // 所屬自訂分組清單
      const assignedGroupIds = customGroups
        .filter((g) => g.memberUsernames.some((u) => u.toLowerCase() === partnerUsername.toLowerCase()))
        .map((g) => g.id);

      return {
        ...conv,
        partnerUsername,
        partnerName,
        partnerRole,
        childrenNames,
        isLeave,
        isHomework,
        unread,
        assignedGroupIds,
      };
    }).filter((conv) => {
      // ⭐ 學生帳戶對話清單嚴格限定：只顯示導師/助教 及 關聯家長 (不顯示系統管理員)
      if (currentUser?.role === 'student') {
        if (conv.partnerRole === 'teacher' || conv.partnerRole === 'assistant') {
          return true;
        }
        if (conv.partnerRole === 'parent') {
          const pUser = usersList.find((u) => u.username.toLowerCase() === conv.partnerUsername.toLowerCase());
          if (pUser) {
            const linked = (pUser.childrenUsernames || []).map((cu) => cu.trim().toLowerCase());
            const isMyParent =
              linked.includes(myLower) ||
              (pUser.childName && pUser.childName.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase()) ||
              (pUser.studentName && pUser.studentName.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase());
            return !!isMyParent;
          }
        }
        return false;
      }

      // ⭐ 家長帳戶對話清單限定：只顯示導師/助教 及 關聯學生 (不顯示系統管理員與無關學生)
      if (currentUser?.role === 'parent') {
        if (conv.partnerRole === 'teacher' || conv.partnerRole === 'assistant') {
          return true;
        }
        if (conv.partnerRole === 'student') {
          const sUser = usersList.find((u) => u.username.toLowerCase() === conv.partnerUsername.toLowerCase());
          if (sUser) {
            const pChildrenSet = new Set((currentUser.childrenUsernames || []).map((cu) => cu.toLowerCase()));
            const isMyChild =
              pChildrenSet.has(sUser.username.toLowerCase()) ||
              (currentUser.childName && sUser.name && sUser.name.trim().toLowerCase() === currentUser.childName.trim().toLowerCase()) ||
              (currentUser.studentName && sUser.name && sUser.name.trim().toLowerCase() === currentUser.studentName.trim().toLowerCase());
            return !!isMyChild;
          }
        }
        return false;
      }

      return true;
    });
  }, [conversations, currentUser, usersList, customGroups]);

  // ⭐ 自訂分組操作函式
  const handleCreateGroup = async () => {
    if (!currentUser || !newGroupNameInput.trim()) return;
    try {
      const updated = await chatService.createCustomGroup(currentUser.username, newGroupNameInput.trim());
      setCustomGroups(updated);
      setNewGroupNameInput('');
      setShowCreateGroupModal(false);
      showToast(`✅ 已成功建立分組「${newGroupNameInput.trim()}」`);
    } catch (e) {
      alert('建立分組失敗，請稍後再試');
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!currentUser) return;
    if (!confirm(`確定要刪除分組「${groupName}」嗎？不會刪除內部成員或對話記錄。`)) return;
    try {
      const updated = await chatService.deleteCustomGroup(currentUser.username, groupId);
      setCustomGroups(updated);
      if (activeFilterId === groupId) {
        setActiveFilterId('all');
      }
      showToast(`🗑️ 已刪除分組「${groupName}」`);
    } catch (e) {
      alert('刪除分組失敗');
    }
  };

  const handleAddMemberToGroup = async (groupId: string, targetUsername: string) => {
    if (!currentUser) return;
    try {
      const targetContact = usersList.find((u) => u.username.toLowerCase() === targetUsername.toLowerCase());
      const targetName = targetContact?.name || targetUsername;
      const targetGroup = customGroups.find((g) => g.id === groupId);

      const updated = await chatService.addMemberToGroup(currentUser.username, groupId, targetUsername);
      setCustomGroups(updated);
      showToast(`✅ 已將 ${targetName} 加入「${targetGroup?.name || '分組'}」`);
    } catch (e) {
      console.warn('加入分組失敗:', e);
    }
  };

  const handleRemoveMemberFromGroup = async (groupId: string, targetUsername: string) => {
    if (!currentUser) return;
    try {
      const targetContact = usersList.find((u) => u.username.toLowerCase() === targetUsername.toLowerCase());
      const targetName = targetContact?.name || targetUsername;
      const targetGroup = customGroups.find((g) => g.id === groupId);

      const updated = await chatService.removeMemberFromGroup(currentUser.username, groupId, targetUsername);
      setCustomGroups(updated);
      showToast(`ℹ️ 已將 ${targetName} 從「${targetGroup?.name || '分組'}」移出`);
    } catch (e) {
      console.warn('移出分組失敗:', e);
    }
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

  // 搜尋過濾後的對話列表
  const searchedConversations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return annotatedConversations;

    return annotatedConversations.filter(
      (c) =>
        c.partnerName.toLowerCase().includes(q) ||
        c.partnerUsername.toLowerCase().includes(q) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q)) ||
        (c.branch && c.branch.toLowerCase().includes(q)) ||
        (c.className && c.className.toLowerCase().includes(q))
    );
  }, [annotatedConversations, searchQuery]);

  // 各分組數量統計
  const groupCounts = useMemo(() => {
    let leave = 0;
    let parent = 0;
    let student = 0;
    let teacher = 0;

    annotatedConversations.forEach((c) => {
      if (c.isLeave) leave++;
      if (c.partnerRole === 'parent') parent++;
      else if (c.partnerRole === 'student') student++;
      else if (c.partnerRole === 'teacher' || c.partnerRole === 'assistant') teacher++;
    });

    // 自訂分組計數
    const customCounts: Record<string, number> = {};
    customGroups.forEach((g) => {
      const mSet = new Set(g.memberUsernames.map((u) => u.toLowerCase()));
      customCounts[g.id] = annotatedConversations.filter((c) => mSet.has(c.partnerUsername.toLowerCase())).length;
    });

    return {
      all: annotatedConversations.length,
      leave,
      parent,
      student,
      teacher,
      customCounts,
    };
  }, [annotatedConversations, customGroups]);

  // 依選取的 filter pill 過濾對話
  const displayedConversations = useMemo(() => {
    if (activeFilterId === 'leave') {
      return searchedConversations.filter((c) => c.isLeave);
    }
    if (activeFilterId === 'parent') {
      return searchedConversations.filter((c) => c.partnerRole === 'parent');
    }
    if (activeFilterId === 'student') {
      return searchedConversations.filter((c) => c.partnerRole === 'student');
    }
    if (activeFilterId === 'teacher') {
      return searchedConversations.filter((c) => c.partnerRole === 'teacher' || c.partnerRole === 'assistant');
    }
    // 自訂分組過濾
    if (activeFilterId.startsWith('grp_')) {
      const grp = customGroups.find((g) => g.id === activeFilterId);
      if (!grp) return searchedConversations;
      const memSet = new Set(grp.memberUsernames.map((u) => u.toLowerCase()));
      return searchedConversations.filter((c) => memSet.has(c.partnerUsername.toLowerCase()));
    }
    return searchedConversations;
  }, [searchedConversations, activeFilterId, customGroups]);

  // ⭐ 樹狀分組對話列表 (包含自訂分組)
  const groupedSections = useMemo(() => {
    const sections: {
      id: string;
      title: string;
      icon: string;
      isCustom?: boolean;
      items: typeof annotatedConversations;
    }[] = [];

    // 1. 自訂分組區塊 (若有)
    if (canManageCustomGroups && customGroups.length > 0) {
      customGroups.forEach((g) => {
        const mSet = new Set(g.memberUsernames.map((u) => u.toLowerCase()));
        const items = searchedConversations.filter((c) => mSet.has(c.partnerUsername.toLowerCase()));
        sections.push({
          id: g.id,
          title: g.name,
          icon: '🏷️',
          isCustom: true,
          items,
        });
      });
    }

    // 2. 請假申請專區
    const leaves = searchedConversations.filter((c) => c.isLeave);
    if (leaves.length > 0) {
      sections.push({
        id: 'leave',
        title: '請假申請專區',
        icon: '📝',
        items: leaves,
      });
    }

    // 3. 系統角色分組
    if (currentUser?.role === 'teacher' || currentUser?.role === 'assistant' || currentUser?.role === 'admin') {
      const parents = searchedConversations.filter((c) => !c.isLeave && c.partnerRole === 'parent');
      if (parents.length > 0) {
        sections.push({
          id: 'parent',
          title: '家長諮詢對話',
          icon: '👨‍👩‍👧',
          items: parents,
        });
      }

      const students = searchedConversations.filter((c) => !c.isLeave && c.partnerRole === 'student');
      if (students.length > 0) {
        sections.push({
          id: 'student',
          title: '學生作業與輔導',
          icon: '🎓',
          items: students,
        });
      }

      const colleagues = searchedConversations.filter(
        (c) => !c.isLeave && (c.partnerRole === 'teacher' || c.partnerRole === 'assistant' || c.partnerRole === 'admin')
      );
      if (colleagues.length > 0) {
        sections.push({
          id: 'colleague',
          title: '導師與行政團隊',
          icon: '👨‍🏫',
          items: colleagues,
        });
      }
    } else {
      const teachers = searchedConversations.filter((c) => {
        if (currentUser?.role === 'student' || currentUser?.role === 'parent') {
          return !c.isLeave && (c.partnerRole === 'teacher' || c.partnerRole === 'assistant');
        }
        return !c.isLeave && (c.partnerRole === 'teacher' || c.partnerRole === 'assistant' || c.partnerRole === 'admin');
      });
      if (teachers.length > 0) {
        sections.push({
          id: 'teacher',
          title: '導師與助教',
          icon: '👨‍🏫',
          items: teachers,
        });
      }

      // ⭐ 學生帳號專屬分組：關聯家長
      if (currentUser?.role === 'student') {
        const parents = searchedConversations.filter((c) => !c.isLeave && c.partnerRole === 'parent');
        if (parents.length > 0) {
          sections.push({
            id: 'parent',
            title: '關聯家長',
            icon: '👨‍👩‍👧',
            items: parents,
          });
        }
      }

      // ⭐ 家長帳號專屬分組：關聯學生 (子女)
      if (currentUser?.role === 'parent') {
        const myChildrenConvs = searchedConversations.filter((c) => !c.isLeave && c.partnerRole === 'student');
        if (myChildrenConvs.length > 0) {
          sections.push({
            id: 'child',
            title: '關聯學生 (子女)',
            icon: '🎓',
            items: myChildrenConvs,
          });
        }
      }
    }

    return sections;
  }, [searchedConversations, currentUser, customGroups, canManageCustomGroups]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // 角色中文與徽章顏色 (動態標註被管理員暫停之角色)
  const renderRoleBadge = (role: UserRole) => {
    const isPaused = roleChatPermissions && role !== 'admin' && !roleChatPermissions[role as keyof RoleChatPermissions];
    const pausedTag = isPaused ? (
      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
        訊息暫停
      </span>
    ) : null;

    switch (role) {
      case 'admin':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold flex items-center gap-0.5">
            <Shield size={10} /> 管理員
          </span>
        );
      case 'teacher':
        return (
          <span className="inline-flex items-center gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold flex items-center gap-0.5">
              <GraduationCap size={10} /> 導師
            </span>
            {pausedTag}
          </span>
        );
      case 'assistant':
        return (
          <span className="inline-flex items-center gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 font-bold flex items-center gap-0.5">
              <Users size={10} /> 助教
            </span>
            {pausedTag}
          </span>
        );
      case 'parent':
        return (
          <span className="inline-flex items-center gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold flex items-center gap-0.5">
              <User size={10} /> 家長
            </span>
            {pausedTag}
          </span>
        );
      case 'student':
        return (
          <span className="inline-flex items-center gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold flex items-center gap-0.5">
              <User size={10} /> 學生
            </span>
            {pausedTag}
          </span>
        );
    }
  };

  // 渲染單張對話卡片 (支援拖曳 Drag & Drop)
  const renderConversationCard = (conv: typeof annotatedConversations[0], currentGroupId?: string) => (
    <div
      key={conv.conversationId}
      draggable={canManageCustomGroups}
      onDragStart={(e) => {
        if (!canManageCustomGroups) return;
        e.dataTransfer.setData('text/plain', conv.partnerUsername);
        setDraggingUsername(conv.partnerUsername);
      }}
      onDragEnd={() => {
        setDraggingUsername(null);
        setDragOverGroupId(null);
      }}
      onClick={() => openConversation(conv)}
      className={`p-3 hover:bg-gray-50 cursor-pointer flex items-center gap-2.5 transition-all border-b border-gray-50 last:border-b-0 ${
        draggingUsername === conv.partnerUsername ? 'opacity-40 scale-98 bg-amber-50/50' : ''
      }`}
    >
      {/* 拖曳握把 (僅支援自訂分組的角色可見) */}
      {canManageCustomGroups && (
        <div
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-0.5 shrink-0"
          title="按住可拖曳此聯絡人至自訂分組"
        >
          <GripVertical size={14} />
        </div>
      )}

      <div className="relative shrink-0">
        <div className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm shadow-xs text-white ${
          conv.isLeave
            ? 'bg-linear-to-tr from-red-500 to-rose-400'
            : conv.partnerRole === 'parent'
            ? 'bg-linear-to-tr from-amber-500 to-orange-400'
            : conv.partnerRole === 'student'
            ? 'bg-linear-to-tr from-emerald-500 to-teal-400'
            : 'bg-linear-to-tr from-blue-600 to-indigo-400'
        }`}>
          {(conv.partnerName || 'U').substring(0, 1)}
        </div>
        {conv.unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
            {conv.unread}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-gray-800 truncate">{conv.partnerName}</span>
            {renderRoleBadge(conv.partnerRole)}
            {conv.isLeave && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 font-extrabold border border-red-200">
                📝 請假
              </span>
            )}
            {conv.isHomework && !conv.isLeave && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 font-extrabold border border-emerald-200">
                ❓ 作業
              </span>
            )}
          </div>
          {conv.lastMessageTime && (
            <span className="text-[10px] text-gray-400 shrink-0 ml-1">
              {new Date(conv.lastMessageTime).toLocaleDateString([], {
                month: 'numeric',
                day: 'numeric',
              })}
            </span>
          )}
        </div>

        {conv.childrenNames && conv.childrenNames.length > 0 && (
          <div className="text-[10px] text-amber-700/80 mb-0.5 truncate">
            子女: {conv.childrenNames.join(', ')}
            {conv.className && ` · ${conv.className}`}
          </div>
        )}

        <p
          className={`text-[11px] truncate ${
            conv.unread > 0 ? 'text-gray-900 font-bold' : 'text-gray-500'
          }`}
        >
          {conv.lastMessage || '點擊開啟對話...'}
        </p>
      </div>

      {/* 若在自訂分組內，顯示移出按鈕 */}
      {currentGroupId && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveMemberFromGroup(currentGroupId, conv.partnerUsername);
          }}
          className="text-[10px] text-gray-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors shrink-0"
          title="從本分組中移出"
        >
          移出
        </button>
      )}
    </div>
  );

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

  // ⭐ 需求：依系統管理員設定，若當前角色之即時訊息功能被暫停，則顯示暫停提示卡片
  if (currentUser && !isMyRoleChatEnabled) {
    const roleLabel = ROLE_CONFIGS[currentUser.role]?.label || currentUser.role;
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white h-full">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 border border-amber-200 flex items-center justify-center mb-4 shadow-xs">
          <MessageCircle size={32} />
        </div>
        <h3 className="text-base font-extrabold text-gray-800 mb-2">即時訊息功能暫停開放</h3>
        <p className="text-xs text-gray-500 mb-6 max-w-xs leading-relaxed">
          目前【{roleLabel}】帳戶之即時訊息功能已由系統管理員暫停開放。如有課程、請假或行政查詢，請透過校方電話或官方途徑聯繫，敬請見諒。
        </p>
      </div>
    );
  }

  // ============================================================================
  // 子視圖 1：開啟特定聯絡人的聊天室 (Chat Room)
  // ============================================================================
  if (activePartner && activeConversationId) {
    const uniqueMessages = dedupeMessages(messages);

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

        {/* ⭐ 若對方角色之即時訊息功能被管理員暫停，提示警告標籤 */}
        {roleChatPermissions &&
          activePartner.role !== 'admin' &&
          !roleChatPermissions[activePartner.role as keyof RoleChatPermissions] && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs text-amber-900 font-bold shrink-0">
              <span className="shrink-0 text-amber-600">⚠️</span>
              <span>
                注意：此用戶為【{ROLE_CONFIGS[activePartner.role]?.label || activePartner.role}】帳戶，該角色之即時訊息功能目前已由管理員暫停開放，發送訊息對方將無法登入查閱。
              </span>
            </div>
          )}

        {/* 快捷諮詢標籤列 (Quick Topic Chips) */}
        <div className="bg-white/80 backdrop-blur-xs border-b border-gray-100 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[11px] text-gray-400 font-medium shrink-0 flex items-center gap-0.5">
            <Sparkles size={12} className="text-amber-500" /> 快捷發送:
          </span>

          {currentUser.role === 'parent' && (
            activePartner.role === 'student' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleQuickTopic(`【溫習提醒】\n孩子好，今天課堂學習順利嗎？記得認真完成功課喔！`)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap font-medium"
                >
                  📖 溫習叮嚀
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickTopic(`【放學提醒】\n放學路上注意安全，回家小心！`)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors whitespace-nowrap font-medium"
                >
                  ⏰ 注意安全
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickTopic(`學習加油，爸媽為你打氣！`)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap font-medium"
                >
                  ❤️ 為你加油
                </button>
              </>
            ) : (
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
                    handleQuickTopic(`【學習進度諮詢】\n老師好，我想了解孩子最近在課堂上的學習狀況與理解程度，謝謝！`)
                  }
                  className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors whitespace-nowrap font-medium"
                >
                  📊 學習進度
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickTopic(`【日常表現反饋】\n老師好，想向您反饋學生在家的溫習情況：`)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap font-medium"
                >
                  💬 日常表現
                </button>
              </>
            )
          )}

          {currentUser.role === 'student' && (
            activePartner.role === 'parent' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleQuickTopic(`【今日作業已完成】\n爸爸/媽媽好，我已經完成今日課堂功課，請查閱！`)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap font-medium"
                >
                  🏠 作業已完成
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickTopic(`【放學通知】\n爸爸/媽媽好，今日課堂已經放學，我現在準備回家！`)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors whitespace-nowrap font-medium"
                >
                  ⏰ 課堂已放學
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickTopic(`爸爸/媽媽好，我想向您說：`)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap font-medium"
                >
                  💬 留訊息
                </button>
              </>
            ) : (
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
                  onClick={() => handleQuickTopic(`【課堂概念提問】\n老師好，我想請教課堂上講解的內容：`)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 transition-colors whitespace-nowrap font-medium"
                >
                  📖 課堂提問
                </button>
              </>
            )
          )}

          {(currentUser.role === 'teacher' || currentUser.role === 'assistant') && (
            <>
              <button
                type="button"
                onClick={() =>
                  handleQuickTopic(`【課堂學習進度通知】\n家長/同學您好，這是今日課堂學習進度與表現反饋：`)
                }
                className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors whitespace-nowrap font-medium"
              >
                📢 學習通知
              </button>
              <button
                type="button"
                onClick={() => handleQuickTopic(`【作業指導與反饋】\n同學好，已查閱你的作業，以下是個別建議：`)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors whitespace-nowrap font-medium"
              >
                💡 作業輔導
              </button>
              <button
                type="button"
                onClick={() => handleQuickTopic(`【請假審批確認】\n已收到並批准學生的請假申請，祝早日康復！`)}
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
          ) : uniqueMessages.length === 0 ? (
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
            uniqueMessages.map((msg, index) => {
              const isMe = msg.senderId.toLowerCase() === currentUser.username.toLowerCase();
              const showDate =
                index === 0 ||
                new Date(msg.timestamp).toDateString() !==
                  new Date(uniqueMessages[index - 1].timestamp).toDateString();

              return (
                <React.Fragment key={msg.$id || `msg_${index}`}>
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
            ref={textareaRef}
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
            style={{ minHeight: '38px', maxHeight: '120px' }}
            className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#FF6B57] focus:bg-white overflow-y-auto leading-relaxed transition-all"
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
  // 子視圖 2：對話清單 (支援自訂分組 & 拖曳歸類) & 聯絡人首頁
  // ============================================================================
  return (
    <div className="flex-1 flex flex-col bg-white h-full overflow-hidden relative">
      {/* 頂部操作反饋 Toast */}
      {toastMessage && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
          {toastMessage}
        </div>
      )}

      {/* 拖曳中的視覺引導提示條 */}
      {draggingUsername && (
        <div className="bg-amber-500 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-between shadow-xs z-30 animate-pulse">
          <span>👆 請拖放至上方的「分組標籤」或下方「分組區塊」放開即可歸類</span>
          <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded">正在拖曳: {draggingUsername}</span>
        </div>
      )}

      {/* 頂部搜尋與分頁 */}
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
        <div className="flex bg-gray-100 p-0.5 rounded-lg mb-2">
          <button
            onClick={() => setActiveSubTab('conversations')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 relative ${
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
            {/* ⭐ 未讀訊息圓點提示 */}
            {annotatedConversations.some((c) => c.unread > 0) && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-0.5 shadow-2xs" title="有未讀訊息" />
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

        {/* ⭐ 對話分組過濾標籤列 (含拖曳目標支援) */}
        {activeSubTab === 'conversations' && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 flex-1 mr-2">
              {/* 全部 */}
              <button
                onClick={() => setActiveFilterId('all')}
                className={`text-[11px] px-2 py-0.8 rounded-full font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                  activeFilterId === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                全部 ({groupCounts.all})
              </button>

              {/* 請假專區 */}
              {groupCounts.leave > 0 && (
                <button
                  onClick={() => setActiveFilterId('leave')}
                  className={`text-[11px] px-2 py-0.8 rounded-full font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                    activeFilterId === 'leave'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                  }`}
                >
                  📝 請假 ({groupCounts.leave})
                </button>
              )}

              {/* ⭐ 導師、助教、管理員的自訂分組標籤 (可作為拖曳放置目標) */}
              {canManageCustomGroups &&
                customGroups.map((grp) => {
                  const cnt = groupCounts.customCounts[grp.id] || 0;
                  const isDragTarget = dragOverGroupId === grp.id;

                  return (
                    <div
                      key={grp.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                        setDragOverGroupId(grp.id);
                      }}
                      onDragLeave={() => setDragOverGroupId(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        const tUser = e.dataTransfer.getData('text/plain') || draggingUsername;
                        if (tUser) {
                          handleAddMemberToGroup(grp.id, tUser);
                        }
                        setDragOverGroupId(null);
                        setDraggingUsername(null);
                      }}
                      className={`relative shrink-0 rounded-full transition-all ${
                        isDragTarget ? 'ring-2 ring-amber-500 scale-105' : ''
                      }`}
                    >
                      <button
                        onClick={() => setActiveFilterId(grp.id)}
                        className={`text-[11px] px-2.5 py-0.8 rounded-full font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                          activeFilterId === grp.id
                            ? 'bg-amber-600 text-white shadow-xs'
                            : isDragTarget
                            ? 'bg-amber-100 text-amber-900 border border-amber-400 font-extrabold'
                            : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                        }`}
                      >
                        <Tag size={10} />
                        {grp.name} ({cnt})
                      </button>
                    </div>
                  );
                })}

              {/* 系統角色分組 */}
              {(currentUser?.role === 'teacher' || currentUser?.role === 'assistant' || currentUser?.role === 'admin') && (
                <>
                  {groupCounts.parent > 0 && (
                    <button
                      onClick={() => setActiveFilterId('parent')}
                      className={`text-[11px] px-2 py-0.8 rounded-full font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                        activeFilterId === 'parent'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                      }`}
                    >
                      👨‍👩‍👧 家長 ({groupCounts.parent})
                    </button>
                  )}

                  {groupCounts.student > 0 && (
                    <button
                      onClick={() => setActiveFilterId('student')}
                      className={`text-[11px] px-2 py-0.8 rounded-full font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                        activeFilterId === 'student'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      🎓 學生 ({groupCounts.student})
                    </button>
                  )}

                  {groupCounts.teacher > 0 && (
                    <button
                      onClick={() => setActiveFilterId('teacher')}
                      className={`text-[11px] px-2 py-0.8 rounded-full font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                        activeFilterId === 'teacher'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                      }`}
                    >
                      👨‍🏫 導師 ({groupCounts.teacher})
                    </button>
                  )}
                </>
              )}

              {(currentUser?.role === 'parent' || currentUser?.role === 'student') && groupCounts.teacher > 0 && (
                <button
                  onClick={() => setActiveFilterId('teacher')}
                  className={`text-[11px] px-2 py-0.8 rounded-full font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                    activeFilterId === 'teacher'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                  }`}
                >
                  👨‍🏫 導師與助教 ({groupCounts.teacher})
                </button>
              )}

              {currentUser?.role === 'student' && groupCounts.parent > 0 && (
                <button
                  onClick={() => setActiveFilterId('parent')}
                  className={`text-[11px] px-2 py-0.8 rounded-full font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                    activeFilterId === 'parent'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  👨‍👩‍👧 關聯家長 ({groupCounts.parent})
                </button>
              )}

              {currentUser?.role === 'parent' && groupCounts.student > 0 && (
                <button
                  onClick={() => setActiveFilterId('student')}
                  className={`text-[11px] px-2 py-0.8 rounded-full font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                    activeFilterId === 'student'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  🎓 關聯學生 ({groupCounts.student})
                </button>
              )}

              {/* ⭐ 新增自訂分組按鈕 (僅非學生/家長可見) */}
              {canManageCustomGroups && (
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  className="text-[11px] px-2 py-0.8 rounded-full font-bold whitespace-nowrap bg-gray-50 text-gray-600 hover:bg-gray-100 border border-dashed border-gray-300 flex items-center gap-0.5 shrink-0"
                  title="建立新的對話分組"
                >
                  <Plus size={11} /> 新增分組
                </button>
              )}
            </div>

            {/* 分組模式切換 (折疊區塊 vs 時間排序) */}
            {activeFilterId === 'all' && (
              <button
                onClick={() => setGroupViewMode(groupViewMode === 'grouped' ? 'flat' : 'grouped')}
                className="text-[10px] text-gray-500 hover:text-gray-800 p-1 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-0.5 shrink-0"
                title={groupViewMode === 'grouped' ? '切換為平鋪排序' : '切換為依類別分組'}
              >
                {groupViewMode === 'grouped' ? <Layers size={13} className="text-[#FF6B57]" /> : <ListFilter size={13} />}
                <span className="hidden sm:inline">{groupViewMode === 'grouped' ? '分組中' : '平鋪'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 列表內容區 */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {activeSubTab === 'conversations' ? (
          /* 對話列表 */
          searchedConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <MessageCircle size={32} className="text-gray-300 mb-2" />
              <p className="text-xs font-bold text-gray-600 mb-1">
                {activeFilterId !== 'all' ? '該分類下暫無對話' : '暫無進行中的對話'}
              </p>
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
          ) : activeFilterId === 'all' && groupViewMode === 'grouped' ? (
            /* ⭐ 類別折疊分組視圖 (支援拖曳至自訂分組標題) */
            <div className="divide-y divide-gray-100">
              {groupedSections.map((sec) => {
                const isCollapsed = !!collapsedSections[sec.id];
                const secUnread = sec.items.reduce((acc, cur) => acc + cur.unread, 0);
                const isDropTarget = dragOverGroupId === sec.id;

                return (
                  <div
                    key={sec.id}
                    onDragOver={(e) => {
                      if (sec.isCustom) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                        setDragOverGroupId(sec.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (sec.isCustom) setDragOverGroupId(null);
                    }}
                    onDrop={(e) => {
                      if (sec.isCustom) {
                        e.preventDefault();
                        const tUser = e.dataTransfer.getData('text/plain') || draggingUsername;
                        if (tUser) {
                          handleAddMemberToGroup(sec.id, tUser);
                        }
                        setDragOverGroupId(null);
                        setDraggingUsername(null);
                      }
                    }}
                    className={`bg-white transition-colors ${
                      isDropTarget ? 'bg-amber-50 ring-2 ring-amber-400' : ''
                    }`}
                  >
                    {/* 分組區塊標題欄 */}
                    <div
                      onClick={() => toggleSection(sec.id)}
                      className="px-3 py-2 bg-gray-50/80 hover:bg-gray-100/80 cursor-pointer flex items-center justify-between transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{sec.icon}</span>
                        <span className="text-xs font-bold text-gray-700">{sec.title}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white border border-gray-200 text-gray-600 font-bold">
                          {sec.items.length}
                        </span>
                        {secUnread > 0 && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-red-500 text-white font-extrabold animate-pulse">
                            {secUnread} 則未讀
                          </span>
                        )}
                        {sec.isCustom && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-medium">
                            自訂分組
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {sec.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGroup(sec.id, sec.title);
                            }}
                            className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-gray-200"
                            title="刪除此分組"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        <div className="text-gray-400">
                          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                    </div>

                    {/* 分組對話卡片清單 */}
                    {!isCollapsed && (
                      <div className="divide-y divide-gray-50">
                        {sec.items.length === 0 ? (
                          <div className="p-3 text-center text-gray-400 text-[11px]">
                            {sec.isCustom ? '尚未加入聯絡人，可直接從下方聯絡人或對話拖曳至此' : '暫無對話'}
                          </div>
                        ) : (
                          sec.items.map((conv) => renderConversationCard(conv, sec.isCustom ? sec.id : undefined))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ⭐ 平鋪時間排序視圖 (或特定自訂分組單獨檢視) */
            <div>
              {/* 若目前正在檢視特定的自訂分組，顯示管理控制列 */}
              {activeFilterId.startsWith('grp_') && (
                <div className="bg-amber-50/70 border-b border-amber-200/60 p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-amber-900 font-bold">
                    <Tag size={14} className="text-amber-600" />
                    <span>分組：{customGroups.find((g) => g.id === activeFilterId)?.name}</span>
                    <span className="text-[10px] text-amber-700 font-normal">
                      ({displayedConversations.length} 位成員)
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const g = customGroups.find((item) => item.id === activeFilterId);
                      if (g) handleDeleteGroup(g.id, g.name);
                    }}
                    className="text-[10px] text-red-600 hover:text-red-800 font-bold px-2 py-0.5 rounded hover:bg-red-50"
                  >
                    刪除此分組
                  </button>
                </div>
              )}

              <div className="divide-y divide-gray-50">
                {displayedConversations.map((conv) =>
                  renderConversationCard(conv, activeFilterId.startsWith('grp_') ? activeFilterId : undefined)
                )}
              </div>
            </div>
          )
        ) : (
          /* ============================================================ */
          /* 聯絡人清單 (支援直接添加至分組 + 拖曳) */
          /* ============================================================ */
          filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">沒有找到相符的聯絡人</div>
          ) : (
            filteredContacts.map((contact) => (
              <div
                key={contact.username}
                draggable={canManageCustomGroups}
                onDragStart={(e) => {
                  if (!canManageCustomGroups) return;
                  e.dataTransfer.setData('text/plain', contact.username);
                  setDraggingUsername(contact.username);
                }}
                onDragEnd={() => {
                  setDraggingUsername(null);
                  setDragOverGroupId(null);
                }}
                className={`p-3 hover:bg-gray-50 flex items-center justify-between transition-colors border-b border-gray-50 last:border-b-0 ${
                  draggingUsername === contact.username ? 'opacity-40 bg-amber-50/50' : ''
                }`}
              >
                <div
                  onClick={() => startChatWithPartner(contact)}
                  className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                >
                  {/* 拖曳手柄 */}
                  {canManageCustomGroups && (
                    <div
                      className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-0.5 shrink-0"
                      title="按住可拖曳此聯絡人至自訂分組"
                    >
                      <GripVertical size={14} />
                    </div>
                  )}

                  <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[#FF6B57] to-[#FFA07A] text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                    {contact.name.substring(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-gray-800 truncate">{contact.name}</span>
                      {renderRoleBadge(contact.role)}
                    </div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1 truncate">
                      {contact.branch && <span>{contact.branch}</span>}
                      {contact.className && <span>· {contact.className}</span>}
                      {contact.childrenNames && contact.childrenNames.length > 0 && (
                        <span>· ({contact.childrenNames.join(', ')} 的家長)</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 右側操作按鈕區 */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* ⭐ 導師/助教/管理員專屬：直接加入分組按鈕 */}
                  {canManageCustomGroups && (
                    <button
                      type="button"
                      onClick={() => setContactToGroupModal(contact)}
                      className="px-2 py-1 text-[11px] bg-amber-50 text-amber-800 rounded-lg font-bold hover:bg-amber-100 transition-colors flex items-center gap-0.5 border border-amber-200/80"
                      title="將此聯絡人加入自訂分組"
                    >
                      <FolderPlus size={12} /> 加入分組
                    </button>
                  )}

                  {/* 發起訊息 */}
                  <button
                    type="button"
                    onClick={() => startChatWithPartner(contact)}
                    className="px-2.5 py-1 text-[11px] bg-red-50 text-[#FF6B57] rounded-lg font-bold hover:bg-red-100 transition-colors"
                  >
                    發起訊息
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* ============================================================ */}
      {/* 彈窗 1：新增自訂分組 Modal */}
      {/* ============================================================ */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 font-bold text-gray-800 text-sm">
                <Tag size={16} className="text-[#FF6B57]" /> 新增對話自訂分組
              </div>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">
              建立自訂分組後，可直接拖曳對話或聯絡人進群組集中管理。
            </p>
            <input
              type="text"
              value={newGroupNameInput}
              onChange={(e) => setNewGroupNameInput(e.target.value)}
              placeholder="例：3A班重點跟進、升學輔導..."
              className="w-full px-3 py-2.5 text-xs text-gray-900 font-bold bg-white border border-gray-300 rounded-lg mb-3 focus:outline-hidden focus:ring-2 focus:ring-[#FF6B57] focus:text-gray-950 placeholder:text-gray-400 shadow-2xs transition-all"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={!newGroupNameInput.trim()}
                className="px-4 py-1.5 text-xs bg-[#FF6B57] text-white font-bold rounded-lg hover:bg-[#ff5540] disabled:bg-gray-300 transition-colors"
              >
                確認建立
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 彈窗 2：將聯絡人加入分組 Modal */}
      {/* ============================================================ */}
      {contactToGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 font-bold text-gray-800 text-sm">
                <FolderPlus size={16} className="text-amber-600" /> 加入對話分組
              </div>
              <button
                onClick={() => setContactToGroupModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] text-gray-600 mb-3">
              選擇要將 <strong className="text-gray-900">{contactToGroupModal.name}</strong> 歸入的分組：
            </p>

            <div className="space-y-1.5 max-h-48 overflow-y-auto mb-3">
              {customGroups.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400">
                  尚無自訂分組，請先建立新分組
                </div>
              ) : (
                customGroups.map((grp) => {
                  const isMember = grp.memberUsernames.some(
                    (u) => u.toLowerCase() === contactToGroupModal.username.toLowerCase()
                  );

                  return (
                    <div
                      key={grp.id}
                      onClick={() => {
                        if (isMember) {
                          handleRemoveMemberFromGroup(grp.id, contactToGroupModal.username);
                        } else {
                          handleAddMemberToGroup(grp.id, contactToGroupModal.username);
                        }
                      }}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isMember
                          ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Tag size={12} className={isMember ? 'text-amber-600' : 'text-gray-400'} />
                        <span>{grp.name}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        isMember ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {isMember ? '✓ 已在分組 (點擊移除)' : '＋ 加入'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowCreateGroupModal(true);
                }}
                className="text-[11px] text-[#FF6B57] font-bold hover:underline flex items-center gap-0.5"
              >
                <Plus size={12} /> 建立新分組
              </button>
              <button
                type="button"
                onClick={() => setContactToGroupModal(null)}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
