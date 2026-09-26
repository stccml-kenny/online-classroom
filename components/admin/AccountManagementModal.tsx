import React, { useState, useEffect } from 'react';
import {
  X, User, Lock, Phone, MapPin, Layers, Shield, GraduationCap,
  Users, Eye, EyeOff, CheckCircle2, AlertCircle,
  UserPlus, Sparkles, LogOut, Check, Search, Filter, Trash2,
  RotateCcw, Copy, Edit2, KeyRound, Download, UploadCloud,
  FileSpreadsheet, CheckCircle, Plus, CheckSquare, Sliders, Square
} from 'lucide-react';
import { UserProfile, UserRole, ROLE_CONFIGS, is8DigitNumeric, DEFAULT_DEMO_USERS } from '@/components/auth/AuthModal';
import { parseBranchInfo, CourseItem, getCourseDisplayName } from '@/components/homework/HomeworkSetupModal';
import { databases, DATABASE_ID } from '@/lib/appwrite';
import { ID, Query } from 'appwrite';

interface AccountManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: string[];
  classes: string[];
  courses?: (string | CourseItem)[];
  courseNames?: string[];
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
  courses = [],
  courseNames = [],
  currentUser,
  usersList = [],
  onUpdateUsersList
}) => {
  const [activeTab, setActiveTab] = useState<'issue' | 'excel' | 'list'>('issue');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterBranch, setFilterBranch] = useState<string>('all');

  // ⭐ 需求：帳戶名冊批次選擇、修改與刪除狀態
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [batchActionType, setBatchActionType] = useState<'branch' | 'class' | 'add_course' | 'remove_course' | 'password'>('branch');
  const [batchTargetBranch, setBatchTargetBranch] = useState<string>('');
  const [batchTargetClass, setBatchTargetClass] = useState<string>('');
  const [batchTargetCourse, setBatchTargetCourse] = useState<string>('');
  const [batchTargetPassword, setBatchTargetPassword] = useState<string>('12345678');
  const [batchProcessing, setBatchProcessing] = useState<boolean>(false);

  // 派發新帳戶單筆表單狀態
  const [role, setRole] = useState<UserRole>('student');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [branch, setBranch] = useState(branches[0] || '總校');
  const [className, setClassName] = useState(classes[0] || '未分班');

  // ⭐ 需求：參加課程 (Courses) 功能移送至帳戶中心
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [customCourseInput, setCustomCourseInput] = useState('');

  // 家長帳戶關聯多個子女帳號
  const [linkedChildrenUsernames, setLinkedChildrenUsernames] = useState<string[]>([]);
  const [selectedStudentToLink, setSelectedStudentToLink] = useState('');
  const [customChildUsernameInput, setCustomChildUsernameInput] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [lastIssuedUser, setLastIssuedUser] = useState<UserProfile | null>(null);

  // 密碼重設彈窗或狀態
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // ⭐ 需求 1：帳戶名冊可編輯帳戶
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('student');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editCourses, setEditCourses] = useState<string[]>([]);
  const [editCustomCourse, setEditCustomCourse] = useState('');
  const [editChildrenUsernames, setEditChildrenUsernames] = useState<string[]>([]);
  const [editStudentPicker, setEditStudentPicker] = useState('');
  const [editManualChildInput, setEditManualChildInput] = useState('');

  // 行內快速加選課程狀態
  const [quickAddCourseUserId, setQuickAddCourseUserId] = useState<string | null>(null);
  const [quickAddCourseSelected, setQuickAddCourseSelected] = useState('');

  // Excel / CSV 批次匯入狀態
  const [parsedRows, setParsedRows] = useState<UserProfile[]>([]);
  const [uploading, setUploading] = useState(false);

  // ⭐ 需求 1：讀取 database 之會員資料 (students 表) 並自動整合進帳戶名冊
  const [dbStudents, setDbStudents] = useState<any[]>([]);

  useEffect(() => {
    // 1. 優先從本地快取載入會員名冊
    try {
      const cached = localStorage.getItem('oc_local_students');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDbStudents(parsed);
        }
      }
    } catch (e) {}

    // 2. 雲端同步 Appwrite students 表
    const fetchStudentsCloud = async () => {
      try {
        const res = await databases.listDocuments(DATABASE_ID, 'students', [Query.limit(500)]);
        if (res.documents && res.documents.length > 0) {
          setDbStudents(res.documents);
          try {
            localStorage.setItem('oc_local_students', JSON.stringify(res.documents));
          } catch (e) {}
        }
      } catch (err: any) {
        console.warn('帳戶管理讀取 students 表:', err.message);
      }
    };
    fetchStudentsCloud();
  }, []);

  // 清除舊 dummy 帳號
  const cleanUsersList = React.useMemo(() => {
    return usersList.filter(
      (u) => !DUMMY_USERNAMES.includes((u.username || '').toLowerCase())
    );
  }, [usersList]);

  // ⭐ 需求 1：將 database 之會員自動合併進帳戶名冊，未派發帳號者自動生成標準帳號與8位密碼
  const allAccounts = React.useMemo(() => {
    const list = [...cleanUsersList];

    // 建立現有學生帳號索引 (以 分校 + 姓名 比對)
    const existingStudentKeys = new Set(
      cleanUsersList
        .filter((u) => u.role === 'student')
        .map((u) => `${(u.branch || '').toLowerCase()}___${(u.name || '').toLowerCase()}`)
    );

    // 彙整資料庫會員名冊 (students 表)
    const groupedDbMembers = new Map<string, {
      student_name: string;
      branch: string;
      class_name: string;
      courses: Set<string>;
    }>();

    dbStudents.forEach((doc: any) => {
      const sName = (doc.student_name || '').trim();
      const sBranch = (doc.branch || '').trim();
      const sClass = (doc.class_name || '').trim();
      if (!sName) return;

      const key = `${sBranch.toLowerCase()}___${sName.toLowerCase()}`;
      if (!groupedDbMembers.has(key)) {
        groupedDbMembers.set(key, {
          student_name: sName,
          branch: sBranch,
          class_name: sClass,
          courses: new Set<string>()
        });
      }
      if (doc.course_name && doc.course_name.trim()) {
        groupedDbMembers.get(key)!.courses.add(doc.course_name.trim());
      }
    });

    // 檢查是否有尚未在 cleanUsersList 中的資料庫會員，自動為其產生標準帳號
    let autoIndex = 101;
    groupedDbMembers.forEach((member, key) => {
      if (!existingStudentKeys.has(key)) {
        const code = parseBranchInfo(member.branch).code || 'ST';
        let autoUsername = `${code}_${autoIndex}`;
        while (list.some((u) => u.username.toLowerCase() === autoUsername.toLowerCase())) {
          autoIndex++;
          autoUsername = `${code}_${autoIndex}`;
        }
        autoIndex++;

        list.push({
          id: `user_db_${encodeURIComponent(key)}`,
          username: autoUsername,
          name: member.student_name,
          role: 'student',
          password: '12345678', // 預設 8 位數字密碼
          branch: member.branch || (branches[0] || '總校'),
          className: member.class_name || (classes[0] || '未分班'),
          enrolledCourses: Array.from(member.courses),
          createdAt: new Date().toISOString()
        });
      } else {
        // 若該學生已在 usersList 中，確保其 enrolledCourses 同步包含資料庫中的最新課程
        const idx = list.findIndex(
          (u) =>
            u.role === 'student' &&
            `${(u.branch || '').toLowerCase()}___${(u.name || '').toLowerCase()}` === key
        );
        if (idx !== -1) {
          const u = list[idx];
          const mergedCourses = Array.from(
            new Set([...(u.enrolledCourses || []), ...Array.from(member.courses)])
          );
          list[idx] = {
            ...u,
            branch: u.branch || member.branch,
            className: u.className || member.class_name,
            enrolledCourses: mergedCourses
          };
        }
      }
    });

    DEFAULT_DEMO_USERS.forEach((demo) => {
      if (!list.some((u) => u.username.toLowerCase() === demo.username.toLowerCase())) {
        list.push(demo);
      }
    });

    return list;
  }, [cleanUsersList, dbStudents, branches, classes]);

  // 若偵測到傳入的 usersList 中含有舊 dummy 帳號，自動清理
  useEffect(() => {
    if (usersList.some((u) => DUMMY_USERNAMES.includes((u.username || '').toLowerCase()))) {
      const sanitized = usersList.filter(
        (u) => !DUMMY_USERNAMES.includes((u.username || '').toLowerCase())
      );
      onUpdateUsersList(sanitized);
    }
  }, [usersList, onUpdateUsersList]);

  useEffect(() => {
    if (branches.length > 0 && !branch) {
      setBranch(branches[0]);
    }
    if (classes.length > 0 && !className) {
      setClassName(classes[0]);
    }
  }, [branches, classes, branch, className]);

  // 依當前選擇的學校解析學校代號
  const currentSchoolInfo = parseBranchInfo(branch);
  const currentSchoolCode = currentSchoolInfo.code;

  // ⭐ 依學校過濾可用課程 (支援物件或字串陣列)
  const getCoursesForBranch = (b: string) => {
    if (!b) return [];
    if (courses && courses.length > 0) {
      const targetBranchName = parseBranchInfo(b).name.toLowerCase();
      const matched = courses.filter((c) => {
        if (typeof c === 'string') return true;
        const cBranch = (c.branch || '').trim().toLowerCase();
        if (!cBranch || cBranch === '全部分校') return true;
        const cBranchName = parseBranchInfo(c.branch || '').name.toLowerCase();
        return cBranchName === targetBranchName || cBranch === b.toLowerCase();
      });
      return Array.from(new Set(matched.map((c) => getCourseDisplayName(c)))).filter(Boolean);
    }
    return courseNames || [];
  };

  const availableCoursesForSelectedBranch = React.useMemo(() => {
    return getCoursesForBranch(branch);
  }, [branch, courses, courseNames]);

  // ⭐ 需求：帳戶名冊依學校/分校過濾 (必須置於 early return 之前以嚴格遵守 Rules of Hooks)
  const allKnownBranches = React.useMemo(() => {
    const list = allAccounts.map((u) => u.branch).filter(Boolean) as string[];
    return Array.from(new Set([...branches, ...list]));
  }, [branches, allAccounts]);

  if (!isOpen) return null;

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

    // 建立學生帳戶時學校代號放在登入帳號最前
    let finalUsername = rawUsername;
    if (role === 'student' && currentSchoolCode) {
      const prefix = `${currentSchoolCode}_`.toLowerCase();
      if (finalUsername.toLowerCase().startsWith(prefix)) {
        finalUsername = `${currentSchoolCode}_${finalUsername.slice(prefix.length)}`;
      } else {
        finalUsername = `${currentSchoolCode}_${finalUsername}`;
      }
    }

    if (!trimmedPassword) {
      alert('請輸入 8 位純數字密碼，或點擊右上角「隨機產生」！');
      return;
    }
    if (!is8DigitNumeric(trimmedPassword)) {
      alert('⚠️ 密碼必需為嚴格 8 位純數字（例如：12345678）！');
      return;
    }

    if (allAccounts.some((u) => u.username.toLowerCase() === finalUsername.toLowerCase())) {
      alert(`⚠️ 帳號「${finalUsername}」已存在，請更換另一個帳號名稱！`);
      return;
    }

    const finalBranch = role === 'student' ? (branch || (branches.length > 0 ? branches[0] : '總校')) : undefined;
    const finalClass = role === 'student' ? (className || (classes.length > 0 ? classes[0] : '未分班')) : undefined;

    // 整合參加課程
    const finalCourses: string[] = [];
    if (role === 'student') {
      selectedCourses.forEach((c) => finalCourses.push(c));
      if (customCourseInput.trim() && !finalCourses.includes(customCourseInput.trim())) {
        finalCourses.push(customCourseInput.trim());
      }
    }

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
      enrolledCourses: role === 'student' ? finalCourses : undefined,
      childrenUsernames: finalChildrenUsernames,
      createdAt: new Date().toISOString()
    };

    const updated = [newUser, ...cleanUsersList];
    onUpdateUsersList(updated);
    setLastIssuedUser(newUser);

    // ⭐ 同步寫入會員目錄 (students 表與本地快取)
    if (role === 'student') {
      const memberDocs = finalCourses.length > 0
        ? finalCourses.map((cName) => ({
            branch: finalBranch || '',
            class_name: finalClass || '',
            course_name: cName,
            student_name: trimmedName,
          }))
        : [{
            branch: finalBranch || '',
            class_name: finalClass || '',
            course_name: '',
            student_name: trimmedName,
          }];

      try {
        const cached = localStorage.getItem('oc_local_students');
        const list = cached ? JSON.parse(cached) : [];
        memberDocs.forEach((doc, i) => list.unshift({ ...doc, $id: `stu_${Date.now()}_${i}` }));
        localStorage.setItem('oc_local_students', JSON.stringify(list));
      } catch (e) {}

      memberDocs.forEach((doc) => {
        try {
          databases.createDocument(DATABASE_ID, 'students', ID.unique(), doc).catch(() => {});
        } catch (e) {}
      });
    }

    // 清空表單
    setName('');
    setUsername('');
    setPhone('');
    setPassword('');
    setSelectedCourses([]);
    setCustomCourseInput('');
    setLinkedChildrenUsernames([]);
    setSelectedStudentToLink('');
    setCustomChildUsernameInput('');

    alert(`✅ 成功派發新帳戶！
姓名：${newUser.name}
身分：${ROLE_CONFIGS[newUser.role]?.label || newUser.role}
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
    const updated = cleanUsersList.filter((u) => u.username !== targetUser.username);
    onUpdateUsersList(updated);

    // ⭐ 同步刪除會員目錄中相對的會員記錄
    if (targetUser.role === 'student') {
      try {
        const cached = localStorage.getItem('oc_local_students');
        if (cached) {
          const list = JSON.parse(cached);
          const remaining = list.filter((s: any) => s.student_name !== targetUser.name);
          localStorage.setItem('oc_local_students', JSON.stringify(remaining));
        }
      } catch (e) {}

      try {
        databases.listDocuments(DATABASE_ID, 'students', [Query.limit(500)]).then((res) => {
          const docsToDelete = res.documents.filter(
            (d: any) => d.student_name === targetUser.name
          );
          docsToDelete.forEach((doc) => {
            databases.deleteDocument(DATABASE_ID, 'students', doc.$id).catch(() => {});
          });
        }).catch(() => {});
      } catch (e) {}
    }
  };

  // ⭐ 啟動編輯帳戶
  const handleStartEditAccount = (u: UserProfile) => {
    setEditingAccountId(u.username);
    setEditName(u.name || '');
    setEditUsername(u.username || '');
    setEditRole(u.role || 'student');
    setEditPassword(u.password || '');
    setShowEditPassword(false);
    setEditPhone(u.phone || '');
    setEditBranch(u.branch || branches[0] || '總校');
    setEditClass(u.className || classes[0] || '未分班');
    setEditCourses(u.enrolledCourses || []);
    setEditCustomCourse('');
    setEditChildrenUsernames(u.childrenUsernames || []);
    setEditStudentPicker('');
    setEditManualChildInput('');
  };

  // ⭐ 儲存編輯帳戶
  const handleSaveEditAccount = (originalUser: UserProfile) => {
    const finalName = editName.trim();
    const finalUname = editUsername.trim();
    const finalPwd = editPassword.trim();

    if (!finalName) {
      alert('姓名不能為空！');
      return;
    }
    if (!finalUname) {
      alert('登入帳號不能為空！');
      return;
    }
    if (!finalPwd || !is8DigitNumeric(finalPwd)) {
      alert('⚠️ 密碼必需為嚴格 8 位純數字！');
      return;
    }

    // 檢查帳號重名 (排除自己)
    if (allAccounts.some((a) => a.username.toLowerCase() === finalUname.toLowerCase() && a.username.toLowerCase() !== originalUser.username.toLowerCase())) {
      alert(`⚠️ 帳號「${finalUname}」已被其他用戶使用，請更換！`);
      return;
    }

    const updatedCourses: string[] = [];
    if (editRole === 'student') {
      editCourses.forEach((c) => updatedCourses.push(c));
      if (editCustomCourse.trim() && !updatedCourses.includes(editCustomCourse.trim())) {
        updatedCourses.push(editCustomCourse.trim());
      }
    }

    const updatedUser: UserProfile = {
      ...originalUser,
      name: finalName,
      username: finalUname,
      role: editRole,
      password: finalPwd,
      phone: editPhone.trim() || undefined,
      branch: editRole === 'student' ? editBranch : undefined,
      className: editRole === 'student' ? editClass : undefined,
      enrolledCourses: editRole === 'student' ? updatedCourses : undefined,
      childrenUsernames: editRole === 'parent' ? editChildrenUsernames : undefined,
    };

    const updatedList = cleanUsersList.map((u) =>
      u.username.toLowerCase() === originalUser.username.toLowerCase() ? updatedUser : u
    );

    if (!cleanUsersList.some((u) => u.username.toLowerCase() === originalUser.username.toLowerCase())) {
      updatedList.push(updatedUser);
    }

    onUpdateUsersList(updatedList);
    setEditingAccountId(null);

    // ⭐ 若為學生，同步更新會員目錄
    if (editRole === 'student') {
      const memberDocs = updatedCourses.length > 0
        ? updatedCourses.map((cName) => ({
            branch: editBranch || '',
            class_name: editClass || '',
            course_name: cName,
            student_name: finalName,
          }))
        : [{
            branch: editBranch || '',
            class_name: editClass || '',
            course_name: '',
            student_name: finalName,
          }];

      try {
        const cached = localStorage.getItem('oc_local_students');
        let list = cached ? JSON.parse(cached) : [];
        list = list.filter((s: any) => s.student_name !== originalUser.name && s.student_name !== finalName);
        memberDocs.forEach((doc, i) => list.unshift({ ...doc, $id: `stu_${Date.now()}_${i}` }));
        localStorage.setItem('oc_local_students', JSON.stringify(list));
      } catch (e) {}

      // 雲端同步
      try {
        databases.listDocuments(DATABASE_ID, 'students', [Query.limit(500)]).then((res) => {
          const oldDocs = res.documents.filter(
            (d: any) => d.student_name === originalUser.name
          );
          oldDocs.forEach((doc) => {
            databases.deleteDocument(DATABASE_ID, 'students', doc.$id).catch(() => {});
          });
          memberDocs.forEach((doc) => {
            databases.createDocument(DATABASE_ID, 'students', ID.unique(), doc).catch(() => {});
          });
        }).catch(() => {});
      } catch (e) {}
    }

    alert(`✅ 帳戶「${updatedUser.username}」已成功儲存更新！`);
  };

  // 行內為學生快速退出課程
  const handleRemoveCourseFromStudent = (studentUser: UserProfile, courseToRemove: string) => {
    if (!window.confirm(`確定要為「${studentUser.name}」退出課程「${courseToRemove}」嗎？`)) return;
    const currentCourses = studentUser.enrolledCourses || [];
    const remaining = currentCourses.filter((c) => c !== courseToRemove);

    const updatedUser = { ...studentUser, enrolledCourses: remaining };
    const updatedList = cleanUsersList.map((u) =>
      u.username === studentUser.username ? updatedUser : u
    );
    onUpdateUsersList(updatedList);

    // 同步雲端 students 表
    try {
      databases.listDocuments(DATABASE_ID, 'students', [Query.limit(500)]).then((res) => {
        const matched = res.documents.find(
          (d: any) => d.student_name === studentUser.name && d.course_name === courseToRemove
        );
        if (matched) {
          if (remaining.length === 0) {
            databases.updateDocument(DATABASE_ID, 'students', matched.$id, { course_name: '' }).catch(() => {});
          } else {
            databases.deleteDocument(DATABASE_ID, 'students', matched.$id).catch(() => {});
          }
        }
      }).catch(() => {});
    } catch (e) {}
  };

  // 行內為學生快速加選課程
  const handleQuickAddCourse = (studentUser: UserProfile) => {
    const courseToAdd = quickAddCourseSelected.trim();
    if (!courseToAdd) return;
    const currentCourses = studentUser.enrolledCourses || [];
    if (currentCourses.includes(courseToAdd)) {
      alert(`學生已選讀過「${courseToAdd}」！`);
      return;
    }
    const updatedCourses = [...currentCourses, courseToAdd];
    const updatedUser = { ...studentUser, enrolledCourses: updatedCourses };
    const updatedList = cleanUsersList.map((u) =>
      u.username === studentUser.username ? updatedUser : u
    );
    onUpdateUsersList(updatedList);
    setQuickAddCourseUserId(null);
    setQuickAddCourseSelected('');

    // 同步雲端
    try {
      databases.createDocument(DATABASE_ID, 'students', ID.unique(), {
        branch: studentUser.branch || '',
        class_name: studentUser.className || '',
        course_name: courseToAdd,
        student_name: studentUser.name,
      }).catch(() => {});
    } catch (e) {}

    alert(`✅ 已為「${studentUser.name}」加選「${courseToAdd}」！`);
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
      detailLines = `
所屬學校：${u.branch || '總校'} / 班別：${u.className || '全校'}`;
      if (u.enrolledCourses && u.enrolledCourses.length > 0) {
        detailLines += `
參加課程：${u.enrolledCourses.join('、')}`;
      }
    } else if (u.role === 'parent' && u.childrenUsernames && u.childrenUsernames.length > 0) {
      detailLines = `
關聯子女帳號：${u.childrenUsernames.join(', ')}`;
    }

    const text = `【Online Classroom 帳戶派發通知】
姓名：${u.name}
身分：${ROLE_CONFIGS[u.role]?.label || u.role}
登入帳號：${u.username}
登入密碼：${u.password}${detailLines}
（請妥善保管您的帳戶，登入後即可查閱專屬課程教材與單元家課）`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      alert('📋 帳戶派發資訊已成功複製至剪貼簿！可直接貼上發送給用戶。');
    } else {
      alert(text);
    }
  };

  // 匯出帳戶名冊為 Excel / CSV 格式
  const handleExportAccountsCSV = () => {
    if (allAccounts.length === 0) {
      alert('目前尚無帳戶資料可供匯出！');
      return;
    }
    // ⭐ 需求 2：匯出名冊與批次匯入欄位排位嚴格一致 (身分, 用戶姓名, 登入帳號, 8位數字密碼, 學校/分校, 班別, 參加課程, 聯絡電話, 關聯子女帳號, 建立時間)
    const headers = [
      '身分',
      '用戶姓名',
      '登入帳號',
      '8位數字密碼',
      '學校/分校',
      '班別',
      '參加課程',
      '聯絡電話',
      '關聯子女帳號',
      '建立時間'
    ];
    const rows = allAccounts.map((u) => [
      `"${(ROLE_CONFIGS[u.role]?.label || u.role).replace(/"/g, '""')}"`,
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${(u.username || '').replace(/"/g, '""')}"`,
      `"\t${u.password}"`,
      `"${(u.branch || '').replace(/"/g, '""')}"`,
      `"${(u.className || '').replace(/"/g, '""')}"`,
      `"${(u.enrolledCourses ? u.enrolledCourses.join(';') : '').replace(/"/g, '""')}"`,
      `"${(u.phone || '').replace(/"/g, '""')}"`,
      `"${(u.childrenUsernames ? u.childrenUsernames.join(';') : (u.childName || '')).replace(/"/g, '""')}"`,
      `"${(u.createdAt || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = String.fromCharCode(0xFEFF) + [headers.join(','), ...rows.map((r) => r.join(','))].join(String.fromCharCode(10));
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
    // ⭐ 需求 2：範本排位與匯出名冊完全一致
    const headers = [
      '身分(學生/家長/導師/助教/管理員)',
      '用戶姓名',
      '登入帳號',
      '8位純數字密碼(選填)',
      '學校/分校(學生專用)',
      '班別(學生專用)',
      '參加課程(多個以分號隔開)',
      '聯絡電話(選填)',
      '關聯子女帳號(家長專用，多個分號隔開)'
    ];
    const sampleRows = [
      '學生,陳小明,101,12345678,沙田分校 (ST),1A,常規中文班; 奧數思維班,91234567,',
      '家長,陳家長,parent_101,12345678,,,,ST_101',
      '導師,張導師,teacher_zhang,12345678,,,,92345678,',
      '助教,李助教,ta_lee,12345678,,,,93456789,'
    ];
    const csvContent = String.fromCharCode(0xFEFF) + [headers.join(','), ...sampleRows].join(String.fromCharCode(10));
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

  const parseRole = (raw: string): UserRole => {
    const s = (raw || '').toLowerCase().trim();
    if (s.includes('家長') || s.includes('parent')) return 'parent';
    if (s.includes('導師') || s.includes('老師') || s.includes('teacher')) return 'teacher';
    if (s.includes('助教') || s.includes('assistant') || s.includes('ta')) return 'assistant';
    if (s.includes('管理') || s.includes('admin')) return 'admin';
    return 'student';
  };

  // 處理 Excel/CSV 檔案選取與解析 (支援智慧欄位識別與標準欄位順序解析)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = (evt.target?.result as string) || '';
        const lines = text
          .split(String.fromCharCode(10))
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (lines.length === 0) {
          alert('上傳的檔案為空！');
          return;
        }

        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim().replace(/^["'\t]|["'\t]$/g, ''));
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim().replace(/^["'\t]|["'\t]$/g, ''));
          return result;
        };

        const firstLineCols = parseCSVLine(lines[0]);
        const hasHeader = firstLineCols.some((c) =>
          ['姓名', '身分', '身份', '帳號', '账号', 'role', 'username'].some((k) => c.toLowerCase().includes(k))
        );

        // 智慧欄位索引對應 (若有標題列，依標題精準映射；無標題列則使用標準排位)
        let colRole = 0;
        let colName = 1;
        let colUsername = 2;
        let colPassword = 3;
        let colBranch = 4;
        let colClass = 5;
        let colCourses = 6;
        let colPhone = 7;
        let colChildren = 8;

        if (hasHeader) {
          firstLineCols.forEach((h, idx) => {
            const hClean = h.replace(/\s+/g, '').toLowerCase();
            if (hClean.includes('代碼') || hClean.includes('code')) {
              // 略過純代碼欄位 (如以前匯出的身分代碼)
              return;
            }
            if ((hClean.includes('身分') || hClean.includes('身份') || hClean === 'role') && colRole === 0) {
              colRole = idx;
            } else if ((hClean.includes('姓名') || hClean.includes('name')) && !hClean.includes('子女')) {
              colName = idx;
            } else if (hClean.includes('子女') || hClean.includes('孩子') || hClean.includes('child')) {
              colChildren = idx;
            } else if (hClean.includes('帳號') || hClean.includes('账号') || hClean.includes('username') || hClean.includes('登入')) {
              colUsername = idx;
            } else if (hClean.includes('密碼') || hClean.includes('密码') || hClean.includes('password') || hClean.includes('pwd')) {
              colPassword = idx;
            } else if (hClean.includes('學校') || hClean.includes('分校') || hClean.includes('branch') || hClean.includes('校區')) {
              colBranch = idx;
            } else if (hClean.includes('班別') || hClean.includes('班級') || hClean.includes('class')) {
              colClass = idx;
            } else if (hClean.includes('課程') || hClean.includes('课程') || hClean.includes('course')) {
              colCourses = idx;
            } else if (hClean.includes('電話') || hClean.includes('电话') || hClean.includes('phone') || hClean.includes('tel')) {
              colPhone = idx;
            }
          });
        }

        const rows: UserProfile[] = [];
        const startIndex = hasHeader ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
          const parts = parseCSVLine(lines[i]);
          if (parts.length >= 2) {
            const rawRole = parts[colRole] || '學生';
            const parsedR = parseRole(rawRole);
            const uName = parts[colName] || '';
            let uUsername = parts[colUsername] || '';
            let uPassword = (parts[colPassword] || '').replace(/\D/g, '').slice(0, 8);
            if (uPassword.length !== 8) {
              uPassword = uPassword.padEnd(8, '0');
              if (uPassword.length !== 8 || uPassword === '00000000') uPassword = '12345678';
            }

            const uBranch = parsedR === 'student' ? (parts[colBranch] || branches[0] || '總校') : undefined;
            const uClass = parsedR === 'student' ? (parts[colClass] || classes[0] || '全校') : undefined;
            const uCourses = parsedR === 'student' && parts[colCourses]
              ? parts[colCourses].split(/[;、|]+/).map((x) => x.trim()).filter(Boolean)
              : undefined;
            const uPhone = parts[colPhone] || undefined;
            const uChildren = parsedR === 'parent' && parts[colChildren]
              ? parts[colChildren].split(/[;、|]+/).map((x) => x.trim()).filter(Boolean)
              : undefined;

            if (parsedR === 'student' && uBranch) {
              const code = parseBranchInfo(uBranch).code;
              if (code && !uUsername.toLowerCase().startsWith(`${code}_`.toLowerCase())) {
                uUsername = `${code}_${uUsername}`;
              }
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
                enrolledCourses: uCourses,
                phone: uPhone,
                childrenUsernames: uChildren,
                createdAt: new Date().toISOString()
              });
            }
          }
        }

        if (rows.length === 0) {
          alert('未能識別檔案中的數據，請參考標準範本：身分,姓名,帳號,8位密碼,分校,班別,參加課程,電話,關聯子女帳號');
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

    // 批次匯入學生帳戶時同步加入會員目錄 (students 表)
    const newStudentsToSync = validNewAccounts.filter((a) => a.role === 'student');
    if (newStudentsToSync.length > 0) {
      try {
        const cached = localStorage.getItem('oc_local_students');
        const list = cached ? JSON.parse(cached) : [];
        newStudentsToSync.forEach((acc, i) => {
          const coursesToEnroll = acc.enrolledCourses && acc.enrolledCourses.length > 0 ? acc.enrolledCourses : [''];
          coursesToEnroll.forEach((cName, cIdx) => {
            list.unshift({
              $id: `stu_imp_${Date.now()}_${i}_${cIdx}`,
              branch: acc.branch || '',
              class_name: acc.className || '',
              course_name: cName,
              student_name: acc.name,
            });
          });
        });
        localStorage.setItem('oc_local_students', JSON.stringify(list));
      } catch (e) {}

      newStudentsToSync.forEach((acc) => {
        const coursesToEnroll = acc.enrolledCourses && acc.enrolledCourses.length > 0 ? acc.enrolledCourses : [''];
        coursesToEnroll.forEach((cName) => {
          try {
            databases.createDocument(DATABASE_ID, 'students', ID.unique(), {
              branch: acc.branch || '',
              class_name: acc.className || '',
              course_name: cName,
              student_name: acc.name,
            }).catch(() => {});
          } catch (e) {}
        });
      });
    }

    alert(`🎉 批次匯入完成！成功建立 ${validNewAccounts.length} 個新帳戶${duplicateCount > 0 ? `（略過 ${duplicateCount} 個重複帳號）` : ''}。`);
    setParsedRows([]);
    setActiveTab('list');
  };

  // 篩選帳號清單
  const filteredAccounts = allAccounts.filter((u) => {
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (filterBranch !== 'all') {
      const uBranch = (u.branch || '').trim();
      if (!uBranch || (uBranch !== filterBranch && !uBranch.includes(filterBranch) && !filterBranch.includes(uBranch))) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = u.name.toLowerCase().includes(q);
      const matchUsername = u.username.toLowerCase().includes(q);
      const matchBranch = (u.branch || '').toLowerCase().includes(q);
      const matchCourse = (u.enrolledCourses || []).some((c) => c.toLowerCase().includes(q));
      const matchChild = (u.childrenUsernames || []).some((cu) => cu.toLowerCase().includes(q));
      if (!matchName && !matchUsername && !matchBranch && !matchCourse && !matchChild) return false;
    }
    return true;
  });

  // ⭐ 批次選擇邏輯
  const selectableAccounts = filteredAccounts.filter((u) => u.username !== 'admin');
  const isAllSelected =
    selectableAccounts.length > 0 &&
    selectableAccounts.every((u) => selectedUsernames.includes(u.username));

  const handleToggleSelectUser = (uName: string) => {
    if (uName === 'admin') return;
    setSelectedUsernames((prev) =>
      prev.includes(uName) ? prev.filter((x) => x !== uName) : [...prev, uName]
    );
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const currentShown = new Set(selectableAccounts.map((u) => u.username));
      setSelectedUsernames((prev) => prev.filter((un) => !currentShown.has(un)));
    } else {
      const newSelected = new Set([...selectedUsernames, ...selectableAccounts.map((u) => u.username)]);
      setSelectedUsernames(Array.from(newSelected));
    }
  };

  // ⭐ 批次刪除
  const handleBatchDelete = async () => {
    const targetUsernames = selectedUsernames.filter((un) => un !== 'admin');
    if (targetUsernames.length === 0) {
      alert('請先勾選要刪除的帳號（管理員帳號無法刪除）！');
      return;
    }

    if (
      !window.confirm(
        `⚠️ 確定要批次刪除選取的 ${targetUsernames.length} 個帳戶嗎？\n\n此動作將同步從帳戶名冊中刪除帳號，並同步從會員名冊與雲端資料庫中移除相關記錄。此動作無法還原！`
      )
    ) {
      return;
    }

    setBatchProcessing(true);
    try {
      const updatedUsers = cleanUsersList.filter((u) => !targetUsernames.includes(u.username));
      onUpdateUsersList(updatedUsers);
      try {
        localStorage.setItem('oc_users_list', JSON.stringify(updatedUsers));
      } catch (e) {}

      const deletedStudentNames = new Set(
        allAccounts
          .filter((u) => targetUsernames.includes(u.username) && u.role === 'student')
          .map((u) => u.name)
      );

      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('oc_local_students');
          if (cached) {
            const list = JSON.parse(cached);
            const remaining = list.filter((s: any) => !deletedStudentNames.has(s.student_name));
            localStorage.setItem('oc_local_students', JSON.stringify(remaining));
            setDbStudents(remaining);
          }
        } catch (e) {}
      }

      for (const sName of deletedStudentNames) {
        try {
          const res = await databases.listDocuments(DATABASE_ID, 'students', [
            Query.equal('student_name', sName),
            Query.limit(100),
          ]);
          for (const doc of res.documents) {
            try {
              await databases.deleteDocument(DATABASE_ID, 'students', doc.$id);
            } catch (de) {}
          }
        } catch (err: any) {
          console.warn('雲端刪除學生記錄略過:', err.message);
        }
      }

      setSelectedUsernames([]);
      alert(`🎉 成功批次刪除 ${targetUsernames.length} 個帳戶！`);
    } catch (err: any) {
      alert('批次刪除失敗：' + err.message);
    } finally {
      setBatchProcessing(false);
    }
  };

  // ⭐ 批次修改
  const handleApplyBatchModify = async () => {
    const targetUsernames = selectedUsernames.filter((un) => un !== 'admin');
    if (targetUsernames.length === 0) return;

    setBatchProcessing(true);
    try {
      let updatedUsers = [...cleanUsersList];

      if (batchActionType === 'branch') {
        if (!batchTargetBranch) {
          alert('請選擇目標學校/分校！');
          setBatchProcessing(false);
          return;
        }
        updatedUsers = updatedUsers.map((u) => {
          if (targetUsernames.includes(u.username)) {
            return { ...u, branch: batchTargetBranch };
          }
          return u;
        });

        const studentNamesToUpdate = new Set(
          updatedUsers
            .filter((u) => targetUsernames.includes(u.username) && u.role === 'student')
            .map((u) => u.name)
        );
        if (typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem('oc_local_students');
            if (cached) {
              const list = JSON.parse(cached);
              const modified = list.map((s: any) =>
                studentNamesToUpdate.has(s.student_name) ? { ...s, branch: batchTargetBranch } : s
              );
              localStorage.setItem('oc_local_students', JSON.stringify(modified));
              setDbStudents(modified);
            }
          } catch (e) {}
        }
        for (const sName of studentNamesToUpdate) {
          try {
            const res = await databases.listDocuments(DATABASE_ID, 'students', [
              Query.equal('student_name', sName),
              Query.limit(50),
            ]);
            for (const doc of res.documents) {
              await databases.updateDocument(DATABASE_ID, 'students', doc.$id, { branch: batchTargetBranch });
            }
          } catch (e) {}
        }
      } else if (batchActionType === 'class') {
        if (!batchTargetClass) {
          alert('請選擇目標班別！');
          setBatchProcessing(false);
          return;
        }
        updatedUsers = updatedUsers.map((u) => {
          if (targetUsernames.includes(u.username)) {
            return { ...u, className: batchTargetClass };
          }
          return u;
        });

        const studentNamesToUpdate = new Set(
          updatedUsers
            .filter((u) => targetUsernames.includes(u.username) && u.role === 'student')
            .map((u) => u.name)
        );
        if (typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem('oc_local_students');
            if (cached) {
              const list = JSON.parse(cached);
              const modified = list.map((s: any) =>
                studentNamesToUpdate.has(s.student_name) ? { ...s, class_name: batchTargetClass } : s
              );
              localStorage.setItem('oc_local_students', JSON.stringify(modified));
              setDbStudents(modified);
            }
          } catch (e) {}
        }
        for (const sName of studentNamesToUpdate) {
          try {
            const res = await databases.listDocuments(DATABASE_ID, 'students', [
              Query.equal('student_name', sName),
              Query.limit(50),
            ]);
            for (const doc of res.documents) {
              await databases.updateDocument(DATABASE_ID, 'students', doc.$id, { class_name: batchTargetClass });
            }
          } catch (e) {}
        }
      } else if (batchActionType === 'add_course') {
        if (!batchTargetCourse) {
          alert('請選擇要加選的課程！');
          setBatchProcessing(false);
          return;
        }
        updatedUsers = updatedUsers.map((u) => {
          if (targetUsernames.includes(u.username) && u.role === 'student') {
            const cur = u.enrolledCourses || [];
            if (!cur.includes(batchTargetCourse)) {
              return { ...u, enrolledCourses: [...cur, batchTargetCourse] };
            }
          }
          return u;
        });

        const studentsToEnroll = updatedUsers.filter(
          (u) => targetUsernames.includes(u.username) && u.role === 'student'
        );
        if (typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem('oc_local_students');
            const list = cached ? JSON.parse(cached) : [];
            studentsToEnroll.forEach((stu, sIdx) => {
              const alreadyHas = list.some(
                (s: any) => s.student_name === stu.name && s.course_name === batchTargetCourse
              );
              if (!alreadyHas) {
                list.unshift({
                  $id: `stu_batch_${Date.now()}_${sIdx}`,
                  branch: stu.branch || '',
                  class_name: stu.className || '',
                  course_name: batchTargetCourse,
                  student_name: stu.name,
                });
              }
            });
            localStorage.setItem('oc_local_students', JSON.stringify(list));
            setDbStudents(list);
          } catch (e) {}
        }
        for (const stu of studentsToEnroll) {
          try {
            await databases.createDocument(DATABASE_ID, 'students', ID.unique(), {
              branch: stu.branch || '',
              class_name: stu.className || '',
              course_name: batchTargetCourse,
              student_name: stu.name,
            });
          } catch (e) {}
        }
      } else if (batchActionType === 'remove_course') {
        if (!batchTargetCourse) {
          alert('請選擇要退選的課程！');
          setBatchProcessing(false);
          return;
        }
        updatedUsers = updatedUsers.map((u) => {
          if (targetUsernames.includes(u.username) && u.role === 'student') {
            const cur = u.enrolledCourses || [];
            return { ...u, enrolledCourses: cur.filter((c) => c !== batchTargetCourse) };
          }
          return u;
        });

        const studentsToUnenroll = updatedUsers.filter(
          (u) => targetUsernames.includes(u.username) && u.role === 'student'
        );
        const stuNames = new Set(studentsToUnenroll.map((u) => u.name));

        if (typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem('oc_local_students');
            if (cached) {
              const list = JSON.parse(cached);
              const studentCounts = new Map<string, number>();
              list.forEach((s: any) => {
                if (stuNames.has(s.student_name)) {
                  studentCounts.set(s.student_name, (studentCounts.get(s.student_name) || 0) + 1);
                }
              });

              const modified: any[] = [];
              list.forEach((s: any) => {
                if (stuNames.has(s.student_name) && s.course_name === batchTargetCourse) {
                  const cnt = studentCounts.get(s.student_name) || 1;
                  if (cnt <= 1) {
                    modified.push({ ...s, course_name: '' });
                  } else {
                    studentCounts.set(s.student_name, cnt - 1);
                  }
                } else {
                  modified.push(s);
                }
              });
              localStorage.setItem('oc_local_students', JSON.stringify(modified));
              setDbStudents(modified);
            }
          } catch (e) {}
        }

        for (const stu of studentsToUnenroll) {
          try {
            const res = await databases.listDocuments(DATABASE_ID, 'students', [
              Query.equal('student_name', stu.name),
              Query.limit(50),
            ]);
            const totalDocs = res.documents.length;
            for (const doc of res.documents) {
              if (doc.course_name === batchTargetCourse) {
                if (totalDocs <= 1) {
                  await databases.updateDocument(DATABASE_ID, 'students', doc.$id, { course_name: '' });
                } else {
                  await databases.deleteDocument(DATABASE_ID, 'students', doc.$id);
                }
              }
            }
          } catch (e) {}
        }
      } else if (batchActionType === 'password') {
        const cleanedPwd = batchTargetPassword.replace(/\D/g, '').slice(0, 8);
        if (cleanedPwd.length !== 8) {
          alert('密碼必須為 8 位純數字！');
          setBatchProcessing(false);
          return;
        }
        updatedUsers = updatedUsers.map((u) => {
          if (targetUsernames.includes(u.username)) {
            return { ...u, password: cleanedPwd };
          }
          return u;
        });
      }

      onUpdateUsersList(updatedUsers);
      try {
        localStorage.setItem('oc_users_list', JSON.stringify(updatedUsers));
      } catch (e) {}

      setShowBatchModal(false);
      setSelectedUsernames([]);
      alert(`🎉 批次修改已成功套用至 ${targetUsernames.length} 個帳戶！`);
    } catch (err: any) {
      alert('批次修改失敗：' + err.message);
    } finally {
      setBatchProcessing(false);
    }
  };

  return (
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
                  <span className="font-bold">統一派發與選課：</span>
                  管理員可在本中心為學生建立帳號、編配分校班別並即時指派參加課程，自動同步至會員目錄。
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

                {/* 只有學生帳戶需要選取學校及班別 */}
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
                          onChange={(e) => {
                            setBranch(e.target.value);
                            setSelectedCourses([]);
                          }}
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

                {/* ⭐ 需求：將會員目錄中參加課程 (Courses)功能移送至帳戶管理與派發中心 */}
                {role === 'student' && (
                  <div className="p-3.5 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <GraduationCap size={15} className="text-indigo-600" />
                        <span>參加課程 (Courses)</span>
                        <span className="text-[10px] text-gray-500 font-normal">(選填，可複選多個課程)</span>
                      </label>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                        已選 {selectedCourses.length + (customCourseInput.trim() ? 1 : 0)} 門課程
                      </span>
                    </div>

                    {!branch ? (
                      <p className="text-xs text-amber-600 font-medium py-2 text-center bg-amber-50 rounded-lg">
                        ※ 請先於上方選取「所屬學校」，系統將自動過濾並顯示該校專屬課程
                      </p>
                    ) : availableCoursesForSelectedBranch.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2 text-center">
                        「{parseBranchInfo(branch).name}」暫無預設課程，可於下方手動輸入課程名稱
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="text-[11px] text-gray-500">點擊標籤複選此分校課程：</div>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                          {availableCoursesForSelectedBranch.map((cName) => {
                            const isSelected = selectedCourses.includes(cName);
                            return (
                              <button
                                key={cName}
                                type="button"
                                onClick={() => {
                                  setSelectedCourses((prev) =>
                                    prev.includes(cName) ? prev.filter((c) => c !== cName) : [...prev, cName]
                                  );
                                }}
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
                                }`}
                              >
                                {isSelected && <Check size={12} />}
                                <GraduationCap size={12} />
                                <span>{cName}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 自訂課程輸入 */}
                    <div className="pt-1.5 border-t border-indigo-100">
                      <input
                        type="text"
                        placeholder="+ 自訂或填寫其他課程名稱 (選填)..."
                        value={customCourseInput}
                        onChange={(e) => setCustomCourseInput(e.target.value)}
                        className="w-full p-2 border border-gray-200 bg-white rounded-lg text-xs outline-none focus:border-indigo-600 placeholder:text-gray-400 font-semibold"
                      />
                    </div>
                  </div>
                )}

                {/* 建立學生帳戶時學校代號放在登入帳號最前 */}
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

                {/* 家長帳戶關聯多於一個學生之登入帳號 */}
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

                {/* 不要預設初始密碼 */}
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

              {/* 最近一次派發的帳戶卡片 */}
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
                    {lastIssuedUser.enrolledCourses && lastIssuedUser.enrolledCourses.length > 0 && (
                      <div>參加課程：{lastIssuedUser.enrolledCourses.join('、')}</div>
                    )}
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
                  格式：身分, 姓名, 帳號, 8位密碼, 學校, 班別, 參加課程, 電話, 關聯子女帳號<br />
                  （學生帳號會自動補齊學校代號，參加課程支援多筆以分號隔開）
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
                                {r.enrolledCourses && r.enrolledCourses.length > 0 ? ` · 課程: ${r.enrolledCourses.join(';')}` : ''}
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

          {/* TAB 3: 已派發帳號名冊列表 (支援編輯帳戶與參加課程管理) */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {/* 頂部操作：搜尋與匯出按鈕 */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜尋帳號、姓名、分校、課程、子女帳號..."
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-600 placeholder:text-gray-400"
                    />
                  </div>

                  {/* ⭐ 需求：帳戶名冊提供學校 filter */}
                  <select
                    value={filterBranch}
                    onChange={(e) => setFilterBranch(e.target.value)}
                    className="bg-purple-50 text-purple-700 font-bold text-xs px-2.5 py-2 rounded-xl border border-purple-200 outline-none shrink-0"
                    title="依學校/分校過濾名冊"
                  >
                    <option value="all">全部分校 (全部學校)</option>
                    {allKnownBranches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>

                  {/* Excel 匯出按鈕 */}
                  <button
                    type="button"
                    onClick={handleExportAccountsCSV}
                    className="flex items-center gap-1 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-2 rounded-xl font-bold transition-colors shadow-2xs shrink-0 justify-center"
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
                {/* ⭐ 批次操作工具列 (當有勾選項目時自動浮現) */}
                {selectedUsernames.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-sm animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-purple-700 text-white font-bold text-xs px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                        <CheckSquare size={13} />
                        已選取 {selectedUsernames.length} 個帳戶
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-xs text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer"
                      >
                        {isAllSelected ? '取消全選' : `全選目前顯示 (${selectableAccounts.length})`}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (branches.length > 0 && !batchTargetBranch) setBatchTargetBranch(branches[0]);
                          if (classes.length > 0 && !batchTargetClass) setBatchTargetClass(classes[0]);
                          if (courseNames.length > 0 && !batchTargetCourse) setBatchTargetCourse(courseNames[0]);
                          setShowBatchModal(true);
                        }}
                        className="px-3 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs hover:opacity-95 flex items-center gap-1.5 transition-all"
                      >
                        <Edit2 size={13} />
                        <span>批次修改</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleBatchDelete}
                        disabled={batchProcessing}
                        className="px-3 py-1.5 bg-rose-600 text-white font-bold text-xs rounded-xl shadow-2xs hover:bg-rose-700 flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        <span>批次刪除</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 全選列與數量統計 */}
                <div className="flex justify-between items-center px-1 text-xs text-gray-500">
                  <label className="flex items-center gap-2 cursor-pointer font-bold select-none hover:text-purple-700">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded text-purple-700 accent-purple-700 cursor-pointer"
                    />
                    <span>全選目前篩選名冊 ({selectableAccounts.length})</span>
                  </label>
                  <span>顯示 {filteredAccounts.length} 個帳號</span>
                </div>

                {filteredAccounts.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    沒有找到符合條件的帳號記錄
                  </div>
                ) : (
                  filteredAccounts.map((u) => {
                    const cfg = ROLE_CONFIGS[u.role] || ROLE_CONFIGS.student;
                    const isResetting = resettingUserId === u.username;
                    const isEditing = editingAccountId === u.username;
                    const isQuickAddingCourse = quickAddCourseUserId === u.username;
                    const branchCourses = getCoursesForBranch(u.branch || branch || '');

                    return (
                      <div
                        key={u.username}
                        className={`p-3.5 bg-gray-50 border rounded-2xl space-y-2 text-xs transition-all ${
                          isEditing ? 'border-purple-600 bg-white ring-2 ring-purple-100 shadow-md' : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        {/* 編輯模式展開面板 */}
                        {isEditing ? (
                          <div className="space-y-3 p-1">
                            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                              <span className="font-extrabold text-sm text-purple-900 flex items-center gap-1.5">
                                <Edit2 size={15} className="text-purple-600" />
                                編輯「{u.name}」的帳戶資訊
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">帳號: {u.username}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-bold text-gray-700 mb-0.5">姓名</label>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-purple-600 font-semibold"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-700 mb-0.5">登入帳號</label>
                                <input
                                  type="text"
                                  value={editUsername}
                                  onChange={(e) => setEditUsername(e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-purple-600 font-semibold"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex justify-between items-center mb-0.5">
                                  <label className="text-[11px] font-bold text-gray-700">8位純數字密碼</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      let rand = '';
                                      for (let i = 0; i < 8; i++) rand += Math.floor(Math.random() * 10).toString();
                                      setEditPassword(rand);
                                    }}
                                    className="text-[10px] text-purple-600 font-bold hover:underline"
                                  >
                                    隨機
                                  </button>
                                </div>
                                <div className="relative">
                                  <input
                                    type={showEditPassword ? 'text' : 'password'}
                                    inputMode="numeric"
                                    maxLength={8}
                                    pattern="[0-9]{8}"
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                    className="w-full p-2 pr-8 border border-gray-300 rounded-lg text-xs font-mono font-bold tracking-widest outline-none focus:border-purple-600"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowEditPassword(!showEditPassword)}
                                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                                  >
                                    {showEditPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-700 mb-0.5">聯絡電話</label>
                                <input
                                  type="tel"
                                  value={editPhone}
                                  onChange={(e) => setEditPhone(e.target.value)}
                                  placeholder="選填"
                                  className="w-full p-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-purple-600 font-semibold"
                                />
                              </div>
                            </div>

                            {/* 學生身分專屬欄位：學校、班別與參加課程 */}
                            {editRole === 'student' && (
                              <div className="space-y-2 p-2.5 bg-purple-50/60 rounded-xl border border-purple-200">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-bold text-gray-700 mb-0.5">學校/分校</label>
                                    <select
                                      value={editBranch}
                                      onChange={(e) => setEditBranch(e.target.value)}
                                      className="w-full p-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none"
                                    >
                                      {branches.map((b) => (
                                        <option key={b} value={b}>{b}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-gray-700 mb-0.5">班別</label>
                                    <select
                                      value={editClass}
                                      onChange={(e) => setEditClass(e.target.value)}
                                      className="w-full p-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none"
                                    >
                                      {classes.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {/* ⭐ 參加課程管理 (移送至此) */}
                                <div className="space-y-1.5 pt-1">
                                  <label className="block text-[10px] font-bold text-indigo-950">
                                    參加課程 (可勾選或自訂輸入)：
                                  </label>
                                  <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                                    {getCoursesForBranch(editBranch).map((cName) => {
                                      const isSelected = editCourses.includes(cName);
                                      return (
                                        <button
                                          key={cName}
                                          type="button"
                                          onClick={() => {
                                            setEditCourses((prev) =>
                                              prev.includes(cName) ? prev.filter((c) => c !== cName) : [...prev, cName]
                                            );
                                          }}
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 transition-all ${
                                            isSelected
                                              ? 'bg-indigo-600 text-white'
                                              : 'bg-white text-indigo-700 border border-indigo-200'
                                          }`}
                                        >
                                          {isSelected && <Check size={10} />}
                                          <span>{cName}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="+ 自訂其他課程名稱..."
                                    value={editCustomCourse}
                                    onChange={(e) => setEditCustomCourse(e.target.value)}
                                    className="w-full p-1.5 bg-white border border-gray-300 rounded text-xs outline-none"
                                  />
                                </div>
                              </div>
                            )}

                            {/* 家長身分專屬欄位：關聯子女帳號 */}
                            {editRole === 'parent' && (
                              <div className="space-y-1.5 p-2.5 bg-rose-50/60 rounded-xl border border-rose-200">
                                <label className="block text-[10px] font-bold text-rose-950">
                                  關聯子女登入帳號 (可多選)：
                                </label>
                                <select
                                  value={editStudentPicker}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val && !editChildrenUsernames.includes(val)) {
                                      setEditChildrenUsernames([...editChildrenUsernames, val]);
                                    }
                                    setEditStudentPicker('');
                                  }}
                                  className="w-full p-1.5 bg-white border border-rose-300 rounded text-xs outline-none"
                                >
                                  <option value="">-- 點此挑選學生帳號加入 --</option>
                                  {allAccounts
                                    .filter((a) => a.role === 'student')
                                    .map((stu) => (
                                      <option key={stu.username} value={stu.username}>
                                        {stu.name} ({stu.username})
                                      </option>
                                    ))}
                                </select>
                                <div className="flex gap-1.5">
                                  <input
                                    type="text"
                                    placeholder="手動輸入子女帳號..."
                                    value={editManualChildInput}
                                    onChange={(e) => setEditManualChildInput(e.target.value)}
                                    className="flex-1 p-1.5 bg-white border border-rose-300 rounded text-xs outline-none font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const v = editManualChildInput.trim();
                                      if (v && !editChildrenUsernames.includes(v)) {
                                        setEditChildrenUsernames([...editChildrenUsernames, v]);
                                        setEditManualChildInput('');
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-rose-600 text-white rounded text-xs font-bold"
                                  >
                                    加入
                                  </button>
                                </div>
                                {editChildrenUsernames.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {editChildrenUsernames.map((uName) => (
                                      <span
                                        key={uName}
                                        className="bg-white text-rose-800 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"
                                      >
                                        <span>{uName}</span>
                                        <button
                                          type="button"
                                          onClick={() => setEditChildrenUsernames(editChildrenUsernames.filter((x) => x !== uName))}
                                          className="text-rose-400 hover:text-red-600 font-bold ml-0.5"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 編輯確認與取消 */}
                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                              <button
                                type="button"
                                onClick={() => setEditingAccountId(null)}
                                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditAccount(u)}
                                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                              >
                                <Check size={14} />
                                <span>儲存修改</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* 一般展示檢視 */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                {u.username !== 'admin' && (
                                  <label
                                    className="flex items-center cursor-pointer p-0.5 select-none"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedUsernames.includes(u.username)}
                                      onChange={() => handleToggleSelectUser(u.username)}
                                      className="w-4 h-4 rounded text-purple-700 accent-purple-700 cursor-pointer"
                                    />
                                  </label>
                                )}
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
                                {/* ⭐ 需求 1：編輯帳戶按鈕 */}
                                <button
                                  type="button"
                                  onClick={() => handleStartEditAccount(u)}
                                  className="p-1.5 text-gray-400 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="編輯帳戶資料與課程"
                                >
                                  <Edit2 size={14} />
                                </button>
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

                            {/* 學校與班別 / 關聯子女資訊 */}
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

                            {/* ⭐ 需求：參加課程標籤清單 (移送至此) */}
                            {u.role === 'student' && (
                              <div className="space-y-1.5 pt-1 border-t border-gray-150">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] text-gray-500 font-bold">參加課程：</span>
                                  {(!u.enrolledCourses || u.enrolledCourses.length === 0) ? (
                                    <span className="text-[10px] text-gray-400 italic">未參加課程</span>
                                  ) : (
                                    u.enrolledCourses.map((cName) => (
                                      <span
                                        key={cName}
                                        className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 shadow-2xs"
                                      >
                                        <GraduationCap size={10} />
                                        <span>{cName}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveCourseFromStudent(u, cName)}
                                          className="text-indigo-400 hover:text-red-600 font-bold ml-0.5 text-xs"
                                          title="退出此課程"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuickAddCourseUserId(isQuickAddingCourse ? null : u.username);
                                      setQuickAddCourseSelected('');
                                    }}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 border border-indigo-200 shadow-2xs"
                                    title="為此學生快速加選課程"
                                  >
                                    <Plus size={10} />
                                    <span>加選</span>
                                  </button>
                                </div>

                                {/* 快速加選下拉列 */}
                                {isQuickAddingCourse && (
                                  <div className="p-2 bg-indigo-50/80 rounded-xl border border-indigo-200 flex items-center gap-2 mt-1">
                                    <select
                                      value={quickAddCourseSelected}
                                      onChange={(e) => setQuickAddCourseSelected(e.target.value)}
                                      className="flex-1 p-1 bg-white border border-indigo-200 rounded text-xs outline-none"
                                    >
                                      <option value="">-- 請選擇欲加選之課程 --</option>
                                      {branchCourses.map((cName) => (
                                        <option key={cName} value={cName}>{cName}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      disabled={!quickAddCourseSelected}
                                      onClick={() => handleQuickAddCourse(u)}
                                      className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                      確認加選
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setQuickAddCourseUserId(null)}
                                      className="p-1 text-gray-400 hover:text-gray-600"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

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
                          </>
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
        {/* ⭐ 批次修改彈窗 */}
        {showBatchModal && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                    <Sliders size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900">批次修改帳戶資料</h3>
                    <p className="text-[11px] text-gray-500">已選取 {selectedUsernames.filter((un) => un !== 'admin').length} 個帳戶</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 選擇修改操作類型 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">請選擇要批次執行的修改動作：</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setBatchActionType('branch')}
                    className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                      batchActionType === 'branch'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-100'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    🏫 變更學校/分校
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchActionType('class')}
                    className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                      batchActionType === 'class'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-100'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    🎒 變更班別
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchActionType('add_course')}
                    className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                      batchActionType === 'add_course'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-100'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    ➕ 集體加選課程
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchActionType('remove_course')}
                    className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                      batchActionType === 'remove_course'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-100'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    ➖ 集體退選課程
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchActionType('password')}
                    className={`col-span-2 p-2.5 rounded-xl border text-left font-bold transition-all ${
                      batchActionType === 'password'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-100'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    🔑 統一重設 8 位數字密碼
                  </button>
                </div>
              </div>

              {/* 依動作顯示具體選項 */}
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                {batchActionType === 'branch' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">目標學校/分校：</label>
                    <select
                      value={batchTargetBranch}
                      onChange={(e) => setBatchTargetBranch(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-semibold outline-none focus:border-purple-600"
                    >
                      <option value="" disabled>請選擇要指派的學校/分校...</option>
                      {branches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}

                {batchActionType === 'class' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">目標班別：</label>
                    <select
                      value={batchTargetClass}
                      onChange={(e) => setBatchTargetClass(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-semibold outline-none focus:border-purple-600"
                    >
                      <option value="" disabled>請選擇要指派的班別...</option>
                      {classes.map((c) => (
                        <option key={c} value={c}>{c} 班</option>
                      ))}
                    </select>
                  </div>
                )}

                {batchActionType === 'add_course' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">要加選的課程：</label>
                    <select
                      value={batchTargetCourse}
                      onChange={(e) => setBatchTargetCourse(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-semibold outline-none focus:border-purple-600"
                    >
                      <option value="" disabled>請選擇要為選取學生集體加選的課程...</option>
                      {courseNames.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                {batchActionType === 'remove_course' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">要退選的課程：</label>
                    <select
                      value={batchTargetCourse}
                      onChange={(e) => setBatchTargetCourse(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-semibold outline-none focus:border-purple-600"
                    >
                      <option value="" disabled>請選擇要為選取學生集體退選的課程...</option>
                      {courseNames.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-500 mt-1">退選後將保留學生會員身分及帳戶，絕不刪除會員。</p>
                  </div>
                )}

                {batchActionType === 'password' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">新設定的 8 位數字密碼：</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={8}
                        value={batchTargetPassword}
                        onChange={(e) => setBatchTargetPassword(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder="8 位純數字"
                        className="flex-1 bg-white border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold outline-none focus:border-purple-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          let rand = '';
                          for (let i = 0; i < 8; i++) rand += Math.floor(Math.random() * 10).toString();
                          setBatchTargetPassword(rand);
                        }}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold shrink-0 transition-colors"
                      >
                        隨機生成
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 操作按鈕 */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleApplyBatchModify}
                  disabled={batchProcessing}
                  className="px-5 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 text-white rounded-xl text-xs font-bold hover:opacity-95 shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {batchProcessing ? '處理中...' : '確認套用批次修改'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
