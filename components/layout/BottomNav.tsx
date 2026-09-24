import React from 'react';
import { Home, MessageCircle, Users, GraduationCap } from 'lucide-react';

export type TabType = 'home' | 'msg' | 'members' | 'courses' | 'more' | 'staff';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 flex justify-around py-2 z-20">
      <TabButton
        icon={<Home size={22} />}
        label="首頁"
        active={activeTab === 'home'}
        onClick={() => onTabChange('home')}
      />
      <TabButton
        icon={<MessageCircle size={22} />}
        label="即時訊息"
        active={activeTab === 'msg'}
        onClick={() => onTabChange('msg')}
      />
      {/* ⭐ 需求：移除底部職員通告改成會員，點擊直接打開會員目錄 */}
      <TabButton
        icon={<Users size={22} />}
        label="會員"
        active={activeTab === 'members'}
        onClick={() => onTabChange('members')}
      />
      <TabButton
        icon={<GraduationCap size={22} />}
        label="課程"
        active={activeTab === 'courses'}
        onClick={() => onTabChange('courses')}
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
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-16 transition-colors ${
      active ? 'text-[#FF6B57]' : 'text-gray-400 hover:text-gray-600'
    }`}
  >
    <div className="h-6 flex items-center justify-center">{icon}</div>
    <span className="text-[11px] mt-1 font-medium">{label}</span>
  </button>
);
