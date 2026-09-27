'use client';

import React from 'react';
import { X, MessageCircle } from 'lucide-react';
import type { UserProfile } from '@/components/auth/AuthModal';
import { ChatView } from './ChatView';

interface DirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  usersList: UserProfile[];
  courses?: any[];
  initialTargetUser?: UserProfile | null;
  onOpenAuth?: () => void;
}

export const DirectMessageModal: React.FC<DirectMessageModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  usersList,
  courses = [],
  initialTargetUser,
  onOpenAuth,
}) => {
  if (!isOpen) return null;

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
          <ChatView
            currentUser={currentUser}
            usersList={usersList}
            courses={courses}
            initialTargetUser={initialTargetUser}
            onOpenAuth={onOpenAuth}
          />
        </div>
      </div>
    </div>
  );
};
