import React from 'react';
import { ChevronRight } from 'lucide-react';

interface MenuItemProps {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  hasRedDot?: boolean;
  onClick?: () => void;
}

export const MenuItem: React.FC<MenuItemProps> = ({ icon, title, badge, hasRedDot, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 active:bg-gray-50 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="w-6 flex justify-center">{icon}</div>
        <span className="text-[16px] text-gray-800 font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span className="bg-[#FF6B57] text-white text-xs px-2 py-0.5 rounded-full font-bold">
            {badge}
          </span>
        )}
        {hasRedDot && (
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full inline-block"></span>
        )}
        <ChevronRight size={18} className="text-gray-300" />
      </div>
    </div>
  );
};
