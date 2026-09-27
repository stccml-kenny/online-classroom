'use client';

import React from 'react';
import { X, MessageCircle } from 'lucide-react';
import type { UserProfile } from '@/components/auth/AuthModal';
import type { RoleChatPermissions } from '@/types/chat';
import { ChatView } from './ChatView';

interface DirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  usersList: UserProfile[];
  courses?: any[];
  initialTargetUser?: UserProfile | null;
  onOpenAuth?: () => void;
  roleChatPermissions?: RoleChatPermissions;
}

export const DirectMessageModal: React.FC<DirectMessageModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  usersList,
  courses = [],
  initialTargetUser,
  onOpenAuth,
  roleChatPermissions,
}) => {
  if (!isOpen) return null;

  const isCurrentUserChatEnabled = !currentUser
    ? false
    : currentUser.role === 'admin'
    ? true
    : !roleChatPermissions
    ? true
    : !!roleChatPermissions[currentUser.role as keyof RoleChatPermissions];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-[90vh] max-h-[720px] flex flex-col overflow-hidden relative border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* 頂部標題與關閉按鈕 */}
        <div className="bg-[#FF6B57] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} />
            <h2 className="text-sm font-extrabold tracking-wide">即時訊息 · 一對一諮詢</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors text-white"
            title="關閉"
          >
            <X size={18} />
          </button>
        </div>

        {/* 核心內容區直接掛載獨立 ChatView */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!isCurrentUserChatEnabled ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white min-h-[50vh]">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mb-4 border border-amber-200 shadow-xs">
                <MessageCircle size={32} />
              </div>
              <h3 className="text-base font-extrabold text-gray-800 mb-2">即時訊息功能暫停開放</h3>
              <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-6">
                目前【{currentUser ? currentUser.role : '此'}】帳戶之即時訊息功能已由系統管理員暫停開放。如有課程、請假或行政查詢，請透過校方電話或官方途徑聯絡，敬請見諒。
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-[#FF6B57] text-white text-xs font-bold rounded-xl shadow-xs hover:opacity-95 transition-all"
              >
                關閉視窗
              </button>
            </div>
          ) : (
            <ChatView
              currentUser={currentUser}
              usersList={usersList}
              courses={courses}
              initialTargetUser={initialTargetUser}
              onOpenAuth={onOpenAuth}
              roleChatPermissions={roleChatPermissions}
            />
          )}
        </div>
      </div>
    </div>
  );
};
