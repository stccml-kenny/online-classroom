import React, { useState } from 'react';
import {
  X, User, Lock, Eye, EyeOff, CheckCircle2, AlertCircle,
  Sparkles, LogOut, Check, Shield
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

// 預設 5 大角色示範帳號（密碼均為嚴格 8 位數字）
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
  },
  {
    id: 'demo_teacher',
    username: 'teacher_chen',
    name: '陳導師',
    role: 'teacher',
    password: '12345678',
    phone: '92345678',
    branch: '沙田分校',
    className: '高班',
    createdAt: '2026-09-01T00:00:00.000Z'
  },
  {
    id: 'demo_assistant',
    username: 'ta_wong',
    name: '王助教',
    role: 'assistant',
    password: '12345678',
    phone: '93456789',
    branch: '沙田分校',
    className: '低班',
    createdAt: '2026-09-01T00:00:00.000Z'
  },
  {
    id: 'demo_student',
    username: 'student_lok',
    name: '林同學',
    role: 'student',
    password: '12345678',
    phone: '94567890',
    branch: '沙田分校',
    className: '1A',
    createdAt: '2026-09-01T00:00:00.000Z'
  },
  {
    id: 'demo_parent',
    username: 'parent_lok',
    name: '林家長',
    role: 'parent',
    password: '12345678',
    phone: '95678901',
    branch: '沙田分校',
    className: '1A',
    childName: '林同學',
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

    // ⭐ 需求：密碼必需為要8位數字
    if (!is8DigitNumeric(pwd)) {
      alert('⚠️ 密碼必需為嚴格 8 位純數字（例如：12345678）！');
      return;
    }

    // 合併全域已註冊與示範帳號進行查找
    const allUsers = [...usersList, ...DEFAULT_DEMO_USERS];
    const found = allUsers.find(
      (u) => u.username.toLowerCase() === uname.toLowerCase() && u.password === pwd
    );

    if (found) {
      onLoginSuccess(found);
      onClose();
    } else {
      alert('❌ 登入失敗：帳號不存在或密碼錯誤！\n（請確認帳號是由系統管理員統一派發，且密碼為正確的 8 位純數字）');
    }
  };

  // 快速示範帳號一鍵填入
  const handleQuickFillDemo = (demo: UserProfile) => {
    setLoginUsername(demo.username);
    setLoginPassword(demo.password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-100 animate-in fade-in duration-200">
        
        {/* 彈窗標題列 */}
        <div className="bg-gradient-to-r from-[#FF6B57] to-[#FF8573] p-4 text-white flex justify-between items-center shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-extrabold text-base leading-tight">Online Classroom 帳戶登入</h2>
              <p className="text-[11px] text-white/90">帳戶統一由系統管理人員派發 · 8位純數字密碼</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 登入狀態卡片（若已登入） */}
        {currentUser && (
          <div className="p-3 bg-amber-50/80 border-b border-amber-200 flex items-center justify-between text-xs">
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

        {/* 內容滑動區 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* ⭐ 需求：此app不設自行登記賬戶，所以賬戶統一於系統管理人員派發 */}
          <div className="bg-orange-50/70 p-3 rounded-2xl border border-orange-200 text-xs text-orange-950 flex items-start gap-2">
            <Shield size={16} className="text-[#FF6B57] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-gray-900">登入提示：</span>
              本系統不設公開自行登記，所有學生、家長、導師及助教帳戶均由校方<span className="font-bold text-[#FF6B57]">系統管理人員統一派發</span>。請輸入管理員派發的帳號及 8 位數字密碼登入。
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">派發之登入帳號 (Username)</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="請輸入帳號 (例：admin 或 student_lok)"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] text-black font-semibold placeholder:text-gray-400"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-gray-700">8位數字密碼 (Password)</label>
                <span className="text-[10px] text-gray-400 font-mono">
                  {loginPassword.length}/8 位純數字
                </span>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
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
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] text-black font-bold tracking-widest placeholder:tracking-normal placeholder:text-gray-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {loginPassword.length > 0 && (
                <div className="mt-1 flex items-center gap-1 text-[10px]">
                  {loginPassword.length === 8 ? (
                    <span className="text-emerald-600 flex items-center gap-0.5 font-bold">
                      <CheckCircle2 size={12} /> 符合8位純數字規定
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-0.5 font-medium">
                      <AlertCircle size={12} /> 必需輸入滿 8 位純數字 (還缺 {8 - loginPassword.length} 位)
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-[#FF6B57] to-[#FF8573] hover:opacity-95 text-white font-extrabold rounded-xl shadow-md text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <Sparkles size={15} />
              <span>確認登入帳戶</span>
            </button>
          </form>

          {/* 快速示範帳號點選 (方便測試 5 大角色) */}
          <div className="pt-2 border-t border-gray-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-gray-500">⚡ 5大身分示範帳號（點擊直接填入）：</span>
              <span className="text-[10px] text-gray-400">8位預設密碼</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {DEFAULT_DEMO_USERS.map((demo) => {
                const cfg = ROLE_CONFIGS[demo.role];
                return (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => handleQuickFillDemo(demo)}
                    className="text-left p-2 rounded-xl border border-gray-200 hover:border-[#FF6B57] hover:bg-orange-50/40 transition-all flex items-center gap-2 group"
                  >
                    <span className="text-lg">{cfg.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-gray-800 truncate group-hover:text-[#FF6B57]">
                        {cfg.label}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono truncate">
                        {demo.username} / {demo.password}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* 底部資訊 */}
        <div className="p-3 bg-gray-50 border-t border-gray-150 text-center shrink-0">
          <p className="text-[10px] text-gray-400">
            若遺失帳號或需重設密碼，請聯絡學校系統管理人員 · 密碼格式為 8 位純數字
          </p>
        </div>
      </div>
    </div>
  );
};
