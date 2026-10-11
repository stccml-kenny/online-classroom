import React from 'react';
import { MessageCircle, RotateCcw, Menu, Bell, Crown } from 'lucide-react';
import { UserProfile } from '@/components/auth/AuthModal';

interface HeaderProps {
  title: string;
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onOpenChat?: () => void;
  unreadChatCount?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenMenu?: () => void;
  onOpenNotices?: () => void;
  noticeCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenChat,
  unreadChatCount = 0,
  onRefresh,
  isRefreshing = false,
  onOpenMenu,
  onOpenNotices,
  noticeCount = 0,
}) => {
  const isStudentOrParent = currentUser?.role === 'student' || currentUser?.role === 'parent';
  const studentName = currentUser?.name || currentUser?.studentName || currentUser?.childName || '學生';

  // 🟢 學生/家長端：極簡白色高級現代品牌導航列 (參照截圖布局)
  if (isStudentOrParent) {
    return (
      <div className="bg-white text-gray-900 pt-3.5 pb-2.5 px-4 flex justify-between items-center sticky top-0 z-20 border-b border-gray-100 shadow-2xs">
        {/* 左側：漢堡選單按鈕 */}
        <div className="w-8 shrink-0 flex items-center justify-start">
          <button
            type="button"
            onClick={onOpenMenu}
            className="p-1 text-gray-800 hover:text-gray-600 transition-colors cursor-pointer"
            title="選單"
          >
            <Menu size={22} />
          </button>
        </div>

        {/* 中間偏左：SNJMUSIC 品牌標誌與身分 / 學員姓名 */}
        <div className="flex items-center gap-2 flex-1 pl-1">
          {/* 菱形皇冠 Logo */}
          <div className="w-7 h-7 rounded-lg bg-[bg-orange-50] border border-[border-orange-200] text-[#FF6B57] flex items-center justify-center font-bold shrink-0 shadow-2xs">
            <Crown size={15} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-gray-900 tracking-tight flex items-center gap-1 leading-tight">
              <span>SNJMUSIC</span>
              <span>{currentUser?.role === 'parent' ? '家長端' : '學生端'}</span>
            </div>
            <div className="text-[10px] text-gray-400 font-medium leading-tight truncate">
              {studentName}
            </div>
          </div>
        </div>

        {/* 右側：通知鈴鐺與重新整理 */}
        <div className="flex items-center gap-1 shrink-0">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
              title="重新整理"
            >
              <RotateCcw size={16} className={isRefreshing ? "animate-spin text-[#FF6B57]" : ""} />
            </button>
          )}

          {onOpenNotices && (
            <button
              type="button"
              onClick={onOpenNotices}
              className="relative p-1.5 text-gray-800 hover:text-gray-600 transition-colors cursor-pointer"
              title="最新消息與通知"
            >
              <Bell size={20} />
              {noticeCount > 0 ? (
                <span className="absolute 1 top-1 right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              ) : null}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 🟠 導師 / 助教 / 管理員端：維持原有標準頂部導航
  return (
    <div className="bg-[#FF6B57] text-white pt-4 pb-3 px-4 flex justify-between items-center sticky top-0 z-20 shadow-xs">
      {/* 左側排版：手動重新整理按鈕 */}
      <div className="w-8 shrink-0 flex items-center justify-start">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="p-1 text-white hover:text-white/80 transition-colors"
            title="重新整理數據"
          >
            <RotateCcw size={17} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        )}
      </div>

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
