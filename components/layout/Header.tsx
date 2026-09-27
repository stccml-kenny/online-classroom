import React from 'react';
import { MessageCircle } from 'lucide-react';
import { UserProfile } from '@/components/auth/AuthModal';

interface HeaderProps {
  title: string;
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onOpenChat?: () => void;
  unreadChatCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenChat,
  unreadChatCount = 0,
}) => {
  return (
    <div className="bg-[#FF6B57] text-white pt-4 pb-3 px-4 flex justify-between items-center sticky top-0 z-20 shadow-xs">
      {/* 左側排版佔位 */}
      <div className="w-8 shrink-0" />

      {/* 頂部標題居中顯示 */}
      <h1 className="text-base font-extrabold truncate max-w-[240px] text-center flex-1">
        {title}
      </h1>

      {/* 右側按鈕：即時訊息快速入口與未讀紅點 */}
      <div className="w-8 shrink-0 flex items-center justify-end">
        {onOpenChat && (
          <button
            onClick={onOpenChat}
            className="relative p-1 text-white hover:text-white/80 transition-colors"
            title="即時訊息"
          >
            <MessageCircle size={20} />
            {unreadChatCount > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75"></span>
                <span className="relative inline-flex items-center justify-center px-1 min-w-[14px] h-[14px] bg-yellow-400 text-slate-900 text-[8px] font-black rounded-full border border-white shadow-xs">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              </span>
            ) : null}
          </button>
        )}
      </div>
    </div>
  );
};
