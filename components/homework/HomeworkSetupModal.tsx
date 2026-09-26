import React, { useState } from 'react';
import { UserProfile } from '@/components/auth/AuthModal';
import {
  X, Plus, Trash2, Settings, MapPin, GraduationCap, Layers, Edit2, Check, RotateCcw, BookmarkCheck,
  Clock, Calendar, CheckSquare, Square, ChevronDown, ChevronUp, AlertCircle, Sparkles, Filter,
  BookOpen, ChevronRight, GripVertical, Users
} from 'lucide-react';

export type CourseStatus = 'active' | 'planning' | 'ended' | 'paused';

export interface CourseScheduleRule {
  startDate?: string;
  endDate?: string;
  weekdays?: number[]; // 0=週日, 1=週一, 2=週二, 3=週三, 4=週四, 5=週五, 6=週六
  excludedDates?: string[]; // 剔除之日子 (YYYY-MM-DD)
}

export interface CourseItem {
  id: string;
  name: string;             // 課程名稱
  branch?: string;          // ⭐ 為那間學校/分校的課程 (所屬學校)
  targetClasses?: string[]; // 目標班別
  timeSlot?: string;        // 課程時間 (例如 "14:00 - 15:30")
  totalSessions?: number;   // 課程節數 (例如 8)
  sessionDates: string[];   // 課程每節日期清單 (YYYY-MM-DD[])
  scheduleRule?: CourseScheduleRule; // 週排程與排除日期規則
  status: CourseStatus;     // 課程狀態
}

// ⭐ 需求 2：學校/分校名稱與代號解析輔助函數
export interface BranchInfo {
  name: string;
  code: string;
  full: string;
}

export const parseBranchInfo = (b: string): BranchInfo => {
  if (!b) return { name: '', code: '', full: '' };
  const trimmed = b.trim();
  const match = trimmed.match(/^(.+?)\s*[\(（]([A-Za-z0-9_-]+)[\)）]$/);
  if (match) {
    return { name: match[1].trim(), code: match[2].trim().toUpperCase(), full: trimmed };
  }
  const prefixMatch = trimmed.match(/^([A-Za-z0-9_-]+)\s*[-_:]\s*(.+)$/);
  if (prefixMatch) {
    return { name: prefixMatch[2].trim(), code: prefixMatch[1].trim().toUpperCase(), full: trimmed };
  }
  return { name: trimmed, code: '', full: trimmed };
};



// 輔助函式：標準化課程項目
export const normalizeCourse = (c: string | CourseItem): CourseItem => {
  if (typeof c === 'string') {
    return {
      id: 'c_' + encodeURIComponent(c),
      name: c,
      branch: '',
      timeSlot: '',
      totalSessions: 0,
      sessionDates: [],
      status: 'active',
    };
  }
  return {
    ...c,
    branch: c.branch || '',
    sessionDates: Array.isArray(c.sessionDates) ? c.sessionDates : [],
    status: c.status || 'active',
  };
};

export const getCourseName = (c: string | CourseItem): string => {
  return typeof c === 'string' ? c : c.name;
};

// ⭐ 輔助函式：生成「課程名稱 + (課程時間)」顯示格式
export const getCourseDisplayName = (c: string | CourseItem): string => {
  if (typeof c === 'string') return c;
  if (c.timeSlot && c.timeSlot.trim()) {
    const slot = c.timeSlot.trim();
    if (c.name.includes(slot)) return c.name;
    return `${c.name} (${slot})`;
  }
  return c.name;
};

// ⭐ 輔助函式：清理時段字串 (去除所有空白以便嚴格比對)
export const cleanCourseTimeSlot = (s?: string): string => {
  return (s || '').replace(/\s+/g, '').toLowerCase();
};

// ⭐ 輔助函式：自課程字串中萃取「基礎名稱」與「時段」
export const extractCourseBaseAndSlot = (courseStr: string): { base: string; slot: string } => {
  const s = (courseStr || '').trim();
  const m = s.match(/\(([^)]+)\)$/);
  if (m) {
    return {
      base: s.slice(0, m.index).trim(),
      slot: cleanCourseTimeSlot(m[1]),
    };
  }
  return { base: s, slot: '' };
};

// ⭐ 輔助函式：標準化課程名稱 (去除方括號代碼與分校前綴，避免誤比對)
export const normalizeCourseBaseName = (name: string): string => {
  let s = (name || '').trim();
  s = s.replace(/^\[[^\]]+\]\s*/, '');
  s = s.replace(/^[^\-：:]{2,10}[\-：:]\s*/, '');
  return s.trim().toLowerCase();
};

// ⭐ 輔助函式：精準比對修讀課程與目標課程 (避免子字串模糊匹配、支援分校與時段驗證)
export const isCourseMatch = (
  enrolledCourse: string,
  cName: string,
  cTimeSlot?: string,
  cBranch?: string,
  studentBranch?: string
): boolean => {
  if (!enrolledCourse || !cName) return false;

  // 1. 分校比對：若兩者皆具體指定分校，分校不符則不計算
  const cb = (cBranch || '').trim().toLowerCase();
  const sb = (studentBranch || '').trim().toLowerCase();
  if (
    cb &&
    cb !== '全部分校' &&
    cb !== '全部' &&
    cb !== 'all' &&
    sb &&
    sb !== '全部分校' &&
    sb !== '全部' &&
    sb !== 'all'
  ) {
    const cbClean = cb.replace(/\([^)]*\)/g, '').trim();
    const sbClean = sb.replace(/\([^)]*\)/g, '').trim();
    if (cbClean && sbClean && cbClean !== sbClean && !cbClean.includes(sbClean) && !sbClean.includes(cbClean)) {
      return false;
    }
  }

  // 2. 課程基礎名稱與時段萃取
  const ec = extractCourseBaseAndSlot(enrolledCourse);
  const target = extractCourseBaseAndSlot(cName);
  const targetSlot = cTimeSlot ? cleanCourseTimeSlot(cTimeSlot) : target.slot;

  const ecBaseNorm = normalizeCourseBaseName(ec.base);
  const targetBaseNorm = normalizeCourseBaseName(target.base);

  // 基礎名稱必須嚴格一致（避免「中文」誤匹配「小一中文」或「奧數」）
  if (ecBaseNorm !== targetBaseNorm) {
    return false;
  }

  // 3. 若兩者皆有具體時段，時段若衝突則不匹配
  if (ec.slot && targetSlot && ec.slot !== targetSlot) {
    return false;
  }

  return true;
};


// 輔助函式：狀態標籤資訊
export const getCourseStatusMeta = (status: CourseStatus = 'active') => {
  switch (status) {
    case 'active':
      return { label: '進行中', badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
    case 'planning':
      return { label: '籌劃中', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200' };
    case 'ended':
      return { label: '已完結', badgeClass: 'bg-gray-100 text-gray-500 border border-gray-200' };
    case 'paused':
      return { label: '已暫停', badgeClass: 'bg-red-50 text-red-600 border border-red-200' };
    default:
      return { label: '進行中', badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
  }
};

// 星期對照
export const WEEKDAYS_MAP = [
  { day: 1, label: '一' },
  { day: 2, label: '二' },
  { day: 3, label: '三' },
  { day: 4, label: '四' },
  { day: 5, label: '五' },
  { day: 6, label: '六' },
  { day: 0, label: '日' },
];

export const formatWeekdayCN = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    const day = d.getDay();
    const map = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    return map[day] || '';
  } catch {
    return '';
  }
};

// 依日期區間、每週幾及排除特定日期自動生成課堂每節日期
export const generateSessionDates = (
  startDate: string,
  endDate: string,
  weekdays: number[],
  excludedDates: string[] = []
): string[] => {
  if (!startDate || !endDate || !weekdays || weekdays.length === 0) return [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) return [];

  const result: string[] = [];
  const current = new Date(start);
  const excludedSet = new Set(excludedDates);

  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon...
    const isoDate = current.toISOString().split('T')[0];
    if (weekdays.includes(dayOfWeek) && !excludedSet.has(isoDate)) {
      result.push(isoDate);
    }
    current.setDate(current.getDate() + 1);
  }
  return result;
};

interface HomeworkSetupModalProps {
  isOpen?: boolean;
  isInline?: boolean; // ⭐ 支援滿板顯示 (非浮動彈窗)
  mode?: 'all' | 'courses_only' | 'settings_only'; // ⭐ 課程目錄中只保留課程設定；設定按鍵只保留學校/分校及班別設定
  onClose?: () => void;
  onOpenCourseContent?: (courseName: string, branch?: string, isLocked?: boolean) => void; // ⭐ 點擊課程打開課程單元及單元家課 (支援鎖定選項)
  branches: string[];
  classes: string[];
  courses: (string | CourseItem)[];
  onUpdateBranches: (branches: string[]) => void;
  onUpdateClasses: (classes: string[]) => void;
  onUpdateCourses: (courses: (string | CourseItem)[]) => void;
  onRenameCourse?: (oldName: string, newName: string) => void;
  onRenameClass?: (oldName: string, newName: string) => void;
  onRenameBranch?: (oldName: string, newName: string) => void;
  isReadOnly?: boolean;
  currentUser?: UserProfile | null;
  usersList?: UserProfile[]; // ⭐ 需求 7：用以計算各課程已參加學生人數
}

export const HomeworkSetupModal: React.FC<HomeworkSetupModalProps> = ({
  isOpen = true,
  isInline = false,
  mode = 'all',
  onClose,
  onOpenCourseContent,
  branches,
  classes,
  courses,
  onUpdateBranches,
  onUpdateClasses,
  onUpdateCourses,
  onRenameCourse,
  onRenameClass,
  onRenameBranch,
  isReadOnly = false,
  currentUser = null,
  usersList = [],
}) => {
  // ⭐ 標準化課程項目清單 (置於 Hook 前以供計算各項指標)
  const normalizedCourses = React.useMemo(() => courses.map(normalizeCourse), [courses]);

  // 監聽本機儲存與視窗焦點變動以即時重算人數
  const [refreshCountsSeed, setRefreshCountsSeed] = useState(0);
  React.useEffect(() => {
    const handleStorageChange = () => setRefreshCountsSeed((prev) => prev + 1);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
    };
  }, []);

  // ⭐ 需求 1：精準計算各課程已參加之學生人數 (單一學生分校+姓名唯一去重、時段與分校精準匹配、排除模糊包含錯誤)
  const courseStudentCounts = React.useMemo(() => {
    const studentMap = new Map<string, {
      name: string;
      branch: string;
      className: string;
      enrolledCourses: Set<string>;
    }>();

    // 1. 整理 usersList 中學生帳號
    let effectiveUsers: UserProfile[] = usersList || [];
    if (typeof window !== 'undefined' && effectiveUsers.length === 0) {
      try {
        const raw = localStorage.getItem('oc_users_list');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) effectiveUsers = parsed;
        }
      } catch (e) {}
    }

    effectiveUsers.forEach((u) => {
      if (u.role === 'student') {
        const sName = (u.name || (u as any).studentName || u.username || '').trim();
        const sBranch = (u.branch || '').trim();
        const sClass = (u.className || '').trim();
        if (!sName) return;

        // 使用「分校 + 姓名」作為學生唯一識別標識
        const studentKey = `${sBranch.toLowerCase()}___${sName.toLowerCase()}`;
        if (!studentMap.has(studentKey)) {
          studentMap.set(studentKey, {
            name: sName,
            branch: sBranch,
            className: sClass,
            enrolledCourses: new Set<string>()
          });
        }

        const record = studentMap.get(studentKey)!;
        if (Array.isArray(u.enrolledCourses)) {
          u.enrolledCourses.forEach((cr) => {
            if (cr && typeof cr === 'string' && cr.trim()) {
              record.enrolledCourses.add(cr.trim());
            }
          });
        }
      }
    });

    // 2. 整合 oc_local_students (會員名冊快取)，同一學生自動合併，不重複計數
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('oc_local_students');
        if (raw) {
          const list: any[] = JSON.parse(raw);
          list.forEach((s) => {
            const sName = (s.student_name || '').trim();
            const sBranch = (s.branch || '').trim();
            const sClass = (s.class_name || '').trim();
            if (!sName) return;

            const studentKey = `${sBranch.toLowerCase()}___${sName.toLowerCase()}`;
            if (!studentMap.has(studentKey)) {
              studentMap.set(studentKey, {
                name: sName,
                branch: sBranch,
                className: sClass,
                enrolledCourses: new Set<string>()
              });
            }

            const record = studentMap.get(studentKey)!;
            const sCourse = (s.course_name || '').trim();
            if (sCourse) {
              record.enrolledCourses.add(sCourse);
            }
          });
        }
      } catch (e) {}
    }

    const students = Array.from(studentMap.values());
    const counts = new Map<string, number>();

    normalizedCourses.forEach((c) => {
      let count = 0;
      students.forEach((st) => {
        for (const enrolled of st.enrolledCourses) {
          if (isCourseMatch(enrolled, c.name, c.timeSlot, c.branch, st.branch)) {
            count++;
            break;
          }
        }
      });
      counts.set(c.id, count);
    });

    return counts;
  }, [usersList, normalizedCourses, refreshCountsSeed]);

  const getEnrolledStudentCount = (c: CourseItem): number => {
    return courseStudentCounts.get(c.id) || 0;
  };

  // 順序：課程、學校/分校、班別。根據 mode 決定初始分頁
  const initialTab = mode === 'settings_only' ? 'branches' : 'courses';
  const [activeTab, setActiveTab] = useState<'courses' | 'branches' | 'classes'>(initialTab);

  React.useEffect(() => {
    if (mode === 'settings_only' && activeTab === 'courses') {
      setActiveTab('branches');
    } else if (mode === 'courses_only' && activeTab !== 'courses') {
      setActiveTab('courses');
    }
  }, [mode, activeTab]);

  // ⭐ 需求：學校與班別設定中學校及班別可以按著拖動更改排序，按完成設定時確定儲存並更新資料庫
  const [localBranches, setLocalBranches] = useState<string[]>(branches);
  const [localClasses, setLocalClasses] = useState<string[]>(classes);

  React.useEffect(() => {
    setLocalBranches(branches);
  }, [branches, isOpen]);

  React.useEffect(() => {
    setLocalClasses(classes);
  }, [classes, isOpen]);

  // 拖動狀態 (Drag & Drop)
  const [draggedBranchIndex, setDraggedBranchIndex] = useState<number | null>(null);
  const [dragOverBranchIndex, setDragOverBranchIndex] = useState<number | null>(null);

  const [draggedClassIndex, setDraggedClassIndex] = useState<number | null>(null);
  const [dragOverClassIndex, setDragOverClassIndex] = useState<number | null>(null);

  // 1. 學校拖動處理
  const handleBranchDragStart = (e: React.DragEvent, index: number) => {
    setDraggedBranchIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleBranchDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverBranchIndex !== index) {
      setDragOverBranchIndex(index);
    }
  };

  const handleBranchDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedBranchIndex === null || draggedBranchIndex === targetIndex) {
      setDraggedBranchIndex(null);
      setDragOverBranchIndex(null);
      return;
    }
    const updated = [...localBranches];
    const [moved] = updated.splice(draggedBranchIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setLocalBranches(updated);
    setDraggedBranchIndex(null);
    setDragOverBranchIndex(null);
  };

  const handleBranchDragEnd = () => {
    setDraggedBranchIndex(null);
    setDragOverBranchIndex(null);
  };

  // 2. 班別拖動處理
  const handleClassDragStart = (e: React.DragEvent, index: number) => {
    setDraggedClassIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleClassDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverClassIndex !== index) {
      setDragOverClassIndex(index);
    }
  };

  const handleClassDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedClassIndex === null || draggedClassIndex === targetIndex) {
      setDraggedClassIndex(null);
      setDragOverClassIndex(null);
      return;
    }
    const updated = [...localClasses];
    const [moved] = updated.splice(draggedClassIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setLocalClasses(updated);
    setDraggedClassIndex(null);
    setDragOverClassIndex(null);
  };

  const handleClassDragEnd = () => {
    setDraggedClassIndex(null);
    setDragOverClassIndex(null);
  };

  // 輔助微調移動 (上移 / 下移) - 兼顧手機點擊與極致流暢性
  const handleMoveBranch = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= localBranches.length) return;
    const updated = [...localBranches];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setLocalBranches(updated);
  };

  const handleMoveClass = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= localClasses.length) return;
    const updated = [...localClasses];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setLocalClasses(updated);
  };

  // 學校/分校、班別、功課範本一般輸入狀態 (加入學校代號)
  const [newBranch, setNewBranch] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [editBranchCode, setEditBranchCode] = useState('');
  const [newClass, setNewClass] = useState('');
  
  

  // 學校/分校、班別、功課範本行內編輯狀態
  const [editingItem, setEditingItem] = useState<{ type: string; id: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDescValue, setEditDescValue] = useState('');

  // ⭐ 課程進階設定表單狀態 (支援：名稱、時段、節數、每節日期、排程、剔除日子、狀態)
  const [isCourseFormOpen, setIsCourseFormOpen] = useState(false);
  const [editingCourseTargetId, setEditingCourseTargetId] = useState<string | null>(null); // null 代表新增

  // 課程表單欄位
  const [courseFormName, setCourseFormName] = useState('');
  const [courseFormBranch, setCourseFormBranch] = useState(''); // ⭐ 為那間學校/分校的課程
  const [courseFormStatus, setCourseFormStatus] = useState<CourseStatus | ''>(''); // ⭐ 預設不預選或填上課程狀態
  const [courseFormTimeSlot, setCourseFormTimeSlot] = useState('');
  const [courseFormStartTime, setCourseFormStartTime] = useState('14:00');
  const [courseFormEndTime, setCourseFormEndTime] = useState('15:30');
  const [courseFormTotalSessions, setCourseFormTotalSessions] = useState<number>(8);
  const [courseFormSessionDates, setCourseFormSessionDates] = useState<string[]>([]);

  // 課程自動排程設定
  const [schedStartDate, setSchedStartDate] = useState('');
  const [schedEndDate, setSchedEndDate] = useState('');
  const [schedWeekdays, setSchedWeekdays] = useState<number[]>([2, 4]); // 預設逢二、四
  const [schedExcludedDates, setSchedExcludedDates] = useState<string[]>([]);
  const [singleDateToAdd, setSingleDateToAdd] = useState('');
  const [singleDateToExclude, setSingleDateToExclude] = useState('');

  // 卡片展開查看每節日期狀態
  const [expandedCourseIds, setExpandedCourseIds] = useState<string[]>([]);
  // ⭐ 需求 5：設定課程版面 Filter
  const [courseFilterBranch, setCourseFilterBranch] = useState('全部分校');
  const [courseFilterStatus, setCourseFilterStatus] = useState<string>('all');
  const [courseSearchKeyword, setCourseSearchKeyword] = useState('');

  // --- ⭐ 課程 (Courses) 相關操作 ---
  // ⭐ 需求 1：當離開新增/編輯課程板面時清空所有資料
  const handleCloseCourseForm = () => {
    setEditingCourseTargetId(null);
    setCourseFormName('');
    setCourseFormBranch('');
    setCourseFormStatus('');
    setCourseFormTimeSlot('');
    setCourseFormStartTime('');
    setCourseFormEndTime('');
    setCourseFormTotalSessions(0);
    setCourseFormSessionDates([]);
    setSchedStartDate('');
    setSchedEndDate('');
    setSchedWeekdays([]);
    setSchedExcludedDates([]);
    setSingleDateToAdd('');
    setSingleDateToExclude('');
    setIsCourseFormOpen(false); // ⭐ 關閉表單，嚴格避免自我遞迴調用
  };

  // ⭐ 需求 2：所有板面離開後或按完成或按取消應該清空或還原預設值
  const handleResetAllStates = () => {
    handleCloseCourseForm();
    setEditingItem(null);
    setEditValue('');
    setEditDescValue('');
    setNewBranch('');
    setNewBranchCode('');
    setEditBranchCode('');
    setNewClass('');
    setLocalBranches(branches);
    setLocalClasses(classes);
    setDraggedBranchIndex(null);
    setDragOverBranchIndex(null);
    setDraggedClassIndex(null);
    setDragOverClassIndex(null);
    setCourseFilterBranch('全部分校');
    setCourseFilterStatus('all');
    setCourseSearchKeyword('');
    setExpandedCourseIds([]);
    setActiveTab(mode === 'settings_only' ? 'branches' : 'courses');
  };

  // ⭐ 需求：按完成設定時確定儲存並更新資料庫
  const handleSaveAndConfirmSettings = () => {
    onUpdateBranches(localBranches);
    onUpdateClasses(localClasses);
    alert('✅ 學校與班別設定及排序已成功儲存並更新至資料庫！');
    handleCloseModal();
  };

  const handleCloseModal = () => {
    handleResetAllStates();
    if (onClose) onClose();
  };

  const prevOpenRef = React.useRef(isOpen);
  React.useEffect(() => {
    if (prevOpenRef.current && !isOpen && !isInline) {
      handleResetAllStates();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, isInline]);

  if (!isOpen && !isInline) return null;

  // ⭐ 需求 5：課程篩選邏輯
  const filteredNormalizedCourses = normalizedCourses.filter((c) => {
    // 1. 學校篩選
    const matchBranch =
      courseFilterBranch === '全部分校' ||
      !c.branch ||
      c.branch === '全部分校' ||
      c.branch === courseFilterBranch;
    // 2. 狀態篩選
    const matchStatus = courseFilterStatus === 'all' || c.status === courseFilterStatus;
    // 3. 關鍵字搜尋
    const matchKeyword =
      !courseSearchKeyword.trim() ||
      c.name.toLowerCase().includes(courseSearchKeyword.toLowerCase()) ||
      (c.timeSlot && c.timeSlot.toLowerCase().includes(courseSearchKeyword.toLowerCase())) ||
      (c.branch && c.branch.toLowerCase().includes(courseSearchKeyword.toLowerCase()));
    return matchBranch && matchStatus && matchKeyword;
  });

  // --- ⭐ 課程 (Courses) 相關操作 ---
  // ⭐ 需求 1：新增課程打開後不要預選學校、課程狀態、時間、節數、排程日期、逢星期幾上課
  const handleOpenAddCourse = () => {
    setEditingCourseTargetId(null);
    setCourseFormName('');
    setCourseFormBranch(''); // 不要預選學校
    setCourseFormStatus(''); // 不要預選或填上課程狀態
    setCourseFormTimeSlot(''); // 不要預選或填上課程時間
    setCourseFormStartTime('');
    setCourseFormEndTime('');
    setCourseFormTotalSessions(0); // 不要預選或填上總節數
    setCourseFormSessionDates([]);
    setSchedStartDate(''); // 不要預選或填上自動排程日期
    setSchedEndDate('');
    setSchedWeekdays([]); // 不要預選逢星期幾上課
    setSchedExcludedDates([]);
    setSingleDateToAdd('');
    setSingleDateToExclude('');
    setIsCourseFormOpen(true);
  };

  // 打開編輯課程表單
  const handleOpenEditCourse = (c: CourseItem) => {
    setEditingCourseTargetId(c.id);
    setCourseFormName(c.name);
    setCourseFormBranch(c.branch || (branches[0] || ''));
    setCourseFormStatus(c.status || 'active');
    setCourseFormTimeSlot(c.timeSlot || '');
    if (c.timeSlot && c.timeSlot.includes('-')) {
      const parts = c.timeSlot.split('-').map((p) => p.trim());
      if (parts[0]) setCourseFormStartTime(parts[0]);
      if (parts[1]) setCourseFormEndTime(parts[1]);
    }
    setCourseFormTotalSessions(c.totalSessions || (c.sessionDates?.length || 0));
    setCourseFormSessionDates(c.sessionDates || []);
    setSchedStartDate(c.scheduleRule?.startDate || new Date().toISOString().split('T')[0]);
    setSchedEndDate(c.scheduleRule?.endDate || '');
    setSchedWeekdays(c.scheduleRule?.weekdays || [1]);
    setSchedExcludedDates(c.scheduleRule?.excludedDates || []);
    setSingleDateToAdd('');
    setSingleDateToExclude('');
    setIsCourseFormOpen(true);
  };

  // 儲存課程 (新增或更新)
  const handleSaveCourseForm = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = courseFormName.trim();
    if (!finalName) {
      alert('請填寫課程名稱！');
      return;
    }

    const finalTime = courseFormTimeSlot.trim() || `${courseFormStartTime} - ${courseFormEndTime}`;
    const dates = Array.from(new Set(courseFormSessionDates)).sort();
    const totalCount = courseFormTotalSessions > 0 ? courseFormTotalSessions : dates.length;

    const newCourseItem: CourseItem = {
      id: editingCourseTargetId || 'c_' + Date.now(),
      name: finalName,
      branch: courseFormBranch.trim(),
      timeSlot: finalTime,
      totalSessions: totalCount,
      sessionDates: dates,
      scheduleRule: {
        startDate: schedStartDate,
        endDate: schedEndDate,
        weekdays: schedWeekdays,
        excludedDates: schedExcludedDates,
      },
      status: (courseFormStatus as CourseStatus) || 'active',
    };

    if (editingCourseTargetId) {
      // 更新 (⭐ 只有相同學校、時段及名稱，才顯示課程已存在，排除自身)
      const oldCourse = normalizedCourses.find((c) => c.id === editingCourseTargetId);
      const isDuplicate = normalizedCourses.some(
        (c) =>
          c.id !== editingCourseTargetId &&
          (c.name || '').trim().toLowerCase() === finalName.toLowerCase() &&
          (c.branch || '').trim().toLowerCase() === courseFormBranch.trim().toLowerCase() &&
          (c.timeSlot || '').trim() === finalTime.trim()
      );
      if (isDuplicate) {
        const branchMsg = courseFormBranch.trim() ? `學校「${courseFormBranch.trim()}」` : '同一學校';
        alert(`${branchMsg}已存在相同時段（${finalTime}）且名稱為「${finalName}」的課程！`);
        return;
      }

      const updated = normalizedCourses.map((c) => (c.id === editingCourseTargetId ? newCourseItem : c));
      try {
        localStorage.setItem('oc_settings_courses', JSON.stringify(updated));
      } catch (e) {}
      onUpdateCourses(updated);
      if (oldCourse && oldCourse.name !== finalName && onRenameCourse) {
        onRenameCourse?.(oldCourse.name, finalName);
      }
    } else {
      // 新增 (⭐ 只有相同學校、時段及名稱，才顯示課程已存在)
      const isDuplicate = normalizedCourses.some(
        (c) =>
          (c.name || '').trim().toLowerCase() === finalName.toLowerCase() &&
          (c.branch || '').trim().toLowerCase() === courseFormBranch.trim().toLowerCase() &&
          (c.timeSlot || '').trim() === finalTime.trim()
      );
      if (isDuplicate) {
        const branchMsg = courseFormBranch.trim() ? `學校「${courseFormBranch.trim()}」` : '此學校';
        alert(`${branchMsg}已存在相同時段（${finalTime}）且名稱為「${finalName}」的課程！`);
        return;
      }
      const updated = [...normalizedCourses, newCourseItem];
      try {
        localStorage.setItem('oc_settings_courses', JSON.stringify(updated));
      } catch (e) {}
      onUpdateCourses(updated);
    }

    handleCloseCourseForm();
  };

  // 刪除課程
  const handleDeleteCourse = (targetId: string, targetName: string) => {
    if (!window.confirm(`確定要刪除課程「${targetName}」嗎？`)) return;
    const remaining = normalizedCourses.filter((c) => c.id !== targetId && c.name !== targetName);
    try {
      localStorage.setItem('oc_settings_courses', JSON.stringify(remaining));
    } catch (e) {}
    onUpdateCourses(remaining);
  };

  // 一鍵清空全部課程
  const handleClearAllCourses = () => {
    if (!window.confirm('確定要清空全部已設定的課程嗎？此動作無法還原。')) return;
    onUpdateCourses([]);
  };

  // 課堂自動生成日期
  const handleRunAutoSchedule = () => {
    if (!schedStartDate || !schedEndDate) {
      alert('請先指定開始日期與結束日期！');
      return;
    }
    if (schedWeekdays.length === 0) {
      alert('請至少勾選一週中的一個星期幾！');
      return;
    }
    const generated = generateSessionDates(schedStartDate, schedEndDate, schedWeekdays, schedExcludedDates);
    if (generated.length === 0) {
      alert('在所選日期區間與星期內，未能找到任何有效課堂日期！');
      return;
    }
    setCourseFormSessionDates(generated);
    setCourseFormTotalSessions(generated.length);
  };

  // 自由加入單日
  const handleAddSingleDate = () => {
    if (!singleDateToAdd) return;
    if (courseFormSessionDates.includes(singleDateToAdd)) {
      alert(`日期 ${singleDateToAdd} 已在每節課堂清單中！`);
      return;
    }
    const updated = [...courseFormSessionDates, singleDateToAdd].sort();
    setCourseFormSessionDates(updated);
    setCourseFormTotalSessions(updated.length);
    // 若該日曾在排除清單中，自動從排除清單移除
    setSchedExcludedDates((prev) => prev.filter((d) => d !== singleDateToAdd));
    setSingleDateToAdd('');
  };

  // 剔除特定日子 (從清單移除並記錄於已剔除)
  const handleRemoveDate = (dateToRemove: string) => {
    if (!window.confirm(`確定要剔除此日課堂 (${dateToRemove}) 嗎？`)) return;
    const remaining = courseFormSessionDates.filter((d) => d !== dateToRemove);
    setCourseFormSessionDates(remaining);
    setCourseFormTotalSessions(remaining.length);
    if (!schedExcludedDates.includes(dateToRemove)) {
      setSchedExcludedDates((prev) => [...prev, dateToRemove].sort());
    }
  };

  // 恢復被剔除的日子
  const handleRestoreExcludedDate = (dateToRestore: string) => {
    setSchedExcludedDates((prev) => prev.filter((d) => d !== dateToRestore));
    if (!courseFormSessionDates.includes(dateToRestore)) {
      const updated = [...courseFormSessionDates, dateToRestore].sort();
      setCourseFormSessionDates(updated);
      setCourseFormTotalSessions(updated.length);
    }
  };

  // 切換星期幾勾選
  const toggleWeekday = (day: number) => {
    setSchedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  // 切換課程每節日期折疊
  const toggleExpandCourse = (courseId: string) => {
    setExpandedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  // --- 2. 學校 / 分校 (Branches) 操作 (支援名稱與代號) ---
  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newBranch.trim();
    if (!val) {
      alert('請填寫學校/分校名稱！');
      return;
    }
    const code = newBranchCode.trim().toUpperCase();
    const formatted = code ? `${val} (${code})` : val;
    if (localBranches.includes(formatted)) {
      alert('該學校/分校名稱或代號已存在！');
      return;
    }
    setLocalBranches((prev) => [...prev, formatted]);
    setNewBranch('');
    setNewBranchCode('');
  };

  const handleStartEditBranch = (b: string) => {
    const info = parseBranchInfo(b);
    setEditingItem({ type: 'branch', id: b });
    setEditValue(info.name);
    setEditBranchCode(info.code);
  };

  const handleSaveEditBranch = (oldBranch: string) => {
    const val = editValue.trim();
    if (!val) return;
    const code = editBranchCode.trim().toUpperCase();
    const formatted = code ? `${val} (${code})` : val;
    if (formatted !== oldBranch) {
      if (localBranches.includes(formatted)) {
        alert('已存在相同名稱或代號的學校/分校！');
        return;
      }
      setLocalBranches((prev) => prev.map((b) => (b === oldBranch ? formatted : b)));
      if (onRenameBranch) onRenameBranch?.(oldBranch, formatted);
    }
    setEditingItem(null);
  };

  const handleDeleteBranch = (target: string) => {
    if (!window.confirm(`確定要刪除學校/分校「${target}」嗎？`)) return;
    setLocalBranches((prev) => prev.filter((b) => b !== target));
  };

  const handleClearAllBranches = () => {
    if (!window.confirm('確定要清空全部已設定的學校/分校嗎？')) return;
    setLocalBranches([]);
  };

  // --- 3. 班別 (Classes) 操作 ---
  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newClass.trim();
    if (!val) return;
    if (localClasses.includes(val)) {
      alert('該班別名稱已存在！');
      return;
    }
    setLocalClasses((prev) => [...prev, val]);
    setNewClass('');
  };

  const handleStartEditClass = (c: string) => {
    setEditingItem({ type: 'class', id: c });
    setEditValue(c);
  };

  const handleSaveEditClass = (oldClass: string) => {
    const val = editValue.trim();
    if (!val) return;
    if (val !== oldClass) {
      if (localClasses.includes(val)) {
        alert('已存在相同名稱的班別！');
        return;
      }
      setLocalClasses((prev) => prev.map((c) => (c === oldClass ? val : c)));
      if (onRenameClass) onRenameClass?.(oldClass, val);
    }
    setEditingItem(null);
  };

  const handleDeleteClass = (target: string) => {
    if (!window.confirm(`確定要刪除班別「${target}」嗎？`)) return;
    setLocalClasses((prev) => prev.filter((c) => c !== target));
  };

  const handleClearAllClasses = () => {
    if (!window.confirm('確定要清空全部已設定的班別嗎？')) return;
    setLocalClasses([]);
  };

  const mainContent = (
    <div className={`bg-white w-full ${isInline ? 'flex-1 flex flex-col min-h-0' : 'max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]'}`}>
      {/* 頂部標題 */}
      {!isInline ? (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-3.5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            {mode === 'settings_only' ? <Settings size={18} /> : <GraduationCap size={18} />}
            <div>
              <h4 className="font-bold text-base leading-tight">
                {mode === 'settings_only' ? '學校與班別設定' : '課程與班別設定'}
              </h4>
              <p className="text-[10px] text-white/80">
                {mode === 'settings_only' ? '管理學校/分校與班別名冊' : '管理各校課程、上課時段、每節排程、學校及班別名冊'}
              </p>
            </div>
          </div>
          <button onClick={handleCloseModal} className="text-white/80 hover:text-white p-1" title="關閉">
            <X size={20} />
          </button>
        </div>
      ) : (
        <div className="bg-white px-4 py-3 border-b border-gray-150 flex justify-between items-center shrink-0 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <GraduationCap size={20} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-gray-800 leading-tight">
                {mode === 'courses_only' ? '課程設定與排程管理' : '課程與班級設定'}
              </h4>
              <p className="text-[10px] text-gray-400">
                {mode === 'courses_only' ? '管理各校課程名稱、時段、每節課堂日期與自動排程' : '管理各校課程、上課時段、自動排程、學校與班別名冊'}
              </p>
            </div>
          </div>
        </div>
      )}

        {/* 標籤頁導航 (⭐ 課程目錄中只保留課程設定；設定按鍵只保留學校/分校及班別設定) */}
        {mode === 'courses_only' ? null : (
          <div className="flex border-b border-gray-100 bg-gray-50 text-xs font-bold overflow-x-auto">
            {mode !== 'settings_only' && (
              <button
                onClick={() => { setActiveTab('courses'); setEditingItem(null); handleCloseCourseForm(); }}
                className={`flex-1 py-2.5 px-2 text-center border-b-2 whitespace-nowrap transition-colors flex items-center justify-center gap-1 ${
                  activeTab === 'courses' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-500'
                }`}
              >
                <GraduationCap size={13} />
                課程 ({normalizedCourses.length})
              </button>
            )}
            <button
              onClick={() => { setActiveTab('branches'); setEditingItem(null); handleCloseCourseForm(); }}
              className={`flex-1 py-2.5 px-2 text-center border-b-2 whitespace-nowrap transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'branches' ? 'border-purple-600 text-purple-600 bg-white' : 'border-transparent text-gray-500'
              }`}
            >
              <MapPin size={13} />
              學校/分校 ({branches.length})
            </button>
            <button
              onClick={() => { setActiveTab('classes'); setEditingItem(null); handleCloseCourseForm(); }}
              className={`flex-1 py-2.5 px-2 text-center border-b-2 whitespace-nowrap transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'classes' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-500'
              }`}
            >
              <Layers size={13} />
              班別 ({classes.length})
            </button>
          </div>
        )}

        {/* 內容區塊 */}
        <div className="p-4 overflow-y-auto flex-1 text-sm">
          {/* TAB 1: 課程設定 (Courses) - 完整支援時間、節數、每節日期、排程、剔除日子與狀態 */}
          {activeTab === 'courses' && (
            <div className="space-y-3">
              {/* 新增 / 編輯課程完整表單面板 */}
              {isCourseFormOpen ? (
                <form onSubmit={handleSaveCourseForm} className="bg-indigo-50/40 border border-indigo-200 rounded-2xl p-3.5 space-y-3">
                  <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
                    <span className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                      <GraduationCap size={15} className="text-indigo-600" />
                      <span>{editingCourseTargetId ? '編輯課程排程與詳細設定' : '新增課程詳細排程'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCloseCourseForm}
                      className="text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* 1. 課程名稱 與 所屬學校/分校 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        課程名稱 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="例：奧數思維班、兒童合唱團"
                        value={courseFormName}
                        onChange={(e) => setCourseFormName(e.target.value)}
                        className={`w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-indigo-600 placeholder:text-gray-400 ${
                          courseFormName.trim() ? 'text-black font-semibold' : 'text-gray-500'
                        }`}
                        required
                      />
                    </div>

                    {/* ⭐ 需求 1：設定為那間學校的課程 */}
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <MapPin size={12} className="text-purple-600" />
                        <span>所屬學校 / 分校 (為那間學校的課程)</span>
                      </label>
                      {branches.length > 0 ? (
                        <select
                          value={courseFormBranch}
                          onChange={(e) => setCourseFormBranch(e.target.value)}
                          className={`w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-purple-600 ${
                            courseFormBranch ? 'text-black font-semibold' : 'text-gray-500'
                          }`}
                        >
                          <option value="" className="text-gray-400">請選擇學校/分校 (未選擇則為不限分校)</option>
                          {branches.map((b) => (
                            <option key={b} value={b} className="text-black font-semibold">{b}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="輸入所屬分校 (例：總校、沙田分校)"
                          value={courseFormBranch}
                          onChange={(e) => setCourseFormBranch(e.target.value)}
                          className={`w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-purple-600 placeholder:text-gray-400 ${
                            courseFormBranch.trim() ? 'text-black font-semibold' : 'text-gray-500'
                          }`}
                        />
                      )}
                    </div>
                  </div>

                  {/* 2. 課程狀態 */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      課程狀態
                    </label>
                    <div className="grid grid-cols-4 gap-1 text-[11px] font-semibold">
                      {(['active', 'planning', 'ended', 'paused'] as CourseStatus[]).map((st) => {
                        const meta = getCourseStatusMeta(st);
                        const isSelected = courseFormStatus === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setCourseFormStatus(st)}
                            className={`py-1.5 px-1 rounded-lg text-center transition-all border ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. 課程時間 (時段) */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
                        <Clock size={12} className="text-indigo-600" />
                        <span>課程時間 (時段)</span>
                      </label>
                      <div className="flex gap-1 text-[10px]">
                        {['12:50 - 13:30', '14:00 - 15:30', '16:00 - 17:00'].map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              setCourseFormTimeSlot(slot);
                              const p = slot.split('-');
                              if (p[0]) setCourseFormStartTime(p[0].trim());
                              if (p[1]) setCourseFormEndTime(p[1].trim());
                            }}
                            className="bg-white hover:bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200"
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={courseFormStartTime}
                        onChange={(e) => {
                          setCourseFormStartTime(e.target.value);
                          setCourseFormTimeSlot(`${e.target.value} - ${courseFormEndTime}`);
                        }}
                        className={`flex-1 p-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-indigo-600 ${
                          courseFormStartTime ? 'text-black font-semibold' : 'text-gray-500'
                        }`}
                      />
                      <span className="text-gray-400 text-xs">至</span>
                      <input
                        type="time"
                        value={courseFormEndTime}
                        onChange={(e) => {
                          setCourseFormEndTime(e.target.value);
                          setCourseFormTimeSlot(`${courseFormStartTime} - ${e.target.value}`);
                        }}
                        className={`flex-1 p-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-indigo-600 ${
                          courseFormEndTime ? 'text-black font-semibold' : 'text-gray-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* 4. 課程節數與排程 */}
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-indigo-950 flex items-center gap-1">
                        <Calendar size={13} className="text-indigo-600" />
                        <span>課程每節日期與節數排程</span>
                      </label>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-500 font-medium text-[11px]">總節數:</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="0"
                          value={courseFormTotalSessions > 0 ? courseFormTotalSessions : ''}
                          onChange={(e) => setCourseFormTotalSessions(parseInt(e.target.value) || 0)}
                          className={`w-14 p-1 bg-white border border-indigo-200 rounded text-center text-xs outline-none placeholder:text-gray-400 ${
                            courseFormTotalSessions > 0 ? 'text-black font-semibold' : 'text-gray-500'
                          }`}
                        />
                        <span className="text-gray-500 text-[11px]">節</span>
                      </div>
                    </div>

                    {/* 自動排程規則：日期區間 + 逢一週中星期幾 */}
                    <div className="p-2 bg-gray-50/80 rounded-lg border border-gray-200 space-y-2">
                      <div className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                        <Sparkles size={12} className="text-amber-500" />
                        <span>自動排程 (日期區間內逢週幾)：</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <div>
                          <span className="text-[9px] text-gray-400 block mb-0.5">開始日期</span>
                          <input
                            type="date"
                            value={schedStartDate}
                            onChange={(e) => setSchedStartDate(e.target.value)}
                            className={`w-full p-1 bg-white border border-gray-200 rounded text-[11px] outline-none ${
                              schedStartDate ? 'text-black font-semibold' : 'text-gray-500'
                            }`}
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-400 block mb-0.5">結束日期</span>
                          <input
                            type="date"
                            value={schedEndDate}
                            onChange={(e) => setSchedEndDate(e.target.value)}
                            className={`w-full p-1 bg-white border border-gray-200 rounded text-[11px] outline-none ${
                              schedEndDate ? 'text-black font-semibold' : 'text-gray-500'
                            }`}
                          />
                        </div>
                      </div>

                      {/* 逢週幾勾選 */}
                      <div>
                        <span className="text-[9px] text-gray-400 block mb-1">逢星期幾上課 (可複選)：</span>
                        <div className="flex items-center justify-between gap-1">
                          {WEEKDAYS_MAP.map((w) => {
                            const isSelected = schedWeekdays.includes(w.day);
                            return (
                              <button
                                key={w.day}
                                type="button"
                                onClick={() => toggleWeekday(w.day)}
                                className={`flex-1 py-1 rounded text-xs font-bold transition-colors ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                {w.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleRunAutoSchedule}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-2xs"
                      >
                        <Sparkles size={13} />
                        <span>依週次自動生成每節日期</span>
                      </button>
                    </div>

                    {/* 自由點選單日加入 */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <input
                        type="date"
                        value={singleDateToAdd}
                        onChange={(e) => setSingleDateToAdd(e.target.value)}
                        className={`flex-1 p-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none ${
                          singleDateToAdd ? 'text-black font-semibold' : 'text-gray-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={handleAddSingleDate}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-0.5"
                      >
                        <Plus size={13} />
                        <span>自由加入單日</span>
                      </button>
                    </div>

                    {/* 已排定的每節課堂日期列表 (可剔除某些日子) */}
                    <div>
                      <div className="flex justify-between items-center mb-1 text-[11px]">
                        <span className="font-bold text-gray-700">
                          已排定之每節日期 (共 {courseFormSessionDates.length} 節)：
                        </span>
                        {courseFormSessionDates.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('確定要清除已排定的所有日期嗎？')) {
                                setCourseFormSessionDates([]);
                                setCourseFormTotalSessions(0);
                              }
                            }}
                            className="text-[10px] text-red-500 hover:underline"
                          >
                            清空日期
                          </button>
                        )}
                      </div>

                      {courseFormSessionDates.length === 0 ? (
                        <p className="text-center text-[10px] text-gray-400 py-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                          尚未設定每節課堂日期，請點選上方「依週次自動生成」或「自由加入單日」
                        </p>
                      ) : (
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                          {courseFormSessionDates.map((dateStr, idx) => (
                            <div
                              key={dateStr}
                              className="flex items-center justify-between p-1.5 px-2 bg-indigo-50/50 hover:bg-indigo-50 rounded-lg border border-indigo-100 text-[11px]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-indigo-700 shrink-0 w-12">
                                  第 {idx + 1} 節
                                </span>
                                <span className="font-semibold text-gray-800 truncate">
                                  {dateStr} ({formatWeekdayCN(dateStr)})
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDate(dateStr)}
                                className="text-red-400 hover:text-red-600 font-bold text-xs p-0.5 transition-colors"
                                title="剔除此日課堂"
                              >
                                × 剔除
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 已剔除特定日子清單 (可復原) */}
                    {schedExcludedDates.length > 0 && (
                      <div className="p-2 bg-red-50/50 border border-red-100 rounded-lg text-[10px] space-y-1">
                        <span className="font-bold text-red-700 block">已剔除/停課日子 (可點擊復原)：</span>
                        <div className="flex flex-wrap gap-1">
                          {schedExcludedDates.map((exDate) => (
                            <span
                              key={exDate}
                              className="bg-white text-red-600 border border-red-200 px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold"
                            >
                              <span>{exDate}</span>
                              <button
                                type="button"
                                onClick={() => handleRestoreExcludedDate(exDate)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold ml-0.5"
                                title="恢復此日"
                              >
                                復原
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 表單提交與取消按鈕 */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCloseCourseForm}
                      className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-xs transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="flex-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Check size={14} />
                      <span>{editingCourseTargetId ? '儲存課程變更' : '確認新增課程'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* 頂部操作按鈕：開啟完整課程設定表單 (唯讀模式下隱藏) */
                !isReadOnly ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleOpenAddCourse}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Plus size={15} />
                      <span>新增課程 (設定時段、節數、每節日期與狀態)</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-xs text-amber-950 flex items-center justify-between">
                    <span className="flex items-center gap-1 font-bold">
                      <GraduationCap size={15} className="text-amber-600" />
                      <span>我的專屬課程 ({currentUser?.branch || '總校'} · {currentUser?.className || '全體班別'})</span>
                    </span>
                    <span className="text-[10px] text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full font-bold">
                      唯讀模式 · 點擊進入單元與家課
                    </span>
                  </div>
                )
              )}

              {/* ⭐ 需求：當新增及修改課程時，已設定課程不要顯示，完成或取消後重新出現 */}
              {!isCourseFormOpen && (
                <>
                  {/* ⭐ 需求 5：設定課程版面 Filter 工具列 */}
              {/* ⭐ 需求 4：學生帳戶中課程設定與排程管理移除學校或課程選項 */}
              {!isReadOnly && !isCourseFormOpen && normalizedCourses.length > 0 && (
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* 學校/分校篩選 */}
                    <select
                      value={courseFilterBranch}
                      onChange={(e) => setCourseFilterBranch(e.target.value)}
                      className="w-full bg-white text-purple-800 font-semibold text-[11px] p-1.5 rounded-lg border border-gray-200 outline-none truncate"
                    >
                      <option value="全部分校">全部學校 ({branches.length})</option>
                      {branches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>

                    {/* 狀態篩選 */}
                    <select
                      value={courseFilterStatus}
                      onChange={(e) => setCourseFilterStatus(e.target.value)}
                      className="w-full bg-white text-indigo-800 font-semibold text-[11px] p-1.5 rounded-lg border border-gray-200 outline-none truncate"
                    >
                      <option value="all">全部狀態</option>
                      <option value="active">🟢 進行中</option>
                      <option value="planning">🟡 籌劃中</option>
                      <option value="ended">⚪ 已完結</option>
                      <option value="paused">🔴 已暫停</option>
                    </select>
                  </div>

                  {/* 關鍵字即時搜尋 */}
                  <div>
                    <input
                      type="text"
                      placeholder="搜尋課程名稱或時段..."
                      value={courseSearchKeyword}
                      onChange={(e) => setCourseSearchKeyword(e.target.value)}
                      className={`w-full p-1.5 bg-white border border-gray-200 rounded-lg text-[11px] outline-none placeholder:text-gray-400 ${
                        courseSearchKeyword.trim() ? 'text-black font-semibold' : 'text-gray-500'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* 課程列表展示 */}
              <div className="space-y-2 pt-1">
                {normalizedCourses.length > 0 && !isCourseFormOpen && (
                  <div className="flex justify-between items-center px-1 pb-1">
                    <span className="text-[11px] text-gray-400">已設定 {normalizedCourses.length} 個課程{filteredNormalizedCourses.length !== normalizedCourses.length ? ` (篩選顯示 ${filteredNormalizedCourses.length} 個)` : ''}</span>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={handleClearAllCourses}
                        className="text-[11px] text-red-500 hover:text-red-700 hover:underline font-semibold"
                      >
                        清空全部課程
                      </button>
                    )}
                  </div>
                )}

                {normalizedCourses.length === 0 && !isCourseFormOpen && (
                  <div className="text-center py-8 text-gray-400 text-xs space-y-1 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <GraduationCap size={28} className="mx-auto text-gray-300" />
                    <p className="font-semibold text-gray-600">尚未設定任何課程</p>
                    <p className="text-[10px] text-gray-400">請點擊上方按鈕，為課程規劃名稱、上課時段與堂數日期</p>
                  </div>
                )}

                {filteredNormalizedCourses.map((c, idx) => {
                  const statusMeta = getCourseStatusMeta(c.status);
                  const isExpanded = expandedCourseIds.includes(c.id);
                  const sessionsCount = c.totalSessions || (c.sessionDates?.length || 0);

                  return (
                    <div
                      key={c.id || `${c.name}_${idx}`}
                      className="bg-white border border-gray-200 rounded-xl p-3 space-y-2 shadow-2xs hover:border-indigo-300 transition-all text-xs"
                    >
                      {/* 標題與操作列 (⭐ 點擊課程標題或卡片打開單元與家課) */}
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="min-w-0 flex-1 cursor-pointer group/title"
                          onClick={() => {
                            const displayName = getCourseDisplayName(c);
                            onOpenCourseContent?.(displayName, c.branch || '全部分校', true);
                          }}
                          title="點擊打開此課程的單元教材與家課"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusMeta.badgeClass}`}>
                              {statusMeta.label}
                            </span>
                            {/* ⭐ 所屬學校標籤 */}
                            {c.branch ? (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <MapPin size={10} className="text-purple-600" />
                                <span>{c.branch}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">
                                全部分校
                              </span>
                            )}
                            {c.timeSlot && (
                              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Clock size={10} />
                                <span>{c.timeSlot}</span>
                              </span>
                            )}
                            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded">
                              共 {sessionsCount} 節
                            </span>
                            {/* ⭐ 需求 7：於課程中顯示已參加學生人數 */}
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                              <Users size={10} className="text-blue-600" />
                              <span>已參加: {getEnrolledStudentCount(c)} 人</span>
                            </span>
                          </div>
                          {/* ⭐ 課程名稱 + (課程時間)，懸浮呈現品牌亮色 */}
                          <h4 className="font-bold text-gray-900 group-hover/title:text-indigo-600 text-sm leading-snug truncate transition-colors flex items-center gap-1.5">
                            <span>{c.name}</span>
                            {c.timeSlot && !c.name.includes(c.timeSlot.trim()) && (
                              <span className="text-indigo-600 font-semibold ml-1.5">
                                ({c.timeSlot.trim()})
                              </span>
                            )}
                          </h4>
                        </div>
                        {!isReadOnly && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleOpenEditCourse(c); }}
                              className="text-gray-400 hover:text-indigo-600 p-1 rounded transition-colors"
                              title="修改課程設定"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteCourse(c.id, c.name); }}
                              className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
                              title="刪除課程"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ⭐ 需求：點擊課程打開課程單元及單元家課快捷操作按鈕 */}
                      <button
                        type="button"
                        onClick={() => {
                          const displayName = getCourseDisplayName(c);
                          onOpenCourseContent?.(displayName, c.branch || '全部分校', true);
                        }}
                        className="w-full py-1.5 px-2.5 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg font-bold text-[11px] flex items-center justify-between transition-all group shadow-2xs"
                        title="查看並發布此課程之單元教材與單元家課"
                      >
                        <span className="flex items-center gap-1.5">
                          <BookOpen size={13} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                          <span>打開課程單元及單元家課</span>
                        </span>
                        <ChevronRight size={13} className="text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>

                      {/* 每節課堂日期縮影與展開 */}
                      <div className="pt-1 border-t border-gray-100">
                        {c.sessionDates && c.sessionDates.length > 0 ? (
                          <div>
                            <div
                              onClick={() => toggleExpandCourse(c.id)}
                              className="flex items-center justify-between cursor-pointer select-none text-[11px] text-gray-500 hover:text-indigo-600"
                            >
                              <span className="font-medium flex items-center gap-1">
                                <Calendar size={12} className="text-indigo-600" />
                                <span>每節日期 ({c.sessionDates.length} 節)：</span>
                                <span className="text-gray-400 truncate max-w-[180px]">
                                  {c.sessionDates.slice(0, 3).map((d) => d.slice(5)).join(', ')}
                                  {c.sessionDates.length > 3 ? '...' : ''}
                                </span>
                              </span>
                              <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-0.5">
                                <span>{isExpanded ? '收合' : '展開詳情'}</span>
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </span>
                            </div>

                            {/* 展開後的每節課堂清單 */}
                            {isExpanded && (
                              <div className="mt-2 bg-gray-50 p-2 rounded-lg border border-gray-200 max-h-36 overflow-y-auto space-y-1 text-[11px]">
                                {c.sessionDates.map((d, i) => (
                                  <div key={d} className="flex justify-between items-center text-gray-700 px-1 py-0.5">
                                    <span className="font-bold text-indigo-700">第 {i + 1} 節</span>
                                    <span>{d} ({formatWeekdayCN(d)})</span>
                                  </div>
                                ))}
                                {c.scheduleRule?.excludedDates && c.scheduleRule.excludedDates.length > 0 && (
                                  <div className="pt-1 border-t border-gray-200 text-[10px] text-red-500 font-medium">
                                    ※ 剔除日子：{c.scheduleRule.excludedDates.join(', ')}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-gray-400 flex items-center justify-between">
                            <span>尚未排定每節日期</span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditCourse(c)}
                              className="text-indigo-600 font-bold hover:underline"
                            >
                              + 排定日期
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: 學校 / 分校設定 (Branches，支援學校代號) */}
          {activeTab === 'branches' && (
            <div className="space-y-3">
              <form onSubmit={handleAddBranch} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="學校/分校名稱 (例：沙田分校)"
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value)}
                    className={`flex-1 p-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-purple-600 placeholder:text-gray-400 ${
                      newBranch.trim() ? 'text-black font-semibold' : 'text-gray-500'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="學校代號 (例：ST)"
                    value={newBranchCode}
                    onChange={(e) => setNewBranchCode(e.target.value.toUpperCase())}
                    className="w-32 p-2 border border-purple-200 bg-purple-50/50 rounded-lg text-xs outline-none focus:border-purple-600 text-purple-900 font-bold uppercase font-mono placeholder:text-gray-400"
                  />
                  <button
                    type="submit"
                    className="bg-purple-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-purple-700 transition-colors shrink-0 shadow-xs"
                  >
                    <Plus size={14} /> 新增
                  </button>
                </div>
              </form>

              <div className="space-y-1.5 pt-1">
                {localBranches.length > 0 && (
                  <div className="flex justify-between items-center px-1 pb-1">
                    <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                      <Sparkles size={11} className="text-purple-600" />
                      <span>已設定 {localBranches.length} 個學校/分校 (按住拖動可更改排序)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAllBranches}
                      className="text-[11px] text-red-500 hover:text-red-700 hover:underline font-semibold"
                    >
                      清空全部分校
                    </button>
                  </div>
                )}
                {localBranches.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-6">尚未設定任何學校或分校</p>
                )}
                {localBranches.map((b, idx) => {
                  const isEditing = editingItem?.type === 'branch' && editingItem?.id === b;
                  const isDragging = draggedBranchIndex === idx;
                  const isDragOver = dragOverBranchIndex === idx;

                  const info = parseBranchInfo(b);
                  return (
                    <div
                      key={b}
                      draggable={!isEditing}
                      onDragStart={(e) => handleBranchDragStart(e, idx)}
                      onDragOver={(e) => handleBranchDragOver(e, idx)}
                      onDrop={(e) => handleBranchDrop(e, idx)}
                      onDragEnd={handleBranchDragEnd}
                      className={`flex justify-between items-center p-2.5 bg-purple-50/40 border rounded-lg text-xs font-semibold transition-all ${
                        isDragging ? 'opacity-40 scale-[0.98]' : ''
                      } ${
                        isDragOver ? 'border-purple-600 bg-purple-100/80 shadow-xs' : 'border-purple-100 hover:border-purple-300'
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1 mr-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="學校名稱"
                            className="flex-1 p-1 bg-white border border-purple-500 rounded text-xs outline-none text-black font-semibold"
                            autoFocus
                          />
                          <input
                            type="text"
                            value={editBranchCode}
                            onChange={(e) => setEditBranchCode(e.target.value.toUpperCase())}
                            placeholder="代號 (例: ST)"
                            className="w-24 p-1 bg-white border border-purple-500 rounded text-xs outline-none text-purple-900 font-bold font-mono uppercase"
                          />
                          <button
                            onClick={() => handleSaveEditBranch(b)}
                            className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                            title="保存修改"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingItem(null)}
                            className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                            title="取消"
                          >
                            <RotateCcw size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-purple-900 min-w-0">
                            {/* 拖動手把 + 上下微調按鈕 */}
                            <div className="flex items-center gap-0.5 text-gray-400">
                              <span
                                className="cursor-grab active:cursor-grabbing p-1 hover:text-purple-600 hover:bg-purple-100/60 rounded transition-colors"
                                title="按著此處上下拖動更改排序"
                              >
                                <GripVertical size={14} />
                              </span>
                              <div className="flex flex-col text-[8px] leading-[9px]">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveBranch(idx, 'up')}
                                  className="text-gray-400 hover:text-purple-600 disabled:opacity-20 px-0.5"
                                  title="上移"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === localBranches.length - 1}
                                  onClick={() => handleMoveBranch(idx, 'down')}
                                  className="text-gray-400 hover:text-purple-600 disabled:opacity-20 px-0.5"
                                  title="下移"
                                >
                                  ▼
                                </button>
                              </div>
                            </div>

                            <span className="text-[10px] text-purple-500 bg-purple-100 px-1 py-0.2 rounded font-mono font-bold">
                              #{idx + 1}
                            </span>
                            <MapPin size={14} className="text-purple-600 shrink-0" />
                            <span className="truncate">{info.name}</span>
                            {info.code && (
                              <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-purple-100 text-purple-700 shrink-0 border border-purple-200">
                                代號: {info.code}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleStartEditBranch(b)}
                              className="text-gray-400 hover:text-purple-600 p-1 rounded"
                              title="修改名稱"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteBranch(b)}
                              className="text-gray-400 hover:text-red-500 p-1 rounded"
                              title="刪除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: 班別設定 (Classes) */}
          {activeTab === 'classes' && (
            <div className="space-y-3">
              <form onSubmit={handleAddClass} className="flex gap-2">
                <input
                  type="text"
                  placeholder="新班別名稱 (例：1A、高班、週末班)"
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  className={`flex-1 p-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-indigo-600 placeholder:text-gray-400 ${
                    newClass.trim() ? 'text-black font-semibold' : 'text-gray-500'
                  }`}
                />
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-700 transition-colors"
                >
                  <Plus size={14} /> 新增
                </button>
              </form>

              <div className="space-y-1.5 pt-1">
                {localClasses.length > 0 && (
                  <div className="flex justify-between items-center px-1 pb-1">
                    <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                      <Sparkles size={11} className="text-indigo-600" />
                      <span>已設定 {localClasses.length} 個班別 (按住拖動可更改排序)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAllClasses}
                      className="text-[11px] text-red-500 hover:text-red-700 hover:underline font-semibold"
                    >
                      清空全部班別
                    </button>
                  </div>
                )}
                {localClasses.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-6">尚未設定任何班別，請於上方新增</p>
                )}
                {localClasses.map((c, idx) => {
                  const isEditing = editingItem?.type === 'class' && editingItem?.id === c;
                  const isDragging = draggedClassIndex === idx;
                  const isDragOver = dragOverClassIndex === idx;

                  return (
                    <div
                      key={c}
                      draggable={!isEditing}
                      onDragStart={(e) => handleClassDragStart(e, idx)}
                      onDragOver={(e) => handleClassDragOver(e, idx)}
                      onDrop={(e) => handleClassDrop(e, idx)}
                      onDragEnd={handleClassDragEnd}
                      className={`flex justify-between items-center p-2.5 bg-gray-50 border rounded-lg text-xs font-semibold transition-all ${
                        isDragging ? 'opacity-40 scale-[0.98]' : ''
                      } ${
                        isDragOver ? 'border-indigo-600 bg-indigo-50/80 shadow-xs' : 'border-gray-150 hover:border-indigo-300'
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1 mr-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 p-1 bg-white border border-indigo-500 rounded text-xs outline-none text-black font-semibold"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEditClass(c)}
                            className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                            title="保存修改"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingItem(null)}
                            className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                            title="取消"
                          >
                            <RotateCcw size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-gray-900 min-w-0">
                            {/* 拖動手把 + 上下微調按鈕 */}
                            <div className="flex items-center gap-0.5 text-gray-400">
                              <span
                                className="cursor-grab active:cursor-grabbing p-1 hover:text-indigo-600 hover:bg-indigo-100/60 rounded transition-colors"
                                title="按著此處上下拖動更改排序"
                              >
                                <GripVertical size={14} />
                              </span>
                              <div className="flex flex-col text-[8px] leading-[9px]">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveClass(idx, 'up')}
                                  className="text-gray-400 hover:text-indigo-600 disabled:opacity-20 px-0.5"
                                  title="上移"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === localClasses.length - 1}
                                  onClick={() => handleMoveClass(idx, 'down')}
                                  className="text-gray-400 hover:text-indigo-600 disabled:opacity-20 px-0.5"
                                  title="下移"
                                >
                                  ▼
                                </button>
                              </div>
                            </div>

                            <span className="text-[10px] text-indigo-600 bg-indigo-100 px-1 py-0.2 rounded font-mono font-bold">
                              #{idx + 1}
                            </span>
                            <Layers size={14} className="text-gray-400" />
                            <span className="truncate">{c.endsWith('班') ? c : `${c} 班`}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleStartEditClass(c)}
                              className="text-gray-400 hover:text-indigo-600 p-1 rounded"
                              title="修改名稱"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteClass(c)}
                              className="text-gray-400 hover:text-red-500 p-1 rounded"
                              title="刪除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          
        </div>

        {/* ⭐ 需求：學校與班別設定中學校及班別可以按著拖動更改排序，按完成設定時確定儲存並更新資料庫 */}
        {!isCourseFormOpen && !isInline && (
          <div className="p-3 border-t border-gray-150 bg-gray-50 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCloseModal}
              className="py-2.5 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-xs transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSaveAndConfirmSettings}
              className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all"
            >
              <Check size={16} />
              <span>完成設定 (確定儲存並更新資料庫)</span>
            </button>
          </div>
        )}
      </div>
  );

  if (isInline) {
    return <div className="flex-1 w-full bg-[#F8F9FA] flex flex-col overflow-y-auto">{mainContent}</div>;
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      {mainContent}
    </div>
  );
};
