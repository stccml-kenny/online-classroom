import React from 'react';
import { Home, MessageCircle, Users, GraduationCap, UserCheck, Calendar as CalendarIcon } from 'lucide-react';
import { UserRole } from '@/components/auth/AuthModal';

export type TabType = 'home' | 'msg' | 'members' | 'courses' | 'calendar' | 'attendance' | 'more' | 'staff';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  userRole?: UserRole;
  unreadChatCount?: number;
  isChatEnabled?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  userRole,
  unreadChatCount = 0,
  isChatEnabled = true,
}) => {
  const isStudentOrParent = userRole === 'student' || userRole === 'parent';

  // 🟢 學生 / 家長端：精準符合截圖 3 大底部選單 (首頁 / 日曆 / 訊息)，主色採用 #147D6F 墨綠
  if (isStudentOrParent) {
    return (
      <div className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 flex justify-around py-2 z-20 shadow-xs">
        <TabButton
          icon={<Home size={22} />}
          label="首頁"
          active={activeTab === 'home'}
          activeColor="text-[#147D6F]"
          onClick={() => onTabChange('home')}
        />
        <TabButton
          icon={<CalendarIcon size={22} />}
          label="日曆"
          active={activeTab === 'calendar'}
          activeColor="text-[#147D6F]"
          onClick={() => onTabChange('calendar')}
        />
        {isChatEnabled && (
          <TabButton
            icon={<MessageCircle size={22} />}
            label="訊息"
            active={activeTab === 'msg'}
            activeColor="text-[#147D6F]"
            badge={unreadChatCount}
            onClick={() => onTabChange('msg')}
          />
        )}
      </div>
    );
  }

  // 🟠 導師 / 助教 / 管理員端：維持原有完整管理選單
  return (
    <div className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 flex justify-around py-2 z-20">
      <TabButton
        icon={<Home size={20} />}
        label="首頁"
        active={activeTab === 'home'}
        onClick={() => onTabChange('home')}
      />
      {isChatEnabled && (
        <TabButton
          icon={<MessageCircle size={20} />}
          label="即時訊息"
          active={activeTab === 'msg'}
          badge={unreadChatCount}
          onClick={() => onTabChange('msg')}
        />
      )}
      <TabButton
        icon={<Users size={20} />}
        label="會員"
        active={activeTab === 'members'}
        onClick={() => onTabChange('members')}
      />
      <TabButton
        icon={<GraduationCap size={20} />}
        label="課程"
        active={activeTab === 'courses'}
        onClick={() => onTabChange('courses')}
      />
      <TabButton
        icon={<UserCheck size={20} />}
        label="課程點名"
        active={activeTab === 'attendance'}
        onClick={() => onTabChange('attendance')}
      />
      <TabButton
        icon={
          <div className="flex flex-col gap-0.5">
            <div className="w-5 h-0.5 bg-current"></div>
            <div className="w-5 h-0.5 bg-current"></div>
            <div className="w-5 h-0.5 bg-current"></div>
          </div>
        }
        label="更多"
        active={activeTab === 'more'}
        onClick={() => onTabChange('more')}
      />
    </div>
  );
};

interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  activeColor?: string;
  onClick: () => void;
  badge?: number;
}

const TabButton: React.FC<TabButtonProps> = ({
  icon,
  label,
  active,
  activeColor = 'text-[#FF6B57]',
  onClick,
  badge,
}) => (
  <button
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 transition-colors shrink-0 relative cursor-pointer ${
      active ? `${activeColor} font-bold` : 'text-gray-400 hover:text-gray-600'
    }`}
  >
    <div className="h-5 flex items-center justify-center relative">
      {icon}
      {badge && badge > 0 ? (
        <span className="absolute -top-1.5 -right-2 flex items-center justify-center">
          <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex items-center justify-center px-1 min-w-[15px] h-[15px] bg-red-500 text-white text-[8px] font-black rounded-full border-2 border-white shadow-xs">
            {badge > 99 ? '99+' : badge}
          </span>
        </span>
      ) : null}
    </div>
    <span className="text-[10px] mt-1 leading-none whitespace-nowrap">{label}</span>
  </button>
);
