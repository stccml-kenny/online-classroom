import React from 'react';
import {
  GraduationCap, Users, User, Calendar, BookOpen, Clock,
  Sparkles, CheckCircle2, ChevronRight, LogOut, UserPlus,
  Shield, Layers, MapPin, Bell
} from 'lucide-react';
import { UserProfile, ROLE_CONFIGS } from '@/components/auth/AuthModal';
import { TabType } from '@/components/layout/BottomNav';

interface HomeViewProps {
  currentUser: UserProfile | null;
  onOpenAuth: (defaultTab?: 'login' | 'register') => void;
  onLogout: () => void;
  onNavigateTab: (tab: TabType) => void;
  onOpenNotices: () => void;
  onOpenSetup?: () => void;
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
  noticeCount = 0,
  courseCount = 0,
  memberCount = 0
}) => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FA] pb-20">
      
      {/* 1. HERO 橫幅區 */}
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
                onClick={() => onOpenAuth('login')}
                className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xs text-white border border-white/30 transition-colors"
              >
                訪客 (點擊登入)
              </button>
            )}
          </div>

          {/* 歡迎文字 */}
          <div>
            {currentUser ? (
              <>
                <p className="text-base font-extrabold">
                  早安，{currentUser.name}！
                </p>
                <p className="text-xs text-white/90">
                  所屬：{currentUser.branch || '總校'} · {currentUser.className || '全體班別'}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-extrabold">
                  歡迎來到全方位互動學習平台
                </p>
                <p className="text-xs text-white/90">
                  支援系統管理員、導師、助教、學生與家長五大角色，一站式管理教學進度。
                </p>
              </>
            )}
          </div>

          {/* ⭐ 核心需求：首頁要有開始使用，之後要求登入帳戶 */}
          <div className="pt-1 space-y-2">
            {!currentUser ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="w-full py-3.5 bg-white text-[#FF6B57] hover:bg-orange-50 font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.98]"
                >
                  <Sparkles size={18} className="text-[#FF6B57]" />
                  <span>開始使用 (立即登入帳戶)</span>
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="w-full py-2 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors backdrop-blur-xs"
                >
                  <UserPlus size={14} />
                  <span>新用戶登記 (5大角色支援 · 8位密碼)</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateTab('courses')}
                className="w-full py-3.5 bg-white text-[#FF6B57] hover:bg-orange-50 font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.98]"
              >
                <Sparkles size={18} className="text-[#FF6B57]" />
                <span>開始使用 (進入課程與家課)</span>
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. 5大角色身分介紹與即時切換體驗 */}
      <div className="px-4 -mt-2">
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-150">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
              <Shield size={14} className="text-[#FF6B57]" />
              <span>第一階段支援 5 大用戶角色</span>
            </span>
            {!currentUser && (
              <button
                onClick={() => onOpenAuth('login')}
                className="text-[11px] text-[#FF6B57] font-bold hover:underline"
              >
                快速登入體驗 →
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-1 text-center">
            {Object.entries(ROLE_CONFIGS).map(([k, cfg]) => {
              const isCurrent = currentUser?.role === k;
              return (
                <div
                  key={k}
                  className={`p-1.5 rounded-xl border flex flex-col items-center gap-0.5 transition-all ${
                    isCurrent
                      ? 'border-[#FF6B57] bg-orange-50 text-[#FF6B57] font-bold shadow-xs'
                      : 'border-gray-100 bg-gray-50/50 text-gray-600 font-medium'
                  }`}
                >
                  <span className="text-base">{cfg.emoji}</span>
                  <span className="text-[10px] leading-tight truncate w-full">{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. 核心功能快捷入口 */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-gray-800">快捷功能入口</h2>
          <span className="text-[11px] text-gray-400">一鍵直達工作區</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* 課程目錄 */}
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
                {courseCount > 0 ? `${courseCount} 堂課` : '查看'}
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-800 group-hover:text-[#FF6B57]">課程目錄</div>
              <div className="text-[10px] text-gray-400">單元教材與單元家課</div>
            </div>
          </button>

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
              <div className="text-xs font-bold text-gray-800 group-hover:text-blue-600">會員目錄</div>
              <div className="text-[10px] text-gray-400">學生資料與班級管理</div>
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
        </div>

        {/* 4. 登入用戶專屬卡片與登出控制 */}
        {currentUser && (
          <div className="p-4 bg-white border border-gray-150 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">目前登入身分</span>
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
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
        )}

      </div>
    </div>
  );
};
