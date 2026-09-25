import React, { useState } from 'react';
import {
  X, User, Lock, MapPin, Layers, Shield, GraduationCap,
  Users, Eye, EyeOff, CheckCircle2, AlertCircle,
  UserPlus, Sparkles, LogOut, Check
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
    desc: '全權管理系統設定、分校班別、全校課程與用戶',
    emoji: '👑'
  },
  teacher: {
    label: '導師',
    color: 'text-blue-700',
    bgLight: 'bg-blue-50 text-blue-700',
    border: 'border-blue-200',
    desc: '維護課程單元教材、發布單元家課、批改及發送通告',
    emoji: '👨‍🏫'
  },
  assistant: {
    label: '助教',
    color: 'text-emerald-700',
    bgLight: 'bg-emerald-50 text-emerald-700',
    border: 'border-emerald-200',
    desc: '執行課堂點名、核對學生功課繳交與協助導師教學',
    emoji: '🧑‍🏫'
  },
  student: {
    label: '學生',
    color: 'text-amber-700',
    bgLight: 'bg-amber-50 text-amber-700',
    border: 'border-amber-200',
    desc: '查閱所屬班級課程、下載單元教材與即時提交功課',
    emoji: '🎒'
  },
  parent: {
    label: '家長',
    color: 'text-rose-700',
    bgLight: 'bg-rose-50 text-rose-700',
    border: 'border-rose-200',
    desc: '掌握子女學習進度、出缺席記錄、家課完成狀況與學校通告',
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
  defaultTab?: 'login' | 'register';
  branches: string[];
  classes: string[];
  currentUser: UserProfile | null;
  usersList: UserProfile[];
  onLoginSuccess: (user: UserProfile) => void;
  onRegisterSuccess: (user: UserProfile) => void;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'login',
  branches = [],
  classes = [],
  currentUser,
  usersList = [],
  onLoginSuccess,
  onRegisterSuccess,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(defaultTab);

  // 登入表單狀態
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // 登記表單狀態
  const [regRole, setRegRole] = useState<UserRole>('teacher');
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBranch, setRegBranch] = useState('');
  const [regClass, setRegClass] = useState('');
  const [regChildName, setRegChildName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  React.useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, isOpen]);

  React.useEffect(() => {
    if (branches.length > 0 && !regBranch) {
      setRegBranch(branches[0]);
    }
  }, [branches]);

  React.useEffect(() => {
    if (classes.length > 0 && !regClass) {
      setRegClass(classes[0]);
    }
  }, [classes]);

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
      alert('⚠️ 密碼必需為 8 位純數字（例如：12345678）！');
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
      alert('❌ 登入失敗：帳號不存在或密碼錯誤（請確認密碼為正確的 8 位數字）！');
    }
  };

  // 快速示範帳號一鍵填入
  const handleQuickFillDemo = (demo: UserProfile) => {
    setLoginUsername(demo.username);
    setLoginPassword(demo.password);
  };

  // 登記送出處理
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = regName.trim();
    const uname = regUsername.trim();
    const pwd = regPassword.trim();
    const confirmPwd = regConfirmPassword.trim();

    if (!name) {
      alert('請輸入姓名或稱謂！');
      return;
    }
    if (!uname) {
      alert('請輸入登入帳號！');
      return;
    }

    // ⭐ 需求：密碼必需為要8位數字
    if (!is8DigitNumeric(pwd)) {
      alert('⚠️ 密碼必需為 8 位純數字（例如：12345678）！\n目前長度：' + pwd.length + ' 位');
      return;
    }

    if (pwd !== confirmPwd) {
      alert('⚠️ 兩次輸入的密碼不相符，請重新確認！');
      return;
    }

    // 檢查帳號是否重複
    const allUsers = [...usersList, ...DEFAULT_DEMO_USERS];
    if (allUsers.some((u) => u.username.toLowerCase() === uname.toLowerCase())) {
      alert('⚠️ 該帳號名稱已有人使用，請換一個帳號名稱！');
      return;
    }

    const newUser: UserProfile = {
      id: `user_${Date.now()}`,
      username: uname,
      name,
      role: regRole,
      password: pwd,
      phone: regPhone.trim() || undefined,
      branch: regBranch || (branches.length > 0 ? branches[0] : '全部分校'),
      className: regClass || (classes.length > 0 ? classes[0] : '未分班'),
      childName: regRole === 'parent' ? regChildName.trim() : undefined,
      createdAt: new Date().toISOString()
    };

    onRegisterSuccess(newUser);
    alert(`🎉 帳戶登記成功！歡迎 ${name}（${ROLE_CONFIGS[regRole].label}）開始使用！`);
    onClose();
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
              <h2 className="font-extrabold text-base leading-tight">Online Classroom 帳戶中心</h2>
              <p className="text-[11px] text-white/90">多角色身分識別 · 8位數字密碼安全驗證</p>
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

        {/* 分頁切換 (登入帳戶 vs 新用戶登記) */}
        <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'login'
                ? 'bg-white text-[#FF6B57] border-b-2 border-[#FF6B57]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User size={15} />
            <span>登入帳戶</span>
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'register'
                ? 'bg-white text-[#FF6B57] border-b-2 border-[#FF6B57]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus size={15} />
            <span>新用戶登記 (註冊)</span>
          </button>
        </div>

        {/* 內容滑動區 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* TAB 1: 登入帳戶 */}
          {activeTab === 'login' && (
            <div className="space-y-4">
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">登入帳號 (Username)</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="請輸入帳號 (例：admin 或 teacher_chen)"
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
                  <span>登入帳戶</span>
                </button>
              </form>

              {/* 快速示範帳號點選 (方便測試 5 大角色) */}
              <div className="pt-2 border-t border-gray-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-gray-500">⚡ 快速測試體驗（點擊一鍵填入）：</span>
                  <span className="text-[10px] text-gray-400">5大身分預設密碼</span>
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
          )}

          {/* TAB 2: 新用戶登記 (5大角色支援) */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* 1. 選擇身分角色 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  1. 選擇用戶身分角色 (5大角色)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(ROLE_CONFIGS) as UserRole[]).map((r) => {
                    const cfg = ROLE_CONFIGS[r];
                    const isSelected = regRole === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRegRole(r)}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-0.5 ${
                          isSelected
                            ? 'border-[#FF6B57] bg-orange-50/70 text-[#FF6B57] font-bold shadow-xs'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white font-medium'
                        }`}
                      >
                        <span className="text-base">{cfg.emoji}</span>
                        <span className="text-[11px]">{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5 bg-gray-50 p-2 rounded-lg border border-gray-150">
                  💡 <span className="font-bold text-gray-700">{ROLE_CONFIGS[regRole].label}權限：</span>
                  {ROLE_CONFIGS[regRole].desc}
                </p>
              </div>

              {/* 2. 基本資訊 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">姓名 / 稱謂</label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="例：陳大文"
                    className="w-full p-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] text-black font-semibold placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">登入帳號 (Username)</label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="英數帳號"
                    className="w-full p-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] text-black font-semibold placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* 3. 所屬學校與班別 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">所屬學校/分校</label>
                  <select
                    value={regBranch}
                    onChange={(e) => setRegBranch(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] text-black font-semibold bg-white"
                  >
                    {branches.length > 0 ? (
                      branches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))
                    ) : (
                      <option value="總校">總校</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">所屬班別</label>
                  <select
                    value={regClass}
                    onChange={(e) => setRegClass(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] text-black font-semibold bg-white"
                  >
                    {classes.length > 0 ? (
                      classes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))
                    ) : (
                      <option value="未分班">未分班</option>
                    )}
                  </select>
                </div>
              </div>

              {/* 家長專用：子女姓名 */}
              {regRole === 'parent' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    關聯子女姓名 (學童稱謂)
                  </label>
                  <input
                    type="text"
                    value={regChildName}
                    onChange={(e) => setRegChildName(e.target.value)}
                    placeholder="請輸入子女姓名 (例：陳小明)"
                    className="w-full p-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] text-black font-semibold placeholder:text-gray-400"
                  />
                </div>
              )}

              {/* 4. 8位純數字密碼 */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-700">
                    設定密碼 (⭐ 必需為8位數字)
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {regPassword.length}/8 位
                  </span>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={8}
                    pattern="[0-9]{8}"
                    value={regPassword}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setRegPassword(val);
                    }}
                    placeholder="請輸入8位純數字密碼 (例如：12345678)"
                    className="w-full pl-8 pr-9 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] text-black font-bold tracking-widest placeholder:tracking-normal placeholder:text-gray-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {regPassword.length > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-[10px]">
                    {regPassword.length === 8 ? (
                      <span className="text-emerald-600 flex items-center gap-0.5 font-bold">
                        <CheckCircle2 size={12} /> 符合8位純數字
                      </span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-0.5 font-medium">
                        <AlertCircle size={12} /> 還需輸入 {8 - regPassword.length} 位純數字
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 5. 確認8位數字密碼 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  確認密碼 (再輸入一次8位數字)
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={8}
                    pattern="[0-9]{8}"
                    value={regConfirmPassword}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setRegConfirmPassword(val);
                    }}
                    placeholder="再次輸入8位純數字密碼"
                    className="w-full pl-8 pr-9 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] text-black font-bold tracking-widest placeholder:tracking-normal placeholder:text-gray-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showRegConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {regConfirmPassword.length > 0 && (
                  <div className="mt-1 text-[10px]">
                    {regPassword === regConfirmPassword && regConfirmPassword.length === 8 ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                        <CheckCircle2 size={12} /> 密碼相符且符合8位數字
                      </span>
                    ) : (
                      <span className="text-red-500 font-bold flex items-center gap-0.5">
                        <AlertCircle size={12} /> 密碼不相符或未滿8位數字
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-[#FF6B57] to-[#FF8573] hover:opacity-95 text-white font-extrabold rounded-xl shadow-md text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <UserPlus size={15} />
                <span>立即登記並登入</span>
              </button>
            </form>
          )}

        </div>

        {/* 底部資訊 */}
        <div className="p-3 bg-gray-50 border-t border-gray-150 text-center shrink-0">
          <p className="text-[10px] text-gray-400">
            Online Classroom 安全驗證體系 · 密碼格式必須為 8 位純數字 (0-9)
          </p>
        </div>
      </div>
    </div>
  );
};
