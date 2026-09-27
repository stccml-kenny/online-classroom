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
  email?: string;   // ⭐ 電郵地址 (選填)
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

// ⭐ 系統唯一預設管理員帳號（無任何硬編碼偽導師/學生/家長帳號，所有角色帳戶嚴格來自雲端資料庫）
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
  onVerifyLogin?: (username: string, password: string) => Promise<UserProfile | null>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  usersList = [],
  onLoginSuccess,
  onLogout,
  onVerifyLogin
}) => {
  // 登入表單狀態 (所有 Hook 嚴格置於 early return 之前，遵守 React Rules of Hooks)
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  // 登入送出處理 (⭐ 支援跨機器即時向 Appwrite 雲端直連驗證)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const uname = loginUsername.trim();
    const pwd = loginPassword.trim();

    if (!uname) {
      alert('請輸入登入帳號！');
      return;
    }

    // ⭐ 密碼必需為8位數字
    if (!is8DigitNumeric(pwd)) {
      alert('⚠️ 密碼必需為嚴格 8 位純數字（例如：12345678）！');
      return;
    }

    setSubmitting(true);

    // 1. 本地/記憶體快取快速比對
    const allUsers = [...usersList, ...DEFAULT_DEMO_USERS];
    let found = allUsers.find(
      (u) => u.username.toLowerCase() === uname.toLowerCase() && u.password === pwd
    );

    // 2. 若本地未找到，即刻直接向 Appwrite 雲端發起精準查詢 (解決跨機器本地快取尚未加載完成問題)
    if (!found && onVerifyLogin) {
      try {
        found = await onVerifyLogin(uname, pwd);
      } catch (err: any) {
        console.warn('雲端直接登入驗證錯誤:', err);
      }
    }

    setSubmitting(false);

    if (found) {
      onLoginSuccess(found);
      onClose();
    } else {
      alert('❌ 登入失敗：帳號不存在或密碼錯誤！\n（請輸入正確的帳號及 8 位純數字密碼）');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col w-full h-full overflow-y-auto animate-in fade-in duration-200">
      {/* 頂部全寬控制列 (滿板顯示，右上角提供關閉按鈕) */}
      <div className="w-full flex justify-between items-center px-6 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B57] flex items-center justify-center">
            <Lock size={16} />
          </div>
          <span className="font-black text-gray-800 text-sm">Online Classroom 帳戶登入</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors text-gray-600 hover:text-gray-900"
          title="關閉"
        >
          <X size={18} />
        </button>
      </div>

      {/* 滿板中央主內容區 */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 w-full">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">歡迎登入</h2>
            <p className="text-xs text-gray-400">請輸入獲派發之帳號及 8 位純數字密碼</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">登入帳號 (Username)</label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="請輸入帳號"
                  className="w-full pl-10 pr-3.5 py-3.5 border border-gray-200 rounded-2xl text-sm outline-none focus:border-[#FF6B57] text-black font-semibold placeholder:text-gray-400 transition-colors bg-gray-50/50 focus:bg-white"
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
                  className="w-full pl-10 pr-11 py-3.5 border border-gray-200 rounded-2xl text-sm outline-none focus:border-[#FF6B57] text-black font-bold tracking-widest placeholder:tracking-normal placeholder:text-gray-400 font-mono transition-colors bg-gray-50/50 focus:bg-white"
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

            {/* ⭐ 確認登入帳戶按鍵要用橙色 */}
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-4 bg-gradient-to-r from-[#FF6B57] to-[#FF8573] hover:opacity-95 text-white font-black rounded-2xl shadow-lg shadow-orange-500/25 text-base flex items-center justify-center gap-2 transition-all active:scale-[0.99] mt-4 ${
                submitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              <Sparkles size={18} />
              <span>{submitting ? '正在驗證帳號...' : '確認登入帳戶'}</span>
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center pt-4">
            Online Classroom 智能網上教室 · 密碼格式為 8 位純數字
          </p>
        </div>
      </div>
    </div>
  );
};
