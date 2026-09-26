import React, { useState } from 'react';
import {
  X, User, Lock, Phone, MapPin, Layers, Shield, GraduationCap,
  Users, Eye, EyeOff, CheckCircle2, AlertCircle,
  UserPlus, Sparkles, LogOut, Check, Search, Filter, Trash2,
  RotateCcw, Copy, Edit2, KeyRound
} from 'lucide-react';
import { UserProfile, UserRole, ROLE_CONFIGS, is8DigitNumeric, DEFAULT_DEMO_USERS } from '@/components/auth/AuthModal';

interface AccountManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: string[];
  classes: string[];
  currentUser: UserProfile | null;
  usersList: UserProfile[];
  onUpdateUsersList: (newUsers: UserProfile[]) => void;
}

export const AccountManagementModal: React.FC<AccountManagementModalProps> = ({
  isOpen,
  onClose,
  branches = [],
  classes = [],
  currentUser,
  usersList = [],
  onUpdateUsersList
}) => {
  const [activeTab, setActiveTab] = useState<'issue' | 'list'>('issue');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  // 派發新帳戶表單
  const [role, setRole] = useState<UserRole>('student');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('12345678');
  const [phone, setPhone] = useState('');
  const [branch, setBranch] = useState(branches[0] || '總校');
  const [className, setClassName] = useState(classes[0] || '未分班');
  const [childName, setChildName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [lastIssuedUser, setLastIssuedUser] = useState<UserProfile | null>(null);

  // 密碼重設彈窗或狀態
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // 顯示所有帳號（含預設帳號與自訂派發帳號）
  const allAccounts = React.useMemo(() => {
    const list = [...usersList];
    DEFAULT_DEMO_USERS.forEach((demo) => {
      if (!list.some((u) => u.username.toLowerCase() === demo.username.toLowerCase())) {
        list.push(demo);
      }
    });
    return list;
  }, [usersList]);

  if (!isOpen) return null;

  // 產生 8 位隨機純數字密碼
  const handleGenerateRandomPassword = () => {
    let rand = '';
    for (let i = 0; i < 8; i++) {
      rand += Math.floor(Math.random() * 10).toString();
    }
    setPassword(rand);
  };

  // 送出派發新帳戶
  const handleIssueAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedName) {
      alert('請輸入用戶姓名或稱謂！');
      return;
    }
    if (!trimmedUsername) {
      alert('請輸入登入帳號！');
      return;
    }

    // ⭐ 需求：密碼必需為要8位數字
    if (!is8DigitNumeric(trimmedPassword)) {
      alert('⚠️ 密碼必需為嚴格 8 位純數字（例如：12345678）！');
      return;
    }

    // 檢查帳號是否重複
    if (allAccounts.some((u) => u.username.toLowerCase() === trimmedUsername.toLowerCase())) {
      alert(`⚠️ 帳號「${trimmedUsername}」已存在，請更換另一個帳號名稱！`);
      return;
    }

    const newUser: UserProfile = {
      id: `user_${Date.now()}`,
      username: trimmedUsername,
      name: trimmedName,
      role,
      password: trimmedPassword,
      phone: phone.trim() || undefined,
      branch: branch || (branches.length > 0 ? branches[0] : '全部分校'),
      className: className || (classes.length > 0 ? classes[0] : '全體班別'),
      childName: role === 'parent' ? childName.trim() : undefined,
      createdAt: new Date().toISOString()
    };

    const updated = [newUser, ...usersList];
    onUpdateUsersList(updated);
    setLastIssuedUser(newUser);

    // 清空表單
    setName('');
    setUsername('');
    setPhone('');
    setChildName('');
    setPassword('12345678');

    alert(`✅ 成功派發新帳戶！
姓名：${newUser.name}
身分：${ROLE_CONFIGS[newUser.role].label}
帳號：${newUser.username}
密碼：${newUser.password}`);
  };

  // 刪除帳戶
  const handleDeleteAccount = (targetUser: UserProfile) => {
    if (targetUser.username === 'admin') {
      alert('⚠️ 總管理員帳號不可刪除！');
      return;
    }
    if (!window.confirm(`確定要刪除帳號「${targetUser.username}」(${targetUser.name}) 嗎？`)) {
      return;
    }
    const updated = usersList.filter((u) => u.username !== targetUser.username);
    onUpdateUsersList(updated);
  };

  // 重設密碼
  const handleConfirmResetPassword = (targetUser: UserProfile) => {
    const pwd = newResetPassword.trim();
    if (!is8DigitNumeric(pwd)) {
      alert('⚠️ 重設密碼必需為 8 位純數字（例如：12345678）！');
      return;
    }
    const updated = usersList.map((u) => {
      if (u.username === targetUser.username) {
        return { ...u, password: pwd };
      }
      return u;
    });
    // 若原屬於 demo 帳號則加入到自訂清單覆蓋
    if (!usersList.some((u) => u.username === targetUser.username)) {
      updated.push({ ...targetUser, password: pwd });
    }
    onUpdateUsersList(updated);
    setResettingUserId(null);
    setNewResetPassword('');
    alert(`✅ 帳號「${targetUser.username}」的密碼已成功重設為：${pwd}`);
  };

  // 複製派發資訊
  const handleCopyCredentials = (u: UserProfile) => {
    const text = `【Online Classroom 帳戶派發通知】
姓名：${u.name}
身分：${ROLE_CONFIGS[u.role].label}
登入帳號：${u.username}
登入密碼：${u.password}
所屬分校：${u.branch || '總校'} / 班別：${u.className || '全校'}
（請妥善保管您的帳戶，登入後即可查閱專屬課程教材與單元家課）`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      alert('📋 帳戶派發資訊已成功複製至剪貼簿！可直接貼上發送給用戶。');
    } else {
      alert(text);
    }
  };

  // 篩選帳號清單
  const filteredAccounts = allAccounts.filter((u) => {
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = u.name.toLowerCase().includes(q);
      const matchUsername = u.username.toLowerCase().includes(q);
      const matchBranch = (u.branch || '').toLowerCase().includes(q);
      if (!matchName && !matchUsername && !matchBranch) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-150 animate-in fade-in duration-200">
        
        {/* 頂部標題 */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 p-4 text-white flex justify-between items-center shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg">
              👑
            </div>
            <div>
              <h2 className="font-extrabold text-base leading-tight">帳戶管理與派發中心</h2>
              <p className="text-[11px] text-purple-200">系統管理人員專屬 · 統一派發5大身分帳號</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 頂部功能切換 (派發新帳戶 vs 已派發帳號列表) */}
        <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
          <button
            onClick={() => setActiveTab('issue')}
            className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'issue'
                ? 'bg-white text-purple-700 border-b-2 border-purple-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus size={15} />
            <span>派發新帳戶</span>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'list'
                ? 'bg-white text-purple-700 border-b-2 border-purple-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={15} />
            <span>已派發帳號名冊 ({allAccounts.length})</span>
          </button>
        </div>

        {/* 內容滑動區 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* TAB 1: 派發新帳戶表單 */}
          {activeTab === 'issue' && (
            <div className="space-y-4">
              <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 text-xs text-purple-900 flex items-start gap-2">
                <Sparkles size={16} className="text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">統一派發說明：</span>
                  此 App 不設公開自行登記，所有學生、家長、導師及助教帳戶均由管理員在此建立並指派 8 位數字密碼。
                </div>
              </div>

              <form onSubmit={handleIssueAccount} className="space-y-3">
                {/* 1. 選擇要派發的角色 */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    1. 選擇派發身份角色 (5大角色)
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {(Object.keys(ROLE_CONFIGS) as UserRole[]).map((r) => {
                      const cfg = ROLE_CONFIGS[r];
                      const isSelected = role === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`p-1.5 rounded-xl border text-center transition-all flex flex-col items-center gap-0.5 ${
                            isSelected
                              ? 'border-purple-600 bg-purple-100/70 text-purple-800 font-extrabold shadow-xs'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white font-medium'
                          }`}
                        >
                          <span className="text-base">{cfg.emoji}</span>
                          <span className="text-[10px] leading-tight truncate w-full">{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. 基本資訊 */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">用戶姓名 / 稱謂</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="例：陳小明、張導師"
                      className="w-full p-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-600 text-black font-semibold placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">登入帳號 (Username)</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="英數字 (例: student_101)"
                      className="w-full p-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-600 text-black font-semibold placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* 3. 學校與班別指派 */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">所屬學校/分校</label>
                    <select
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-600 text-black font-semibold bg-white"
                    >
                      {branches.length > 0 ? (
                        branches.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))
                      ) : (
                        <option value="總校">總校</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">所屬班別</label>
                    <select
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-600 text-black font-semibold bg-white"
                    >
                      {classes.length > 0 ? (
                        classes.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))
                      ) : (
                        <option value="未分班">未分班</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* 家長專屬：關聯學童姓名 */}
                {role === 'parent' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      關聯子女姓名 (學童稱謂)
                    </label>
                    <input
                      type="text"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="例：陳小明"
                      className="w-full p-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-600 text-black font-semibold placeholder:text-gray-400"
                    />
                  </div>
                )}

                {/* 聯絡電話 */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">聯絡電話 (選填)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="例：91234567"
                    className="w-full p-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-600 text-black font-semibold placeholder:text-gray-400"
                  />
                </div>

                {/* 4. 8位純數字密碼 */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-gray-700">
                      初始密碼 (⭐ 必需為8位純數字)
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomPassword}
                      className="text-[10px] text-purple-600 font-bold hover:underline flex items-center gap-0.5"
                    >
                      <RotateCcw size={11} /> 隨機產生8位數字
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={8}
                      pattern="[0-9]{8}"
                      value={password}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                        setPassword(val);
                      }}
                      placeholder="輸入8位純數字密碼"
                      className="w-full pl-8 pr-9 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-600 text-black font-bold tracking-widest font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <div className="mt-1 text-[10px]">
                    {password.length === 8 ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                        <CheckCircle2 size={12} /> 符合8位純數字規定
                      </span>
                    ) : (
                      <span className="text-amber-600 font-medium flex items-center gap-0.5">
                        <AlertCircle size={12} /> 必需輸入滿 8 位純數字 (目前 {password.length}/8 位)
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-purple-700 to-indigo-700 hover:opacity-95 text-white font-extrabold rounded-xl shadow-md text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  <UserPlus size={15} />
                  <span>確認派發此帳戶</span>
                </button>
              </form>

              {/* 最近一次派發的帳戶卡片 (方便快速複製) */}
              {lastIssuedUser && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      剛成功派發帳戶
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCredentials(lastIssuedUser)}
                      className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-700 shadow-2xs"
                    >
                      <Copy size={11} /> 複製通知文字
                    </button>
                  </div>
                  <div className="text-[11px] text-emerald-950 font-mono space-y-0.5">
                    <div>姓名：{lastIssuedUser.name} ({ROLE_CONFIGS[lastIssuedUser.role].label})</div>
                    <div>帳號：<span className="font-bold text-black">{lastIssuedUser.username}</span></div>
                    <div>密碼：<span className="font-bold text-purple-700">{lastIssuedUser.password}</span> (8位數字)</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 已派發帳號名冊列表 */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {/* 搜尋與角色篩選 */}
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋帳號、姓名、分校..."
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-600 placeholder:text-gray-400"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                  <button
                    onClick={() => setFilterRole('all')}
                    className={`px-2.5 py-1 rounded-full font-bold shrink-0 transition-colors ${
                      filterRole === 'all'
                        ? 'bg-purple-700 text-white shadow-2xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    全部 ({allAccounts.length})
                  </button>
                  {(Object.keys(ROLE_CONFIGS) as UserRole[]).map((r) => {
                    const count = allAccounts.filter((u) => u.role === r).length;
                    const cfg = ROLE_CONFIGS[r];
                    return (
                      <button
                        key={r}
                        onClick={() => setFilterRole(r)}
                        className={`px-2 py-1 rounded-full font-bold shrink-0 transition-colors flex items-center gap-0.5 ${
                          filterRole === r
                            ? 'bg-purple-700 text-white shadow-2xs'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <span>{cfg.emoji}</span>
                        <span>{cfg.label} ({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 帳戶列表 */}
              <div className="space-y-2">
                {filteredAccounts.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    沒有找到符合條件的帳號記錄
                  </div>
                ) : (
                  filteredAccounts.map((u) => {
                    const cfg = ROLE_CONFIGS[u.role] || ROLE_CONFIGS.student;
                    const isResetting = resettingUserId === u.username;

                    return (
                      <div
                        key={u.username}
                        className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-2 text-xs hover:border-purple-300 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{cfg.emoji}</span>
                            <div>
                              <div className="font-extrabold text-gray-900 flex items-center gap-1.5">
                                <span>{u.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${cfg.bgLight}`}>
                                  {cfg.label}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-500 font-mono">
                                帳號：{u.username}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyCredentials(u)}
                              className="p-1.5 text-gray-400 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                              title="複製帳號與密碼"
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResettingUserId(isResetting ? null : u.username);
                                setNewResetPassword('');
                              }}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="重設8位數字密碼"
                            >
                              <KeyRound size={14} />
                            </button>
                            {u.username !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAccount(u)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="刪除帳戶"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500 pt-1 border-t border-gray-150">
                          <span>分校：{u.branch || '總校'}</span>
                          <span>班別：{u.className || '全校'}</span>
                          {u.childName && <span>子女：{u.childName}</span>}
                          {u.phone && <span>電話：{u.phone}</span>}
                          <span className="font-mono text-purple-700 font-bold ml-auto">
                            密碼：{u.password}
                          </span>
                        </div>

                        {/* 重設密碼展開列 */}
                        {isResetting && (
                          <div className="p-2.5 bg-white border border-indigo-200 rounded-xl space-y-1.5 mt-2">
                            <div className="text-[11px] font-bold text-indigo-900">
                              重設「{u.name}」的密碼 (必需為8位純數字)：
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={8}
                                pattern="[0-9]{8}"
                                value={newResetPassword}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                                  setNewResetPassword(val);
                                }}
                                placeholder="輸入新8位數字"
                                className="flex-1 p-1.5 border border-indigo-300 rounded-lg text-xs font-mono font-bold tracking-widest outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleConfirmResetPassword(u)}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                              >
                                儲存密碼
                              </button>
                              <button
                                type="button"
                                onClick={() => setResettingUserId(null)}
                                className="px-2 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>

        {/* 底部關閉按鈕 */}
        <div className="p-3 bg-gray-50 border-t border-gray-150 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-xs transition-colors"
          >
            完成並關閉
          </button>
        </div>
      </div>
    </div>
  );
};
