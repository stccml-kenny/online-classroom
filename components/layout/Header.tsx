import React from 'react';
import { UserProfile, ROLE_CONFIGS } from '@/components/auth/AuthModal';
import { User } from 'lucide-react';

interface HeaderProps {
  title: string;
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  currentUser,
  onOpenAuth,
  onLogout
}) => {
  return (
    <div className="bg-[#FF6B57] text-white pt-4 pb-3 px-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
      <div className="text-xs font-bold tracking-tight bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
        <span>🏫</span>
        <span>Online-Classroom</span>
      </div>

      <h1 className="text-base font-extrabold truncate max-w-[160px] text-center">
        {title}
      </h1>

      {/* 右側：已移除查看帳戶資訊 / 切換身分按鈕，僅未登入時保留登入按鈕 */}
      <div className="min-w-[48px] flex justify-end">
        {!currentUser && onOpenAuth && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="flex items-center gap-1 bg-white text-[#FF6B57] hover:bg-white/90 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs transition-colors"
          >
            <User size={13} />
            <span>登入</span>
          </button>
        )}
      </div>
    </div>
  );
};
