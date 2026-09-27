import React from 'react';
import { UserProfile } from '@/components/auth/AuthModal';

interface HeaderProps {
  title: string;
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
}) => {
  return (
    <div className="bg-[#FF6B57] text-white pt-4 pb-3 px-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
      {/* 左側排版佔位 */}
      <div className="w-6 shrink-0" />

      {/* 頂部標題居中顯示 */}
      <h1 className="text-base font-extrabold truncate max-w-[240px] text-center flex-1">
        {title}
      </h1>

      {/* 右側排版佔位 */}
      <div className="w-6 shrink-0" />
    </div>
  );
};
