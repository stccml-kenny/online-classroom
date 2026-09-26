import React from 'react';
import {
  GraduationCap, Users, User, BookOpen, Clock,
  Sparkles, CheckCircle2, ChevronRight, LogOut,
  Bell, UserPlus
} from 'lucide-react';
import { UserProfile, ROLE_CONFIGS } from '@/components/auth/AuthModal';
import { TabType } from '@/components/layout/BottomNav';

interface HomeViewProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onNavigateTab: (tab: TabType) => void;
  onOpenNotices: () => void;
  onOpenSetup?: () => void;
  onOpenAccountMgmt?: () => void; // 👑 管理員派發帳戶入口
  noticeCount?: number;
  courseCount?: number;
  memberCount?: number;
}

export const HomeView: React.FC<HomeViewProps> = ({
  currentUser,
  onOpenAuth,
  onLogout,
  onNavigateTab,
  onOpenNotices,
  onOpenSetup,
  onOpenAccountMgmt,
  noticeCount = 0,
  courseCount = 0,
  memberCount = 0
}) => {
  const isStudentOrParent = currentUser?.role === 'student' || currentUser?.role === 'parent';
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FA] pb-20">
      
      {/* 1. HERO 橫幅區：平台品牌與登入入口 */}
      <div className="bg-gradient-to-br from-[#FF6B57] via-[#FF8573] to-[#FF5138] text-white p-5 rounded-b-3xl shadow-md relative overflow-hidden">
        {/* 背景裝飾光暈 */}
        <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-lg pointer-events-none"></div>

        <div className="relative z-10 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                <GraduationCap size={24} className="text-white" />
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-white/80 bg-white/20 px-2 py-0.5 rounded-full">
                  Online Classroom
                </span>
                <h1 className="text-lg font-black tracking-tight">智能網上教室</h1>
              </div>
            </div>

            {/* 登入身分標籤或訪客標籤 */}
            {currentUser ? (
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-white text-[#FF6B57] shadow-sm">
                  <span>{ROLE_CONFIGS[currentUser.role]?.emoji}</span>
                  <span>{ROLE_CONFIGS[currentUser.role]?.label}</span>
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xs text-white border border-white/30 transition-colors"
              >
                訪客 (點擊登入)
              </button>
            )}
          </div>

          {/* 歡迎與介紹文字 */}
          <div>
            {currentUser ? (
              <>
                <p className="text-base font-extrabold">
                  早安，{currentUser.name}！
                </p>
                <p className="text-xs text-white/90">
                  {isStudentOrParent
                    ? `您目前的專屬課程：${currentUser.branch || '總校'} · ${currentUser.className || '班別'}`
                    : `身分：${ROLE_CONFIGS[currentUser.role]?.label} · ${currentUser.branch || '總校'}`}\n                </p>
              </>
            ) : (
              <>
                <p className="text-base font-extrabold">
                  一站式多角色智能學習與教學平台
                </p>
                <p className="text-xs text-white/90 leading-relaxed">
                  支援導師、助教、學生與家長登入使用。
                </p>
              </>
            )}
          </div>

          {/* 開始使用按鈕 */}
          <div className="pt-1 space-y-2">
            {!currentUser ? (
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full py-4 bg-white text-[#FF6B57] hover:bg-orange-50 font-black rounded-2xl shadow-xl flex items-center justify-center gap-2 text-base transition-all active:scale-[0.98]"
              >
                <Sparkles size={18} className="text-[#FF6B57]" />
                <span>開始使用 (登入帳戶)</span>
                <ChevronRight size={18} />
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab('courses')}
                  className="w-full py-3.5 bg-white text-[#FF6B57] hover:bg-orange-50 font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.98]"
                >
                  <Sparkles size={18} className="text-[#FF6B57]" />
                  <span>
                    {isStudentOrParent ? '開始使用 (進入我的課程與家課)' : '開始使用 (進入課程管理)'}
                  </span>
                  <ChevronRight size={16} />
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={onOpenAccountMgmt}
                    className="w-full py-2 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors backdrop-blur-xs"
                  >
                    <UserPlus size={14} />
                    <span>👑 系統管理員：派發新帳戶與帳號管理</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ⭐ 登入前引導卡片（無多餘說明） */}
      {!currentUser && (
        <div className="p-5 sm:p-8 max-w-md mx-auto text-center space-y-4 pt-10">
          <div className="w-16 h-16 rounded-3xl bg-orange-100 text-[#FF6B57] flex items-center justify-center mx-auto shadow-xs">
            <BookOpen size={30} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-extrabold text-gray-800">歡迎進入智能網上教室</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              請登入您的帳戶，以存取您的專屬課程、單元教材及在線繳交功課。
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full py-3.5 bg-gradient-to-r from-[#FF6B57] to-[#FF8573] hover:opacity-95 text-white font-extrabold rounded-2xl shadow-md text-sm transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <User size={16} />
            <span>立即登入帳戶</span>
          </button>
        </div>
      )}

      {/* ⭐ 核心教學功能：嚴格要求「登入前不要顯示 平台核心教學功能」，僅在已登入時呈現 */}
      {currentUser && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-gray-800">平台核心教學功能</h2>
            <span className="text-[11px] text-gray-400">專屬工作區</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 我的課程 / 課程目錄 */}
            <button
              type="button"
              onClick={() => onNavigateTab('courses')}
              className="p-3.5 bg-white border border-gray-150 rounded-2xl text-left shadow-xs hover:border-[#FF6B57] hover:shadow-sm transition-all group flex flex-col justify-between h-24"
            >
              <div className="flex justify-between items-start">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#FF6B57] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <BookOpen size={18} />
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">
                  {isStudentOrParent ? '我的課程' : courseCount > 0 ? `${courseCount} 堂課` : '查看'}
                </span>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-800 group-hover:text-[#FF6B57]">
                  {isStudentOrParent ? '我的課程與單元' : '課程目錄管理'}
                </div>
                <div className="text-[10px] text-gray-400">
                  {isStudentOrParent ? '單元教材與單元家課(唯讀)' : '單元教材與家課發布'}
                </div>
              </div>
            </button>

            {/* 電子通告 */}
            <button
              type="button"
              onClick={onOpenNotices}
              className="p-3.5 bg-white border border-gray-150 rounded-2xl text-left shadow-xs hover:border-[#FF6B57] hover:shadow-sm transition-all group flex flex-col justify-between h-24"
            >
              <div className="flex justify-between items-start">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Bell size={18} />
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold">
                  {noticeCount > 0 ? `${noticeCount} 則` : '最新'}
                </span>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-800 group-hover:text-emerald-600">電子通告</div>
                <div className="text-[10px] text-gray-400">校務訊息與活動公告</div>
              </div>
            </button>

            {/* 若非學生/家長，顯示課程點名與會員目錄 */}
            {!isStudentOrParent && (
              <>
                {/* 課程點名 */}
                <button
                  type="button"
                  onClick={() => onNavigateTab('attendance')}
                  className="p-3.5 bg-white border border-gray-150 rounded-2xl text-left shadow-xs hover:border-[#FF6B57] hover:shadow-sm transition-all group flex flex-col justify-between h-24"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Clock size={18} />
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-bold">
                      考勤
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-800 group-hover:text-purple-600">課程點名</div>
                    <div className="text-[10px] text-gray-400">未點名/出席/請假記錄</div>
                  </div>
                </button>

                {/* 會員名冊 */}
                <button
                  type="button"
                  onClick={() => onNavigateTab('members')}
                  className="p-3.5 bg-white border border-gray-150 rounded-2xl text-left shadow-xs hover:border-[#FF6B57] hover:shadow-sm transition-all group flex flex-col justify-between h-24"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Users size={18} />
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold">
                      名冊
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-800 group-hover:text-blue-600">會員名冊</div>
                    <div className="text-[10px] text-gray-400">學生資料與班級管理</div>
                  </div>
                </button>
              </>
            )}

            {/* 若為學生/家長，顯示在線交功課與學習進度 */}
            {isStudentOrParent && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateTab('courses')}
                  className="p-3.5 bg-white border border-gray-150 rounded-2xl text-left shadow-xs hover:border-[#FF6B57] hover:shadow-sm transition-all group flex flex-col justify-between h-24"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <CheckCircle2 size={18} />
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">
                      提交
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-800 group-hover:text-amber-700">在線交功課</div>
                    <div className="text-[10px] text-gray-400">拍照上傳作業與筆記</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab('more')}
                  className="p-3.5 bg-white border border-gray-150 rounded-2xl text-left shadow-xs hover:border-[#FF6B57] hover:shadow-sm transition-all group flex flex-col justify-between h-24"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <User size={18} />
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold">
                      資訊
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-800 group-hover:text-rose-600">個人與帳號</div>
                    <div className="text-[10px] text-gray-400">學籍資訊與密碼管理</div>
                  </div>
                </button>
              </>
            )}
          </div>

          {/* 4. 登入用戶專屬卡片與登出控制 */}
          <div className="p-4 bg-white border border-gray-150 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">目前登入身分</span>
              <button
                type="button"
                onClick={onOpenAuth}
                className="text-[11px] text-[#FF6B57] font-bold hover:underline"
              >
                切換帳戶
              </button>
            </div>
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-lg shadow-2xs">
                  {ROLE_CONFIGS[currentUser.role]?.emoji || '👤'}
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-800 flex items-center gap-1">
                    <span>{currentUser.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-orange-100 text-[#FF6B57]">
                      {ROLE_CONFIGS[currentUser.role]?.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">
                    帳號：{currentUser.username} · 分校：{currentUser.branch || '總校'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('確定要登出目前帳戶嗎？')) {
                    onLogout();
                  }
                }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                title="登出帳戶"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
