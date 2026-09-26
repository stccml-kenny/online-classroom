import React from 'react';
import { Home, MessageCircle, Users, GraduationCap, UserCheck } from 'lucide-react';
import { UserRole } from '@/components/auth/AuthModal';

export type TabType = 'home' | 'msg' | 'members' | 'courses' | 'attendance' | 'more' | 'staff';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  userRole?: UserRole;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, userRole }) => {
  const isStudentOrParent = userRole === 'student' || userRole === 'parent';

  return (
    <div className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 flex justify-around py-2 z-20">
      <TabButton
        icon={<Home size={20} />}
        label="首頁"
        active={activeTab === 'home'}
        onClick={() => onTabChange('home')}
      />
      <TabButton
        icon={<MessageCircle size={20} />}
        label="即時訊息"
        active={activeTab === 'msg'}
        onClick={() => onTabChange('msg')}
      />
      {/* ⭐ 需求：家長及學生只顯示自己的課程，不顯示管理員/導師之會員與點名 */}
      {!isStudentOrParent && (
        <TabButton
          icon={<Users size={20} />}
          label="會員"
          active={activeTab === 'members'}
          onClick={() => onTabChange('members')}
        />
      )}
      <TabButton
        icon={<GraduationCap size={20} />}
        label={isStudentOrParent ? "我的課程" : "課程"}
        active={activeTab === 'courses'}
        onClick={() => onTabChange('courses')}
      />
      {!isStudentOrParent && (
        <TabButton
          icon={<UserCheck size={20} />}
          label="課程點名"
          active={activeTab === 'attendance'}
          onClick={() => onTabChange('attendance')}
        />
      )}
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
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 transition-colors shrink-0 ${
      active ? 'text-[#FF6B57]' : 'text-gray-400 hover:text-gray-600'
    }`}
  >
    <div className="h-5 flex items-center justify-center">{icon}</div>
    <span className="text-[10px] mt-1 font-medium leading-none whitespace-nowrap">{label}</span>
  </button>
);
