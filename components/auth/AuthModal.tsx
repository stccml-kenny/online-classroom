import React, { useState } from 'react';
import {
  X, User, Lock, Eye, EyeOff, CheckCircle2, AlertCircle,
  Sparkles, LogOut
} from 'lucide-react';

export type UserRole = 'admin' | 'teacher' | 'assistant' | 'student' | 'parent';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  password: string; // 嚴格 8 位純數字
  phone?: string;
  branch?: string;
  className?: string;
  childName?: string;
  studentName?: string;
  childrenUsernames?: string[]; // ⭐ 需求 4：家長帳戶可關聯多於一個學生之登入帳號
  enrolledCourses?: string[];   // ⭐ 需求：參加課程 (Courses) 移送至帳戶中心
  createdAt: string;
}

export const ROLE_CONFIGS: Record<UserRole, {
  label: string;
  color: string;
  bgLight: string;
  border: string;
  desc: string;
  emoji: string;
}> = {
  admin: {
    label: '系統管理人員',
    color: 'text-purple-700',
    bgLight: 'bg-purple-50 text-purple-700',
    border: 'border-purple-200',
    desc: '全權管理系統設定、分校班別、全校課程與統一派發用戶帳號',
    emoji: '👑'
  },
  teacher: {
    label: '導師',
    color: 'text-blue-700',
    bgLight: 'bg-blue-50 text-blue-700',
    border: 'border-blue-200',
    desc: '維護課程單元教材、發布單元家課、批閱學生功課及點名',
    emoji: '👨‍🏫'
  },
  assistant: {
    label: '助教',
    color: 'text-emerald-700',
    bgLight: 'bg-emerald-50 text-emerald-700',
    border: 'border-emerald-200',
    desc: '執行課堂點名、核對學生功課繳交與協助教學',
    emoji: '🧑‍🏫'
  },
  student: {
    label: '學生',
    color: 'text-amber-700',
    bgLight: 'bg-amber-50 text-amber-700',
    border: 'border-amber-200',
    desc: '查閱自己的課程、課程單元與單元家課(唯讀)，並進行在線交功課',
    emoji: '🎒'
  },
  parent: {
    label: '家長',
    color: 'text-rose-700',
    bgLight: 'bg-rose-50 text-rose-700',
    border: 'border-rose-200',
    desc: '查閱子女的課程、課程單元與單元家課(唯讀)，並協助提交功課',
    emoji: '👨‍👩‍👧'
  }
};

// 系統唯一預設管理員帳號（依需求已移除其餘所有示範 dummy 帳號）
export const DEFAULT_DEMO_USERS: UserProfile[] = [
  {
    id: 'demo_admin',
    username: 'admin',
    name: '總系統管理員',
    role: 'admin',
    password: '88888888',
    phone: '91234567',
    branch: '總校',
    className: '全校',
    createdAt: '2026-09-01T00:00:00.000Z'
  }
];

// 嚴格 8 位純數字校驗工具函數
export const is8DigitNumeric = (pwd: string): boolean => {
  return /^\d{8}$/.test(pwd);
};

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: string;
  branches?: string[];
  classes?: string[];
  currentUser: UserProfile | null;
  usersList: UserProfile[];
  onLoginSuccess: (user: UserProfile) => void;
  onRegisterSuccess?: (user: UserProfile) => void;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  usersList = [],
  onLoginSuccess,
  onLogout
}) => {
  // 登入表單狀態
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  if (!isOpen) return null;

  // 登入送出處理
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const uname = loginUsername.trim();
    const pwd = loginPassword.trim();

    if (!uname) {
      alert('請輸入登入帳號！');
      return;
    }

    // ⭐ 需求：密碼必需為8位數字
    if (!is8DigitNumeric(pwd)) {
      alert('⚠️ 密碼必需為嚴格 8 位純數字（例如：12345678）！');
      return;
    }

    // 合併全域已註冊與底層帳號進行查找
    const allUsers = [...usersList, ...DEFAULT_DEMO_USERS];
    const found = allUsers.find(
      (u) => u.username.toLowerCase() === uname.toLowerCase() && u.password === pwd
    );

    if (found) {
      onLoginSuccess(found);
      onClose();
    } else {
      alert('❌ 登入失敗：帳號不存在或密碼錯誤！\n（請輸入正確的帳號及 8 位純數字密碼）');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F8F9FA] flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
      
      {/* 頂部全寬標題列 */}
      <div className="bg-gradient-to-r from-[#FF6B57] to-[#FF8573] p-4 text-white flex justify-between items-center shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-black text-base sm:text-lg leading-tight">Online Classroom 帳戶登入</h2>
            <p className="text-xs text-white/90">請輸入派發之帳號及 8 位純數字密碼</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white"
          title="關閉"
        >
          <X size={20} />
        </button>
      </div>

      {/* 登入狀態卡片（若已登入） */}
      {currentUser && (
        <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-base">{ROLE_CONFIGS[currentUser.role]?.emoji || '👤'}</span>
            <div>
              <span className="font-bold text-gray-800">{currentUser.name}</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-200 text-amber-900">
                {ROLE_CONFIGS[currentUser.role]?.label}
              </span>
              <div className="text-[10px] text-gray-500">帳號: {currentUser.username}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('確定要登出目前帳戶嗎？')) {
                onLogout();
              }
            }}
            className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg flex items-center gap-1 text-[11px] transition-colors"
          >
            <LogOut size={13} />
            <span>登出</span>
          </button>
        </div>
      )}

      {/* ⭐ 滿板登入核心內容區（滿板顯示，無多餘說明與無示範帳號） */}
      <div className="flex-1 overflow-y-auto flex flex-col justify-center items-center p-4 sm:p-6 w-full">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-orange-50 text-[#FF6B57] rounded-3xl mx-auto flex items-center justify-center shadow-xs">
              <Lock size={28} />
            </div>
            <h3 className="text-lg font-black text-gray-900 pt-2">歡迎使用智能網上教室</h3>
            <p className="text-xs text-gray-400">請輸入您的帳號與 8 位純數字密碼進行登入</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">登入帳號 (Username)</label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="請輸入帳號"
                  className="w-full pl-10 pr-3.5 py-3 border border-gray-200 rounded-2xl text-sm outline-none focus:border-[#FF6B57] text-black font-semibold placeholder:text-gray-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-gray-700">8位純數字密碼 (Password)</label>
                <span className="text-xs text-gray-400 font-mono">
                  {loginPassword.length}/8 位
                </span>
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  pattern="[0-9]{8}"
                  value={loginPassword}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                    setLoginPassword(val);
                  }}
                  placeholder="請輸入8位純數字密碼"
                  className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-2xl text-sm outline-none focus:border-[#FF6B57] text-black font-bold tracking-widest placeholder:tracking-normal placeholder:text-gray-400 font-mono transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {loginPassword.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1 text-xs">
                  {loginPassword.length === 8 ? (
                    <span className="text-emerald-600 flex items-center gap-1 font-bold">
                      <CheckCircle2 size={13} /> 符合 8 位純數字格式
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1 font-medium">
                      <AlertCircle size={13} /> 需輸入滿 8 位純數字（還缺 {8 - loginPassword.length} 位）
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-[#FF6B57] to-[#FF8573] hover:opacity-95 text-white font-black rounded-2xl shadow-md text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] mt-2"
            >
              <Sparkles size={16} />
              <span>確認登入帳戶</span>
            </button>
          </form>
        </div>

        {/* 底部微版權說明 */}
        <p className="text-xs text-gray-400 text-center mt-6">
          Online Classroom 智能網上教室 · 密碼格式為 8 位純數字
        </p>
      </div>
    </div>
  );
};
