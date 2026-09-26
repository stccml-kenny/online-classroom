import React, { useState, useEffect } from 'react';
import {
  X, User, Lock, Phone, MapPin, Layers, Shield, GraduationCap,
  Users, Eye, EyeOff, CheckCircle2, AlertCircle,
  UserPlus, Sparkles, LogOut, Check, Search, Filter, Trash2,
  RotateCcw, Copy, Edit2, KeyRound, Download, UploadCloud,
  FileSpreadsheet, CheckCircle, Plus
} from 'lucide-react';
import { UserProfile, UserRole, ROLE_CONFIGS, is8DigitNumeric, DEFAULT_DEMO_USERS } from '@/components/auth/AuthModal';
import { parseBranchInfo } from '@/components/homework/HomeworkSetupModal';
import { databases, DATABASE_ID } from '@/lib/appwrite';
import { ID, Query } from 'appwrite';

interface AccountManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: string[];
  classes: string[];
  currentUser: UserProfile | null;
  usersList: UserProfile[];
  onUpdateUsersList: (newUsers: UserProfile[]) => void;
}

const DUMMY_USERNAMES = ['teacher_chen', 'ta_wong', 'student_lok', 'parent_lok'];

export const AccountManagementModal: React.FC<AccountManagementModalProps> = ({
  isOpen,
  onClose,
  branches = [],
  classes = [],
  currentUser,
  usersList = [],
  onUpdateUsersList
}) => {
  const [activeTab, setActiveTab] = useState<'issue' | 'excel' | 'list'>('issue');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  // 派發新帳戶單筆表單
  const [role, setRole] = useState<UserRole>('student');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  // ⭐ 需求 5：不要預設初始密碼 (留空讓管理員輸入或隨機產生)
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  // 只有學生帳戶需要所屬分校與班別
  const [branch, setBranch] = useState(branches[0] || '總校');
  const [className, setClassName] = useState(classes[0] || '未分班');

  // ⭐ 需求 4：家長帳戶可關聯多於一個學生，關聯子女登入帳號取代關聯子女姓名
  const [linkedChildrenUsernames, setLinkedChildrenUsernames] = useState<string[]>([]);
  const [selectedStudentToLink, setSelectedStudentToLink] = useState('');
  const [customChildUsernameInput, setCustomChildUsernameInput] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [lastIssuedUser, setLastIssuedUser] = useState<UserProfile | null>(null);

  // 密碼重設彈窗或狀態 (不要預設密碼)
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // Excel / CSV 批次匯入狀態
  const [parsedRows, setParsedRows] = useState<UserProfile[]>([]);
  const [uploading, setUploading] = useState(false);

  // ⭐ 需求：除了 admin 總管理員之外，移除所有 dummy 示範帳號
  const cleanUsersList = React.useMemo(() => {
    return usersList.filter(
      (u) => !DUMMY_USERNAMES.includes((u.username || '').toLowerCase())
    );
  }, [usersList]);

  // 顯示所有帳號（含唯一預設 admin 與已派發帳號）
  const allAccounts = React.useMemo(() => {
    const list = [...cleanUsersList];
    DEFAULT_DEMO_USERS.forEach((demo) => {
      if (!list.some((u) => u.username.toLowerCase() === demo.username.toLowerCase())) {
        list.push(demo);
      }
    });
    return list;
  }, [cleanUsersList]);

  // 若偵測到傳入的 usersList 中含有舊 dummy 帳號，自動觸發清理
  useEffect(() => {
    if (usersList.some((u) => DUMMY_USERNAMES.includes((u.username || '').toLowerCase()))) {
      const sanitized = usersList.filter(
        (u) => !DUMMY_USERNAMES.includes((u.username || '').toLowerCase())
      );
      onUpdateUsersList(sanitized);
    }
  }, [usersList, onUpdateUsersList]);

  // 當分校清單載入且未設定分校時，預設第一間分校
  useEffect(() => {
    if (branches.length > 0 && !branch) {
      setBranch(branches[0]);
    }
    if (classes.length > 0 && !className) {
      setClassName(classes[0]);
    }
  }, [branches, classes, branch, className]);

  if (!isOpen) return null;

  // 依當前選擇的學校解析學校代號
  const currentSchoolInfo = parseBranchInfo(branch);
  const currentSchoolCode = currentSchoolInfo.code;

  // 產生 8 位隨機純數字密碼
  const handleGenerateRandomPassword = () => {
    let rand = '';
    for (let i = 0; i < 8; i++) {
      rand += Math.floor(Math.random() * 10).toString();
    }
    setPassword(rand);
  };

  // 家長手動加入子女帳號
  const handleAddCustomChild = () => {
    const val = customChildUsernameInput.trim();
    if (!val) return;
    if (linkedChildrenUsernames.includes(val)) {
      alert(`子女帳號「${val}」已在關聯清單中！`);
      return;
    }
    setLinkedChildrenUsernames([...linkedChildrenUsernames, val]);
    setCustomChildUsernameInput('');
  };

  // 1. 單筆派發新帳戶
  const handleIssueAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const rawUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedName) {
      alert('請輸入用戶姓名或稱謂！');
      return;
    }
    if (!rawUsername) {
      alert('請輸入登入帳號！');
      return;
    }

    // ⭐ 需求 3：建立學生帳戶時學校代號放在登入帳號最前
    let finalUsername = rawUsername;
    if (role === 'student' && currentSchoolCode) {
      const prefix = `${currentSchoolCode}_`.toLowerCase();
      if (finalUsername.toLowerCase().startsWith(prefix)) {
        finalUsername = `${currentSchoolCode}_${finalUsername.slice(prefix.length)}`;
      } else {
        finalUsername = `${currentSchoolCode}_${finalUsername}`;
      }
    }

    // ⭐ 需求 5：不要預設初始密碼，檢查必須填入且為 8 位純數字
    if (!trimmedPassword) {
      alert('請輸入 8 位純數字密碼，或點擊右上角「隨機產生」！');
      return;
    }
    if (!is8DigitNumeric(trimmedPassword)) {
      alert('⚠️ 密碼必需為嚴格 8 位純數字（例如：12345678）！');
      return;
    }

    // 檢查帳號是否重複
    if (allAccounts.some((u) => u.username.toLowerCase() === finalUsername.toLowerCase())) {
      alert(`⚠️ 帳號「${finalUsername}」已存在，請更換另一個帳號名稱！`);
      return;
    }

    // ⭐ 需求 1：只有學生帳戶需要選取學校及班別
    const finalBranch = role === 'student' ? (branch || (branches.length > 0 ? branches[0] : '總校')) : undefined;
    const finalClass = role === 'student' ? (className || (classes.length > 0 ? classes[0] : '未分班')) : undefined;

    // ⭐ 需求 4：家長帳戶關聯子女帳號清單
    const finalChildrenUsernames = role === 'parent' ? linkedChildrenUsernames : undefined;

    const newUser: UserProfile = {
      id: `user_${Date.now()}`,
      username: finalUsername,
      name: trimmedName,
      role,
      password: trimmedPassword,
      phone: phone.trim() || undefined,
      branch: finalBranch,
      className: finalClass,
      childrenUsernames: finalChildrenUsernames,
      createdAt: new Date().toISOString()
    };

    const updated = [newUser, ...cleanUsersList];
    onUpdateUsersList(updated);
    setLastIssuedUser(newUser);

    // ⭐ 需求：帳戶名冊內的學生帳戶要同時間關聯會員目錄中的會員
    // 當增加學生帳戶時，同步在會員目錄 (students 表) 中建立相對應的會員記錄
    if (role === 'student') {
      const studentMemberDoc = {
        $id: `stu_${Date.now()}`,
        branch: finalBranch || '',
        class_name: finalClass || '',
        course_name: '',
        student_name: trimmedName,
      };

      try {
        const cached = localStorage.getItem('oc_local_students');
        const list = cached ? JSON.parse(cached) : [];
        list.unshift(studentMemberDoc);
        localStorage.setItem('oc_local_students', JSON.stringify(list));
      } catch (e) {}

      try {
        databases.createDocument(DATABASE_ID, 'students', ID.unique(), {
          branch: finalBranch || '',
          class_name: finalClass || '',
          course_name: '',
          student_name: trimmedName,
        }).catch((err: any) => console.warn('同步寫入雲端 students 表略過:', err.message));
      } catch (err: any) {
        console.warn('同步建立會員目錄記錄略過:', err.message);
      }
    }

    // 清空表單 (⭐ 密碼清空，不預設初始密碼)
    setName('');
    setUsername('');
    setPhone('');
    setPassword('');
    setLinkedChildrenUsernames([]);
    setSelectedStudentToLink('');
    setCustomChildUsernameInput('');

    alert(`✅ 成功派發新帳戶！\n姓名：${newUser.name}\n身分：${ROLE_CONFIGS[newUser.role]?.label || newUser.role}\n帳號：${newUser.username}\n密碼：${newUser.password}`);
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
    const updated = cleanUsersList.filter((u) => u.username !== targetUser.username);
    onUpdateUsersList(updated);

    // ⭐ 需求：當刪除帳戶名冊內的學生帳戶時，同步刪除會員目錄中相對的會員記錄
    if (targetUser.role === 'student') {
      // 1. 同步清理本機快取
      try {
        const cached = localStorage.getItem('oc_local_students');
        if (cached) {
          const list = JSON.parse(cached);
          const remaining = list.filter((s: any) => s.student_name !== targetUser.name);
          localStorage.setItem('oc_local_students', JSON.stringify(remaining));
        }
      } catch (e) {}

      // 2. 同步刪除 Appwrite students 表中的紀錄
      try {
        databases.listDocuments(DATABASE_ID, 'students', [Query.limit(500)]).then((res) => {
          const docsToDelete = res.documents.filter(
            (d: any) => d.student_name === targetUser.name
          );
          docsToDelete.forEach((doc) => {
            databases.deleteDocument(DATABASE_ID, 'students', doc.$id).catch(() => {});
          });
        }).catch((err) => console.warn('查詢欲刪除的學生記錄略過:', err.message));
      } catch (err: any) {
        console.warn('同步刪除會員目錄記錄略過:', err.message);
      }
    }
  };

  // 重設 8 位密碼
  const handleConfirmResetPassword = (targetUser: UserProfile) => {
    const pwd = newResetPassword.trim();
    if (!pwd) {
      alert('請輸入新密碼（必需為 8 位純數字）！');
      return;
    }
    if (!is8DigitNumeric(pwd)) {
      alert('⚠️ 重設密碼必需為 8 位純數字（例如：12345678）！');
      return;
    }
    const updated = cleanUsersList.map((u) => {
      if (u.username === targetUser.username) {
        return { ...u, password: pwd };
      }
      return u;
    });
    if (!cleanUsersList.some((u) => u.username === targetUser.username)) {
      updated.push({ ...targetUser, password: pwd });
    }
    onUpdateUsersList(updated);
    setResettingUserId(null);
    setNewResetPassword('');
    alert(`✅ 帳號「${targetUser.username}」的密碼已成功重設為：${pwd}`);
  };

  // 複製派發憑證
  const handleCopyCredentials = (u: UserProfile) => {
    let detailLines = '';
    if (u.role === 'student') {
      detailLines = `\n所屬學校：${u.branch || '總校'} / 班別：${u.className || '全校'}`;
    } else if (u.role === 'parent' && u.childrenUsernames && u.childrenUsernames.length > 0) {
      detailLines = `\n關聯子女帳號：${u.childrenUsernames.join(', ')}`;
    }

    const text = `【Online Classroom 帳戶派發通知】\n姓名：${u.name}\n身分：${ROLE_CONFIGS[u.role]?.label || u.role}\n登入帳號：${u.username}\n登入密碼：${u.password}${detailLines}\n（請妥善保管您的帳戶，登入後即可查閱專屬課程教材與單元家課）`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      alert('📋 帳戶派發資訊已成功複製至剪貼簿！可直接貼上發送給用戶。');
    } else {
      alert(text);
    }
  };

  // ⭐ 需求：匯出帳戶名冊為 Excel / CSV 格式
  const handleExportAccountsCSV = () => {
    if (allAccounts.length === 0) {
      alert('目前尚無帳戶資料可供匯出！');
      return;
    }
    const headers = ['身分', '身分代碼', '用戶姓名', '登入帳號', '8位數字密碼', '學校/分校', '班別', '聯絡電話', '關聯子女帳號', '建立時間'];
    const rows = allAccounts.map((u) => [
      `"${(ROLE_CONFIGS[u.role]?.label || u.role).replace(/"/g, '""')}"`,
      `"${u.role}"`,
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${(u.username || '').replace(/"/g, '""')}"`,
      `"\t${u.password}"`,
      `"${(u.branch || '').replace(/"/g, '""')}"`,
      `"${(u.className || '').replace(/"/g, '""')}"`,
      `"${(u.phone || '').replace(/"/g, '""')}"`,
      `"${(u.childrenUsernames ? u.childrenUsernames.join(';') : (u.childName || '')).replace(/"/g, '""')}"`,
      `"${(u.createdAt || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Online_Classroom_帳戶名冊_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // 下載 Excel / CSV 批次匯入空白範本
  const handleDownloadTemplate = () => {
    const headers = ['身分(學生/家長/導師/助教/管理員)', '用戶姓名', '登入帳號', '8位純數字密碼(選填)', '學校/分校(學生專用)', '班別(學生專用)', '聯絡電話(選填)', '關聯子女帳號(家長專用，多個用分號隔開)'];
    const sampleRows = [
      '學生,陳小明,101,12345678,沙田分校 (ST),1A,91234567,',
      '家長,陳家長,parent_101,12345678,,,,ST_101',
      '導師,張導師,teacher_zhang,12345678,,,92345678,',
      '助教,李助教,ta_lee,12345678,,,93456789,'
    ];
    const csvContent = '\uFEFF' + [headers.join(','), ...sampleRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '帳戶名冊批次匯入範本.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // 角色文字對應至標準 UserRole
  const parseRole = (raw: string): UserRole => {
    const s = (raw || '').toLowerCase().trim();
    if (s.includes('家長') || s.includes('parent')) return 'parent';
    if (s.includes('導師') || s.includes('老師') || s.includes('teacher')) return 'teacher';
    if (s.includes('助教') || s.includes('assistant') || s.includes('ta')) return 'assistant';
    if (s.includes('管理') || s.includes('admin')) return 'admin';
    return 'student';
  };

  // 處理 Excel/CSV 檔案選取與解析
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = (evt.target?.result as string) || '';
        const lines = text
          .split('\n')
          .map((line) => line.replace('\r', '').trim())
          .filter((line) => line.length > 0);

        if (lines.length === 0) {
          alert('上傳的檔案為空！');
          return;
        }

        const rows: UserProfile[] = [];
        const startIndex = lines[0].includes('姓名') || lines[0].includes('身分') || lines[0].includes('role') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
          const parts = lines[i].split(',').map((p) => p.trim().replace(/^["'\t]|["'\t]$/g, ''));
          if (parts.length >= 3) {
            const rawRole = parts[0];
            const parsedR = parseRole(rawRole);
            const uName = parts[1];
            let uUsername = parts[2];
            let uPassword = parts[3] ? parts[3].replace(/\D/g, '').slice(0, 8) : '';
            if (uPassword.length !== 8) {
              uPassword = uPassword.padEnd(8, '0');
              if (uPassword.length !== 8 || uPassword === '00000000') uPassword = '12345678';
            }

            // ⭐ 需求 1：只有學生帳戶需要學校及班別
            const uBranch = parsedR === 'student' ? (parts[4] || branches[0] || '總校') : undefined;
            const uClass = parsedR === 'student' ? (parts[5] || classes[0] || '全校') : undefined;
            const uPhone = parts[6] || undefined;

            // ⭐ 需求 3：學生帳戶自動將學校代號置於最前
            if (parsedR === 'student' && uBranch) {
              const code = parseBranchInfo(uBranch).code;
              if (code && !uUsername.toLowerCase().startsWith(`${code}_`.toLowerCase())) {
                uUsername = `${code}_${uUsername}`;
              }
            }

            // ⭐ 需求 4：家長帳戶多個子女登入帳號
            let uChildren: string[] | undefined = undefined;
            if (parsedR === 'parent' && parts[7]) {
              uChildren = parts[7].split(/[;、|]+/).map((x) => x.trim()).filter(Boolean);
            }

            if (uName && uUsername) {
              rows.push({
                id: `user_imp_${Date.now()}_${i}`,
                name: uName,
                username: uUsername,
                role: parsedR,
                password: uPassword,
                branch: uBranch,
                className: uClass,
                phone: uPhone,
                childrenUsernames: uChildren,
                createdAt: new Date().toISOString()
              });
            }
          }
        }

        if (rows.length === 0) {
          alert('未能識別檔案中的數據，請參考標準範本：身分,姓名,帳號,8位密碼,分校,班別,電話,關聯子女帳號');
          return;
        }

        setParsedRows(rows);
      } catch (err: any) {
        alert('解析檔案失敗：' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // 確認批次匯入
  const handleConfirmBatchImport = () => {
    if (parsedRows.length === 0) return;
    setUploading(true);

    const existingUsernames = new Set(allAccounts.map((u) => u.username.toLowerCase()));
    const validNewAccounts: UserProfile[] = [];
    let duplicateCount = 0;

    for (const row of parsedRows) {
      if (existingUsernames.has(row.username.toLowerCase())) {
        duplicateCount++;
      } else {
        existingUsernames.add(row.username.toLowerCase());
        validNewAccounts.push(row);
      }
    }

    if (validNewAccounts.length === 0) {
      alert(`⚠️ 檔案中全部 ${parsedRows.length} 個帳號名稱皆已存在於系統中，未匯入任何重複帳號。`);
      setUploading(false);
      return;
    }

    const updated = [...validNewAccounts, ...cleanUsersList];
    onUpdateUsersList(updated);
    setUploading(false);

    // ⭐ 需求：批次匯入帳戶時，同步將學生帳戶加入會員目錄 (students 表)
    const newStudentsToSync = validNewAccounts.filter((a) => a.role === 'student');
    if (newStudentsToSync.length > 0) {
      try {
        const cached = localStorage.getItem('oc_local_students');
        const list = cached ? JSON.parse(cached) : [];
        newStudentsToSync.forEach((acc, i) => {
          list.unshift({
            $id: `stu_imp_${Date.now()}_${i}`,
            branch: acc.branch || '',
            class_name: acc.className || '',
            course_name: '',
            student_name: acc.name,
          });
        });
        localStorage.setItem('oc_local_students', JSON.stringify(list));
      } catch (e) {}

      newStudentsToSync.forEach((acc) => {
        try {
          databases.createDocument(DATABASE_ID, 'students', ID.unique(), {
            branch: acc.branch || '',
            class_name: acc.className || '',
            course_name: '',
            student_name: acc.name,
          }).catch((err: any) => console.warn('批次同步雲端 students 略過:', err.message));
        } catch (e) {}
      });
    }

    alert(`🎉 批次匯入完成！成功建立 ${validNewAccounts.length} 個新帳戶${duplicateCount > 0 ? `（略過 ${duplicateCount} 個重複帳號）` : ''}。`);
    setParsedRows([]);
    setActiveTab('list');
  };

  // 篩選帳號清單
  const filteredAccounts = allAccounts.filter((u) => {
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = u.name.toLowerCase().includes(q);
      const matchUsername = u.username.toLowerCase().includes(q);
      const matchBranch = (u.branch || '').toLowerCase().includes(q);
      const matchChild = (u.childrenUsernames || []).some((cu) => cu.toLowerCase().includes(q));
      if (!matchName && !matchUsername && !matchBranch && !matchChild) return false;
    }
    return true;
  });

  return (
    // ⭐ 需求 6：帳戶管理與派發中心需滿板顯示 (fixed inset-0 w-full h-full bg-[#F8F9FA])
    <div className="fixed inset-0 z-50 bg-[#F8F9FA] flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
      <div className="w-full flex-1 flex flex-col overflow-hidden max-w-3xl mx-auto bg-white shadow-sm relative">
        
        {/* 頂部全寬標題列 */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 p-4 text-white flex justify-between items-center shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center text-lg shadow-inner">
              👑
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg leading-tight">帳戶管理與派發中心</h2>
              <p className="text-xs text-purple-200">系統管理人員專屬 · 統一派發 5 大身分帳號與管理名冊</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
            title="關閉"
          >
            <X size={20} />
          </button>
        </div>

        {/* 頂部功能切換 (1. 派發新帳戶 | 2. Excel 批次匯入 | 3. 已派發帳號名冊) */}
        <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
          <button
            onClick={() => setActiveTab('issue')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'issue'
                ? 'bg-white text-purple-700 border-b-2 border-purple-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus size={16} />
            <span>派發帳戶</span>
          </button>
          <button
            onClick={() => setActiveTab('excel')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'excel'
                ? 'bg-white text-purple-700 border-b-2 border-purple-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileSpreadsheet size={16} />
            <span>Excel 匯入</span>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'list'
                ? 'bg-white text-purple-700 border-b-2 border-purple-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} />
            <span>帳號名冊 ({allAccounts.length})</span>
          </button>
        </div>

        {/* 滿板內容滑動區 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* TAB 1: 單筆派發新帳戶表單 */}
          {activeTab === 'issue' && (
            <div className="space-y-4">
              <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 text-xs text-purple-900 flex items-start gap-2">
                <Sparkles size={16} className="text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">統一派發說明：</span>
                  管理員可在本中心為學生、家長、導師及助教建立帳戶並指派 8 位純數字密碼。
                </div>
              </div>

              <form onSubmit={handleIssueAccount} className="space-y-3.5">
                {/* 1. 選擇要派發的角色 */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    1. 選擇派發身分角色 (5大角色)
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(Object.keys(ROLE_CONFIGS) as UserRole[]).map((r) => {
                      const cfg = ROLE_CONFIGS[r];
                      const isSelected = role === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`p-2 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                            isSelected
                              ? 'border-purple-600 bg-purple-100/70 text-purple-900 font-extrabold shadow-xs'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white font-medium'
                          }`}
                        >
                          <span className="text-xl">{cfg.emoji}</span>
                          <span className="text-xs leading-tight truncate w-full">{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. 基本資訊：用戶姓名 */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    用戶姓名 / 稱謂 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="例：陳小明、張導師、陳家長"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-600 text-black font-semibold placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* ⭐ 需求 1：只有學生帳戶需要選取學校及班別 */}
                {role === 'student' && (
                  <div className="p-3.5 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-3">
                    <div className="text-xs font-bold text-purple-950 flex items-center gap-1">
                      <GraduationCap size={15} className="text-purple-600" />
                      <span>學生就讀學校與班別 (必填)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          所屬學校/分校 <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          className="w-full p-2.5 border border-purple-200 rounded-xl text-xs outline-none focus:border-purple-600 text-black font-semibold bg-white"
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
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          所屬班別 <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={className}
                          onChange={(e) => setClassName(e.target.value)}
                          className="w-full p-2.5 border border-purple-200 rounded-xl text-xs outline-none focus:border-purple-600 text-black font-semibold bg-white"
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
                  </div>
                )}

                {/* ⭐ 需求 3：建立學生帳戶時學校代號放在登入帳號最前 */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-gray-700">
                      登入帳號 (Username) <span className="text-red-500">*</span>
                    </label>
                    {role === 'student' && currentSchoolCode && (
                      <span className="text-[10px] text-purple-700 font-bold font-mono bg-purple-100 px-2 py-0.5 rounded-full">
                        學校代號：{currentSchoolCode} (將置於帳號最前)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center">
                    {role === 'student' && currentSchoolCode ? (
                      <span className="px-3 py-2.5 bg-purple-100 border border-r-0 border-gray-200 rounded-l-xl text-xs font-mono font-bold text-purple-800 shrink-0">
                        {currentSchoolCode}_
                      </span>
                    ) : null}
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={
                        role === 'student' && currentSchoolCode
                          ? `輸入學生帳號 (例如: 101 或 lok)`
                          : '英數字帳號 (例: admin、teacher_chen)'
                      }
                      className={`w-full p-2.5 border border-gray-200 ${
                        role === 'student' && currentSchoolCode ? 'rounded-r-xl' : 'rounded-xl'
                      } text-xs outline-none focus:border-purple-600 text-black font-semibold placeholder:text-gray-400`}
                    />
                  </div>

                  {role === 'student' && currentSchoolCode && username.trim() && (
                    <p className="text-[11px] text-purple-700 mt-1 font-mono">
                      完整學生登入帳號：<span className="font-bold text-black">{currentSchoolCode}_{username.trim().replace(new RegExp(`^${currentSchoolCode}_`, 'i'), '')}</span>
                    </p>
                  )}
                </div>

                {/* ⭐ 需求 4：家長帳戶可關聯多於一個學生，關聯子女登入帳號取代關聯子女姓名 */}
                {role === 'parent' && (
                  <div className="space-y-2.5 bg-rose-50/60 p-3.5 rounded-2xl border border-rose-200">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-rose-950 flex items-center gap-1">
                        <span>👨‍👩‍👧 關聯子女學生登入帳號</span>
                        <span className="text-[10px] text-rose-600 font-normal">(可關聯多於一個學生)</span>
                      </label>
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                        已關聯 {linkedChildrenUsernames.length} 位學生
                      </span>
                    </div>

                    {/* 下拉選單挑選現有學生 */}
                    <div className="space-y-1">
                      <span className="text-[11px] text-gray-500 block">從現有學生名冊快速揀選：</span>
                      <select
                        value={selectedStudentToLink}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && !linkedChildrenUsernames.includes(val)) {
                            setLinkedChildrenUsernames([...linkedChildrenUsernames, val]);
                          }
                          setSelectedStudentToLink('');
                        }}
                        className="w-full p-2 bg-white border border-rose-200 rounded-xl text-xs outline-none focus:border-rose-500 font-semibold"
                      >
                        <option value="">-- 點此挑選已建立之學生帳號加入關聯 --</option>
                        {allAccounts
                          .filter((u) => u.role === 'student')
                          .map((stu) => (
                            <option key={stu.username} value={stu.username}>
                              {stu.name} (帳號: {stu.username}{stu.branch ? ` · ${stu.branch}` : ''}{stu.className ? ` · ${stu.className}` : ''})
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* 手動輸入子女學生帳號 */}
                    <div className="space-y-1 pt-1 border-t border-rose-100">
                      <span className="text-[11px] text-gray-500 block">或直接手動輸入子女登入帳號：</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customChildUsernameInput}
                          onChange={(e) => setCustomChildUsernameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomChild();
                            }
                          }}
                          placeholder="輸入子女帳號 (例如: ST_lok，按加入)"
                          className="flex-1 p-2 bg-white border border-rose-200 rounded-xl text-xs outline-none focus:border-rose-500 font-semibold placeholder:text-gray-400 font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomChild}
                          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-2xs"
                        >
                          加入
                        </button>
                      </div>
                    </div>

                    {/* 已關聯的子女帳號標籤 */}
                    {linkedChildrenUsernames.length > 0 && (
                      <div className="pt-1.5 space-y-1">
                        <span className="text-[11px] font-bold text-rose-900 block">已關聯子女帳號：</span>
                        <div className="flex flex-wrap gap-1.5">
                          {linkedChildrenUsernames.map((u) => {
                            const matchedStudent = allAccounts.find((a) => a.username.toLowerCase() === u.toLowerCase());
                            return (
                              <span
                                key={u}
                                className="bg-white text-rose-800 border border-rose-300 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                              >
                                <span>🎒 {matchedStudent ? `${matchedStudent.name} (${u})` : u}</span>
                                <button
                                  type="button"
                                  onClick={() => setLinkedChildrenUsernames(linkedChildrenUsernames.filter((x) => x !== u))}
                                  className="text-rose-400 hover:text-red-600 font-bold text-sm leading-none ml-1"
                                  title="移除關聯"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 聯絡電話 */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">聯絡電話 (選填)</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="例：91234567"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-600 text-black font-semibold placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* ⭐ 需求 5：不要預設初始密碼 (留空，支援隨機產生或手動輸入) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-gray-700">
                      8位純數字密碼 <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomPassword}
                      className="text-xs text-purple-600 font-bold hover:underline flex items-center gap-0.5"
                    >
                      <RotateCcw size={12} /> 隨機產生 8 位數字
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
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
                      placeholder="請輸入 8 位純數字密碼 (或點右上角隨機產生)"
                      className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-600 text-black font-bold tracking-widest font-mono placeholder:tracking-normal placeholder:font-normal placeholder:text-gray-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="mt-1 text-[11px]">
                    {password.length === 8 ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 size={13} /> 符合 8 位純數字規範
                      </span>
                    ) : (
                      <span className="text-amber-600 font-medium flex items-center gap-1">
                        <AlertCircle size={13} /> 必需輸入滿 8 位純數字 (目前 {password.length}/8 位)
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:opacity-95 text-white font-extrabold rounded-2xl shadow-md text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99] mt-2"
                >
                  <UserPlus size={16} />
                  <span>確認派發此帳戶</span>
                </button>
              </form>

              {/* 最近一次派發的帳戶卡片 (方便快速複製) */}
              {lastIssuedUser && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      剛成功派發帳戶
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCredentials(lastIssuedUser)}
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-700 shadow-2xs"
                    >
                      <Copy size={12} /> 複製通知文字
                    </button>
                  </div>
                  <div className="text-xs text-emerald-950 font-mono space-y-1">
                    <div>姓名：{lastIssuedUser.name} ({ROLE_CONFIGS[lastIssuedUser.role]?.label || lastIssuedUser.role})</div>
                    <div>帳號：<span className="font-bold text-black">{lastIssuedUser.username}</span></div>
                    <div>密碼：<span className="font-bold text-purple-700">{lastIssuedUser.password}</span> (8位純數字)</div>
                    {lastIssuedUser.branch && <div>學校：{lastIssuedUser.branch} · 班別：{lastIssuedUser.className || '全校'}</div>}
                    {lastIssuedUser.childrenUsernames && lastIssuedUser.childrenUsernames.length > 0 && (
                      <div>關聯子女帳號：{lastIssuedUser.childrenUsernames.join(', ')}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Excel / CSV 批次匯入帳戶 */}
          {activeTab === 'excel' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-800">批次建立學生、家長、導師與助教帳號</span>
                <button
                  onClick={handleDownloadTemplate}
                  className="text-xs text-purple-700 hover:text-purple-900 flex items-center gap-1 font-bold bg-purple-50 px-2.5 py-1.5 rounded-xl border border-purple-200"
                >
                  <Download size={13} /> 下載 Excel/CSV 空白範本
                </button>
              </div>

              <label className="border-2 border-dashed border-purple-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:border-purple-500 bg-purple-50/40 cursor-pointer transition-colors">
                <div className="p-3 bg-purple-100 text-purple-700 rounded-full">
                  <UploadCloud size={26} />
                </div>
                <div className="text-xs font-bold text-gray-800 text-center">
                  點擊選擇或拖曳 Excel (.xlsx) / CSV 檔案至此
                </div>
                <div className="text-[11px] text-gray-500 text-center leading-relaxed">
                  格式：身分, 姓名, 帳號, 8位密碼, 學校, 班別, 電話, 關聯子女帳號<br />
                  （學生帳號會自動補齊學校代號，密碼支援 8 位純數字）
                </div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {parsedRows.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle size={14} /> 待匯入名單（共 {parsedRows.length} 個帳號）：
                    </span>
                    <button
                      onClick={() => setParsedRows([])}
                      className="text-gray-400 hover:text-gray-600 text-xs"
                    >
                      清空
                    </button>
                  </div>

                  <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl bg-gray-50 divide-y divide-gray-200 text-xs">
                    {parsedRows.map((r, idx) => {
                      const cfg = ROLE_CONFIGS[r.role] || ROLE_CONFIGS.student;
                      return (
                        <div key={idx} className="p-2.5 flex justify-between items-center">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base">{cfg.emoji}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 font-bold text-gray-900 truncate">
                                <span>{r.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${cfg.bgLight}`}>
                                  {cfg.label}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-500 font-mono">
                                帳號: {r.username}
                                {r.branch ? ` · 學校: ${r.branch}` : ''}
                                {r.className ? ` · 班別: ${r.className}` : ''}
                                {r.childrenUsernames && r.childrenUsernames.length > 0 ? ` · 子女: ${r.childrenUsernames.join(';')}` : ''}
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-mono text-[11px] text-purple-700 font-bold shrink-0">
                            密碼: {r.password}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleConfirmBatchImport}
                    disabled={uploading}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-extrabold rounded-xl text-xs hover:opacity-95 shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Check size={16} />
                    <span>{uploading ? '正在建立帳號...' : `確認匯入 ${parsedRows.length} 個帳號`}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: 已派發帳號名冊列表 */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {/* 頂部操作：搜尋與匯出按鈕 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜尋帳號、姓名、分校、子女帳號..."
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-600 placeholder:text-gray-400"
                    />
                  </div>
                  {/* Excel 匯出按鈕 */}
                  <button
                    type="button"
                    onClick={handleExportAccountsCSV}
                    className="flex items-center gap-1 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-2 rounded-xl font-bold transition-colors shadow-2xs shrink-0"
                    title="匯出為 Excel/CSV 檔案"
                  >
                    <Download size={13} />
                    <span>匯出名冊</span>
                  </button>
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
                              title="複製帳號與密碼通知"
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
                          {u.role === 'student' && (
                            <>
                              <span>學校：{u.branch || '總校'}</span>
                              <span>班別：{u.className || '全校'}</span>
                            </>
                          )}
                          {u.role === 'parent' && (
                            <span>
                              關聯子女帳號：{u.childrenUsernames && u.childrenUsernames.length > 0 ? u.childrenUsernames.join(', ') : (u.childName || '未關聯')}
                            </span>
                          )}
                          {u.phone && <span>電話：{u.phone}</span>}
                          <span className="font-mono text-purple-700 font-bold ml-auto">
                            密碼：{u.password}
                          </span>
                        </div>

                        {/* 重設密碼展開列 (不預設密碼) */}
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
                                placeholder="請輸入新 8 位純數字"
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
