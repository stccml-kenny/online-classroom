'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';

interface MenuItemProps {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  hasRedDot?: boolean;
  onClick?: () => void;
}

export const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  title,
  badge,
  hasRedDot,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-5 py-3.5 flex items-center justify-between border-b border-gray-150 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0">{icon}</div>
        <span className="text-sm font-bold text-gray-800 truncate">{title}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge && (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-50 text-[#FF6B57] border border-orange-200">
            {badge}
          </span>
        )}
        {hasRedDot && (
          <span className="w-2 h-2 rounded-full bg-[#FF6B57]"></span>
        )}
        <ChevronRight size={16} className="text-gray-400" />
      </div>
    </button>
  );
};
