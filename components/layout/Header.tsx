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

      {/* 右側登入狀態與角色徽章 */}
      <div>
        {currentUser ? (
          <button
            type="button"
            onClick={onOpenAuth}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 backdrop-blur-xs px-2 py-1 rounded-full text-xs font-bold transition-colors"
            title="查看帳戶資訊 / 切換身分"
          >
            <span>{ROLE_CONFIGS[currentUser.role]?.emoji || '👤'}</span>
            <span className="truncate max-w-[65px]">{currentUser.name}</span>
          </button>
        ) : (
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
