import React, { useState, useEffect } from 'react';
import {
  X, Users, UploadCloud, Plus, FileSpreadsheet, Trash2, Download,
  CheckCircle, GraduationCap, Check, UserPlus, Edit2, RotateCcw, User,
  MapPin
} from 'lucide-react';
import { CourseItem, getCourseDisplayName } from '../homework/HomeworkSetupModal';
import { databases, DATABASE_ID } from '@/lib/appwrite';
import { ID, Query } from 'appwrite';

interface ClassManagementModalProps {
  isOpen?: boolean;
  isInline?: boolean; // ⭐ 支援滿板顯示 (非浮動彈窗)
  onClose?: () => void;
  branches: string[];
  classes: string[];
  courses: string[];
  courseItems?: (string | CourseItem)[];
  onDataChanged?: () => void;
  onOpenCourseContent?: (courseName: string, branch?: string, isLocked?: boolean) => void;
}

export interface StudentRecord {
  $id?: string;
  branch: string;
  class_name: string;
  course_name: string;
  student_name: string;
}

interface GroupedStudent {
  key: string;
  student_name: string;
  class_name: string;
  branch: string;
  enrollments: { id: string; course_name: string }[];
}

export const ClassManagementModal: React.FC<ClassManagementModalProps> = ({
  isOpen = true,
  isInline = false,
  onClose,
  branches,
  classes,
  courses,
  courseItems = [],
  onDataChanged,
  onOpenCourseContent,
}) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'excel' | 'list'>('manual');

  // 新增會員表單狀態
  const [manualBranch, setManualBranch] = useState(''); // ⭐ 不預選分校
  const [manualClass, setManualClass] = useState(''); // ⭐ 不預選班別
  const [studentName, setStudentName] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]); // 預設為空，不預選任何課程
  const [customCourseInput, setCustomCourseInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Excel 批次匯入狀態
  const [parsedRows, setParsedRows] = useState<{ branch: string; class_name: string; course_name: string; student_name: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  // 現有會員狀態
  const [existingStudents, setExistingStudents] = useState<StudentRecord[]>([]);
  const [filterClass, setFilterClass] = useState('全部班別');
  const [filterCourse, setFilterCourse] = useState('全部課程');
  const [loadingList, setLoadingList] = useState(false);

  // 快速加選課程狀態
  const [addingCourseForStudent, setAddingCourseForStudent] = useState<GroupedStudent | null>(null);
  const [selectedCourseToAdd, setSelectedCourseToAdd] = useState('');

  // 現有會員編輯狀態
  const [editingStudent, setEditingStudent] = useState<GroupedStudent | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentClass, setEditStudentClass] = useState('');
  const [editStudentBranch, setEditStudentBranch] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // ⭐ 需求 2：參加課程要因應所選之分校才顯示相對課程
  // ⭐ 需求 2：所有板面離開後或按完成或按取消應該清空或還原預設值
  const handleResetAllStates = () => {
    setManualBranch('');
    setManualClass('');
    setStudentName('');
    setSelectedCourses([]);
    setCustomCourseInput('');
    setSubmitting(false);

    setEditingStudent(null);
    setEditStudentName('');
    setEditStudentClass('');
    setEditStudentBranch('');
    setSavingEdit(false);

    setAddingCourseForStudent(null);
    setSelectedCourseToAdd('');

    setFilterClass('全部班別');
    setFilterCourse('全部課程');

    setParsedRows([]);
    setUploading(false);

    setActiveTab('manual');
  };

  const handleCloseModal = () => {
    handleResetAllStates();
    onClose();
  };

  // 當彈窗關閉時自動重置還原預設值 (僅在由開變關時觸發，避免初次加載執行)
  const prevOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (prevOpenRef.current && !isOpen) {
      handleResetAllStates();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  // ⭐ 需求 1：在現有會員，加選課程只顯示該學校課程，不要顯示所有學校課程
  const getAvailableCoursesForStudent = (student: GroupedStudent): string[] => {
    const sBranch = (student.branch || '').trim();
    if (courseItems && courseItems.length > 0) {
      const matched = courseItems.filter((c) => {
        if (typeof c === 'string') {
          return !sBranch;
        }
        const cBranch = (c.branch || '').trim();
        if (!sBranch) return true;
        return !cBranch || cBranch === '全部分校' || cBranch === sBranch;
      });
      const formatted = Array.from(new Set(matched.map((c) => getCourseDisplayName(c)))).filter(Boolean);
      return formatted;
    }
    return courses;
  };

    const availableCoursesForSelectedBranch = React.useMemo(() => {
    if (!manualBranch) return [];
    if (courseItems && courseItems.length > 0) {
      const matched = courseItems.filter((c) => {
        if (typeof c === 'string') return true;
        return !c.branch || c.branch === '全部分校' || c.branch === manualBranch;
      });
      return Array.from(new Set(matched.map((c) => getCourseDisplayName(c)))).filter(Boolean);
    }
    return courses;
  }, [manualBranch, courseItems, courses]);

  const fetchStudents = async () => {
    setLoadingList(true);
    try {
      const res = await databases.listDocuments(DATABASE_ID, 'students', [Query.limit(500)]);
      setExistingStudents(res.documents as unknown as StudentRecord[]);
    } catch (err: any) {
      console.log('讀取學生清單中:', err.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStudents();
      // ⭐ 需求 1：每次打開新增會員皆為乾淨空白，不預選分校與班別
      setManualBranch('');
      setManualClass('');
      setStudentName('');
      setSelectedCourses([]);
      setCustomCourseInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleCourse = (courseName: string) => {
    setSelectedCourses((prev) =>
      prev.includes(courseName) ? prev.filter((c) => c !== courseName) : [...prev, courseName]
    );
  };

  // 1. 新增會員（手動單筆，不預選課程，新增後清空選擇）
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBranch) {
      alert('請先選擇學校/分校！');
      return;
    }
    if (!studentName.trim()) {
      alert('請填寫學生姓名！');
      return;
    }
    if (!manualClass) {
      alert('請選擇班別！');
      return;
    }

    const finalCourses = [...selectedCourses];
    if (customCourseInput.trim() && !finalCourses.includes(customCourseInput.trim())) {
      finalCourses.push(customCourseInput.trim());
    }

    setSubmitting(true);
    try {
      if (finalCourses.length === 0) {
        // ⭐ 需求：新增會員可以不選任何參加課程
        await databases.createDocument(DATABASE_ID, 'students', ID.unique(), {
          branch: manualBranch,
          class_name: manualClass.trim(),
          course_name: '', // 無選取課程
          student_name: studentName.trim(),
        });
      } else {
        for (const course of finalCourses) {
          await databases.createDocument(DATABASE_ID, 'students', ID.unique(), {
            branch: manualBranch,
            class_name: manualClass.trim(),
            course_name: course,
            student_name: studentName.trim(),
          });
        }
      }

      alert(`✅ 會員「${studentName.trim()}」已成功新增！`);
      
      // 新增後清空選擇與輸入
      setStudentName('');
      setSelectedCourses([]);
      setCustomCourseInput('');
      
      fetchStudents();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      alert('新增失敗：' + (err.message || '請確認已建立 students 表'));
    } finally {
      setSubmitting(false);
    }
  };

  // 2. 處理 Excel/CSV 檔案選取與解析
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = (evt.target?.result as string) || '';
        const lines = text
          .split('\\n')
          .map((line) => line.replace('\\r', '').trim())
          .filter((line) => line.length > 0);

        const rows: { branch: string; class_name: string; course_name: string; student_name: string }[] = [];
        const startIndex = lines[0].includes('姓名') || lines[0].includes('name') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
          const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));

          if (parts.length >= 2) {
            let branch = branches[0] || '總校';
            let className = '';
            let rawCourses = '';
            let sName = '';

            if (parts.length >= 4) {
              branch = parts[0] || branch;
              className = parts[1];
              rawCourses = parts[2];
              sName = parts[3];
            } else if (parts.length === 3) {
              className = parts[0];
              rawCourses = parts[1];
              sName = parts[2];
            } else {
              className = parts[0];
              sName = parts[1];
              rawCourses = '常規課程';
            }

            const splitCourses = rawCourses
              .split(';')
              .join(',')
              .split('/')
              .join(',')
              .split('、')
              .join(',')
              .split('|')
              .join(',')
              .split(',')
              .map((c) => c.trim())
              .filter((c) => c.length > 0);

            const courseList = splitCourses.length > 0 ? splitCourses : ['常規課程'];

            for (const c of courseList) {
              rows.push({
                branch,
                class_name: className,
                course_name: c,
                student_name: sName,
              });
            }
          }
        }

        if (rows.length === 0) {
          alert('未能識別檔案中的數據，請參考標準範本：分校,班別,課程,學生姓名');
          return;
        }

        setParsedRows(rows);
      } catch (err: any) {
        alert('解析檔案失敗：' + err.message);
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleBatchSubmit = async () => {
    if (parsedRows.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const row of parsedRows) {
      try {
        await databases.createDocument(DATABASE_ID, 'students', ID.unique(), row);
        successCount++;
      } catch (err) {
        console.error('匯入單筆失敗:', row, err);
      }
    }

    setUploading(false);
    alert(`🎉 批次匯入完成！成功寫入 ${successCount} / ${parsedRows.length} 筆學生課程資料。`);
    setParsedRows([]);
    fetchStudents();
    if (onDataChanged) onDataChanged();
  };

  // 下載純空白 Excel/CSV 範本（無任何 default 會員資料）
  const handleDownloadTemplate = () => {
    const csvContent = "分校,班別,課程,學生姓名\\n";
    const blob = new Blob(["\\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '學生名冊空白範本.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 匯出完整會員名單為 CSV (支援 Excel UTF-8 中文)
  const handleExportFullList = () => {
    if (groupedStudents.length === 0) {
      alert('目前尚無會員資料可供匯出！');
      return;
    }

    const headers = ['分校', '班別', '會員姓名', '修讀課程', '課程數量'];
    const rows = groupedStudents.map((s) => [
      `"${(s.branch || '').replace(/"/g, '""')}"`,
      `"${(s.class_name || '').replace(/"/g, '""')}"`,
      `"${(s.student_name || '').replace(/"/g, '""')}"`,
      `"${s.enrollments.map((e) => e.course_name).join('; ').replace(/"/g, '""')}"`,
      s.enrollments.length,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Online_Classroom_現有會員完整名單_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 啟動編輯現有學生
  const handleStartEditStudent = (student: GroupedStudent) => {
    setEditingStudent(student);
    setEditStudentName(student.student_name);
    setEditStudentClass(student.class_name);
    setEditStudentBranch(student.branch);
  };

  // 儲存修改學生資料（同步更新該學生旗下所有註冊紀錄）
  const handleSaveEditStudent = async (student: GroupedStudent) => {
    if (!editStudentName.trim()) {
      alert('學生姓名不能為空！');
      return;
    }
    setSavingEdit(true);
    try {
      for (const en of student.enrollments) {
        await databases.updateDocument(DATABASE_ID, 'students', en.id, {
          student_name: editStudentName.trim(),
          class_name: editStudentClass.trim(),
          branch: editStudentBranch.trim(),
        });
      }
      alert('✅ 學生資料已成功更新！');
      setEditingStudent(null);
      fetchStudents();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      alert('更新失敗：' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // ⭐ 退出單一課程 (當退出所有課程時，保留會員檔案不刪除會員)
  const handleDeleteEnrollment = async (
    id: string,
    sName: string,
    cName: string,
    activeCoursesCount: number
  ) => {
    if (!window.confirm(`確定要為「${sName}」退出課程「${cName}」嗎？`)) return;
    try {
      // 若該會員只剩下這 1 個修讀課程，退出時只將課程清空為 ''，保留會員基本資料
      if (activeCoursesCount <= 1) {
        await databases.updateDocument(DATABASE_ID, 'students', id, {
          course_name: '',
        });
        setExistingStudents((prev) =>
          prev.map((s) => (s.$id === id ? { ...s, course_name: '' } : s))
        );
      } else {
        // 若該會員尚有其他課程，則刪除此單門課程註冊紀錄
        await databases.deleteDocument(DATABASE_ID, 'students', id);
        setExistingStudents((prev) => prev.filter((s) => s.$id !== id));
      }
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      alert('退出失敗：' + err.message);
    }
  };

  // 徹底刪除學生
  const handleDeleteStudentAll = async (student: GroupedStudent) => {
    if (!window.confirm(`確定要徹底刪除學生「${student.student_name}」的所有紀錄嗎？`)) return;
    try {
      for (const en of student.enrollments) {
        await databases.deleteDocument(DATABASE_ID, 'students', en.id);
      }
      setExistingStudents((prev) =>
        prev.filter((s) => !student.enrollments.some((en) => en.id === s.$id))
      );
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      alert('刪除失敗：' + err.message);
    }
  };

  // 為學生加選課程
  const handleAddCourseForExistingStudent = async (student: GroupedStudent) => {
    const courseToAdd = selectedCourseToAdd.trim();
    if (!courseToAdd) {
      alert('請選擇或填寫要加選的課程！');
      return;
    }
    if (student.enrollments.some((e) => e.course_name === courseToAdd)) {
      alert(`「${student.student_name}」已參加過「${courseToAdd}」！`);
      return;
    }

    try {
      const emptyEn = student.enrollments.find((e) => !e.course_name || !e.course_name.trim());
      if (emptyEn && student.enrollments.length === 1) {
        await databases.updateDocument(DATABASE_ID, 'students', emptyEn.id, {
          course_name: courseToAdd,
        });
      } else {
        await databases.createDocument(DATABASE_ID, 'students', ID.unique(), {
          branch: student.branch,
          class_name: student.class_name,
          course_name: courseToAdd,
          student_name: student.student_name,
        });
      }

      alert(`✅ 已為「${student.student_name}」成功加選「${courseToAdd}」！`);
      setAddingCourseForStudent(null);
      setSelectedCourseToAdd('');
      fetchStudents();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      alert('加選失敗：' + err.message);
    }
  };

  // 聚合分組
  const groupedStudentsMap = new Map<string, GroupedStudent>();
  existingStudents.forEach((doc) => {
    const key = `${doc.branch}___${doc.class_name}___${doc.student_name}`;
    if (!groupedStudentsMap.has(key)) {
      groupedStudentsMap.set(key, {
        key,
        student_name: doc.student_name,
        class_name: doc.class_name,
        branch: doc.branch,
        enrollments: [],
      });
    }
    if (doc.$id) {
      groupedStudentsMap.get(key)!.enrollments.push({
        id: doc.$id,
        course_name: doc.course_name || '',
      });
    }
  });

  const groupedStudents = Array.from(groupedStudentsMap.values());

  const filteredGrouped = groupedStudents.filter((s) => {
    const matchClass = filterClass === '全部班別' || s.class_name === filterClass;
    const matchCourse =
      filterCourse === '全部課程' ||
      s.enrollments.some((e) => e.course_name === filterCourse);
    return matchClass && matchCourse;
  });

  const availableClassesInList = Array.from(new Set(existingStudents.map((s) => s.class_name).filter(Boolean)));
  const availableCoursesInList = Array.from(new Set(existingStudents.map((s) => s.course_name).filter(Boolean)));
  const allKnownCourses = Array.from(new Set([...courses, ...availableCoursesInList]));

  if (!isOpen) return null;

  return (
    <div className={isInline ? "w-full flex-1 flex flex-col bg-white overflow-hidden" : "fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"}>
      <div className={isInline ? "w-full flex-1 flex flex-col overflow-hidden bg-white" : "bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"}>
        {/* 頂部標題 */}
        <div className="bg-[#4A5568] text-white px-5 py-3.5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Users size={18} />
            <h4 className="font-bold text-base">會員目錄 (班級課程與學生管理)</h4>
          </div>
          {onClose && !isInline && (
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>

        {/* 標籤頁切換：單筆新增 (多課程) 改名為「新增會員」 */}
        <div className="flex border-b border-gray-100 bg-gray-50 text-xs font-bold">
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'manual' ? 'border-[#FF6B57] text-[#FF6B57] bg-white' : 'border-transparent text-gray-500'
            }`}
          >
            <Plus size={15} />
            新增會員
          </button>
          <button
            onClick={() => setActiveTab('excel')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'excel' ? 'border-[#FF6B57] text-[#FF6B57] bg-white' : 'border-transparent text-gray-500'
            }`}
          >
            <FileSpreadsheet size={15} />
            Excel 批次匯入
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'list' ? 'border-[#FF6B57] text-[#FF6B57] bg-white' : 'border-transparent text-gray-500'
            }`}
          >
            現有會員 ({groupedStudents.length})
          </button>
        </div>

        {/* 內容區塊 */}
        <div className="p-5 overflow-y-auto flex-1 text-sm">
          {/* TAB 1: 新增會員 (分校 -> 學生姓名與班別下拉選單平排 -> 參加課程不預選) */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualAdd} className="space-y-3.5">
              {/* 1. 分校 (Branch) - ⭐ 需求 1: 不預選; 需求 3: 填選後100%黑色字, 未選60%灰 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  分校 (Branch) <span className="text-red-500">*</span>
                </label>
                {branches.length > 0 ? (
                  <select
                    value={manualBranch}
                    onChange={(e) => {
                      setManualBranch(e.target.value);
                      setSelectedCourses([]); // 切換分校時重置課程選取
                    }}
                    className={`w-full p-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] transition-colors ${
                      manualBranch ? 'text-black font-semibold bg-white' : 'text-gray-500 bg-gray-50'
                    }`}
                    required
                  >
                    <option value="" disabled className="text-gray-400">請選擇學校/分校...</option>
                    {branches.map((b) => (
                      <option key={b} value={b} className="text-black font-medium">{b}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="請輸入分校名稱 (例: 總校、沙田分校)"
                    value={manualBranch}
                    onChange={(e) => setManualBranch(e.target.value)}
                    className={`w-full p-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] placeholder:text-gray-400 ${
                      manualBranch ? 'text-black font-semibold bg-white' : 'text-gray-500 bg-gray-50'
                    }`}
                    required
                  />
                )}
              </div>

              {/* 2. 學生姓名 與 班別 (平排並列) - ⭐ 填選後100%黑色字, 未選60%灰 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    學生姓名 (Student Name) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="請輸入學生姓名"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className={`w-full p-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] placeholder:text-gray-400 ${
                      studentName ? 'text-black font-semibold bg-white' : 'text-gray-500 bg-gray-50'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    班別 (Class) <span className="text-red-500">*</span>
                  </label>
                  {classes.length > 0 ? (
                    <select
                      value={manualClass}
                      onChange={(e) => setManualClass(e.target.value)}
                      className={`w-full p-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] transition-colors ${
                        manualClass ? 'text-black font-semibold bg-white' : 'text-gray-500 bg-gray-50'
                      }`}
                      required
                    >
                      <option value="" disabled className="text-gray-400">請選擇班別...</option>
                      {classes.map((c) => (
                        <option key={c} value={c} className="text-black font-medium">{c.endsWith('班') ? c : `${c} 班`}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="請輸入班別 (例: 1A)"
                      value={manualClass}
                      onChange={(e) => setManualClass(e.target.value)}
                      className={`w-full p-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57] placeholder:text-gray-400 ${
                        manualClass ? 'text-black font-semibold bg-white' : 'text-gray-500 bg-gray-50'
                      }`}
                      required
                    />
                  )}
                </div>
              </div>

              {/* 3. 參加課程 (Courses) - ⭐ 需求 2: 因應所選之分校才顯示相對課程 */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-600">
                    參加課程 (Courses) <span className="text-gray-400 font-normal">（選填，可不選任何課程）</span>
                  </label>
                  <span className="text-[11px] text-indigo-600 font-semibold">
                    已選 {selectedCourses.length + (customCourseInput.trim() ? 1 : 0)} 個課程
                  </span>
                </div>
                <div className="border border-gray-200 rounded-xl p-2.5 bg-gray-50/70 space-y-2">
                  {!manualBranch ? (
                    <p className="text-xs text-amber-600 font-medium py-2.5 text-center bg-amber-50/60 rounded-lg border border-amber-200/60">
                      ※ 請先於上方選取「分校」，系統將自動過濾並顯示該校所屬之課程
                    </p>
                  ) : availableCoursesForSelectedBranch.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2.5 text-center">
                      「{manualBranch}」目前尚未設定專屬課程，可於下方自訂輸入或稍後至「設定」新增
                    </p>
                  ) : (
                    <>
                      <div className="text-[11px] text-gray-400">點擊標籤複選「{manualBranch}」的課程：</div>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {availableCoursesForSelectedBranch.map((c) => {
                          const isSelected = selectedCourses.includes(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => toggleCourse(c)}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
                                isSelected
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
                              }`}
                            >
                              {isSelected && <Check size={12} />}
                              <GraduationCap size={12} />
                              <span>{c}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {/* 自訂課程 - ⭐ 填寫後100%黑色字, 未填提示60%灰 */}
                  <div className="pt-1.5 border-t border-gray-200/80">
                    <input
                      type="text"
                      placeholder="+ 自訂或填寫新課程 (選填)"
                      value={customCourseInput}
                      onChange={(e) => setCustomCourseInput(e.target.value)}
                      className={`w-full p-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-indigo-500 placeholder:text-gray-400 ${
                        customCourseInput ? 'text-black font-semibold bg-white' : 'text-gray-500 bg-white'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#FF6B57] text-white font-bold rounded-xl text-xs hover:bg-[#e05a48] shadow-sm flex items-center justify-center gap-1.5"
              >
                <Plus size={16} />
                <span>{submitting ? '新增會員中...' : '確認新增會員至雲端'}</span>
              </button>
            </form>
          )}

          {/* TAB 2: EXCEL / CSV 批次匯入 */}
          {activeTab === 'excel' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-700">批次建立學生與課程名冊</span>
                <button
                  onClick={handleDownloadTemplate}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
                >
                  <Download size={13} /> 下載 Excel/CSV 空白範本
                </button>
              </div>

              <label className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:border-[#FF6B57] bg-gray-50/50 cursor-pointer transition-colors">
                <div className="p-3 bg-red-50 text-[#FF6B57] rounded-full">
                  <UploadCloud size={24} />
                </div>
                <div className="text-xs font-bold text-gray-700 text-center">
                  點擊選擇或拖曳 Excel (.xlsx) / CSV 檔案至此
                </div>
                <div className="text-[11px] text-gray-400 text-center">
                  格式：分校, 班別, 課程, 學生姓名<br />
                  （多個課程可使用「/」或「;」分隔）
                </div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {parsedRows.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle size={14} /> 待匯入名單（共 {parsedRows.length} 筆註冊）：
                    </span>
                    <button
                      onClick={() => setParsedRows([])}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      清空
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50 divide-y divide-gray-100 text-xs">
                    {parsedRows.map((r, idx) => (
                      <div key={idx} className="p-2 flex justify-between items-center">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-purple-600 font-medium">{r.branch}</span>
                          <span className="text-gray-700 font-semibold">{r.class_name} 班</span>
                          <span className="text-indigo-600 font-medium">{r.course_name}</span>
                        </div>
                        <span className="font-bold text-gray-800">{r.student_name}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleBatchSubmit}
                    disabled={uploading}
                    className="w-full py-2.5 bg-[#FF6B57] text-white font-bold rounded-xl text-xs hover:bg-[#e05a48] shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <UploadCloud size={16} />
                    <span>{uploading ? '正在寫入資料庫...' : '確認批次上傳至 Appwrite'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: 現有會員 (支援完整【編輯】學生姓名、班別、分校功能與名單匯出) */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-1.5 rounded-lg border-none outline-none"
                >
                  <option value="全部班別">全部班別</option>
                  {Array.from(new Set([...classes, ...availableClassesInList])).map((c) => (
                    <option key={c} value={c}>{c} 班</option>
                  ))}
                </select>

                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-1.5 rounded-lg border-none outline-none"
                >
                  <option value="全部課程">全部課程</option>
                  {allKnownCourses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between items-center text-xs px-1">
                <span className="text-gray-500 font-semibold">共 {filteredGrouped.length} 位會員</span>
                <button
                  type="button"
                  onClick={handleExportFullList}
                  className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold transition-colors shadow-2xs"
                  title="匯出完整名單 (Export Full List)"
                >
                  <Download size={13} />
                  <span>匯出完整名單 (Export Full List)</span>
                </button>
              </div>

              {loadingList ? (
                <p className="text-center py-6 text-xs text-gray-400">載入會員資料中...</p>
              ) : filteredGrouped.length === 0 ? (
                <p className="text-center py-8 text-xs text-gray-400">暫無符合條件的會員資料</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredGrouped.map((s) => {
                    const isEditing = editingStudent?.key === s.key;
                    const isAdding = addingCourseForStudent?.key === s.key;

                    return (
                      <div
                        key={s.key}
                        className="p-3 bg-gray-50 border border-gray-150 rounded-xl space-y-2 text-xs shadow-2xs"
                      >
                        {/* 編輯模式 */}
                        {isEditing ? (
                          <div className="p-2.5 bg-white border border-[#FF6B57] rounded-lg space-y-2">
                            <div className="font-bold text-xs text-[#FF6B57]">編輯會員資料：</div>
                            
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-0.5">學生姓名</label>
                              <input
                                type="text"
                                value={editStudentName}
                                onChange={(e) => setEditStudentName(e.target.value)}
                                className="w-full p-1.5 border border-gray-200 rounded text-xs outline-none focus:border-[#FF6B57]"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-gray-500 mb-0.5">班別</label>
                                <select
                                  value={editStudentClass}
                                  onChange={(e) => setEditStudentClass(e.target.value)}
                                  className="w-full p-1.5 border border-gray-200 rounded text-xs outline-none"
                                >
                                  {classes.map((c) => (
                                    <option key={c} value={c}>{c} 班</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] text-gray-500 mb-0.5">分校</label>
                                <select
                                  value={editStudentBranch}
                                  onChange={(e) => setEditStudentBranch(e.target.value)}
                                  className="w-full p-1.5 border border-gray-200 rounded text-xs outline-none"
                                >
                                  {branches.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => handleSaveEditStudent(s)}
                                disabled={savingEdit}
                                className="px-3 py-1 bg-emerald-600 text-white font-bold rounded text-xs hover:bg-emerald-700 flex items-center gap-1"
                              >
                                <Check size={12} />
                                <span>{savingEdit ? '儲存中...' : '確認儲存'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStudent(null);
                                  setEditStudentName('');
                                  setEditStudentClass('');
                                  setEditStudentBranch('');
                                }}
                                className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* 一般展示行 */}
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-gray-800 text-sm">{s.student_name}</span>
                                <span className="text-gray-600 bg-gray-200/80 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                                  {s.class_name} 班
                                </span>
                                {/* ⭐ 需求 4：分校資料一併展示，未設分校亦有明確提示 */}
                                {s.branch ? (
                                  <span className="text-purple-900 font-bold text-[10px] bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                    <MapPin size={10} className="text-purple-600 shrink-0" />
                                    <span>{s.branch}</span>
                                  </span>
                                ) : (
                                  <span className="text-gray-500 text-[10px] bg-gray-100 border border-gray-200 px-2 py-0.5 rounded font-medium">
                                    未設定分校
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditStudent(s)}
                                  className="text-gray-400 hover:text-blue-600 p-1"
                                  title="編輯會員資料"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isAdding) {
                                      setAddingCourseForStudent(null);
                                      setSelectedCourseToAdd('');
                                    } else {
                                      setAddingCourseForStudent(s);
                                      const studentCourses = getAvailableCoursesForStudent(s);
                                      setSelectedCourseToAdd(studentCourses[0] || '');
                                    }
                                  }}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5"
                                  title="為此學生加選課程"
                                >
                                  <Plus size={11} />
                                  <span>加選</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStudentAll(s)}
                                  className="text-gray-400 hover:text-red-500 p-1"
                                  title="刪除學生"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* 所參加的課程標籤清單 */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              {s.enrollments.filter((e) => e.course_name && e.course_name.trim()).length === 0 ? (
                                <span className="text-[11px] text-gray-400 italic">未參加任何課程</span>
                              ) : (
                                s.enrollments
                                  .filter((e) => e.course_name && e.course_name.trim())
                                  .map((en) => (
                                    <span
                                      key={en.id}
                                      onClick={() => {
                                        if (onOpenCourseContent) {
                                          onOpenCourseContent(en.course_name, s.branch, true);
                                        }
                                      }}
                                      className={`text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                                        onOpenCourseContent ? 'cursor-pointer hover:bg-indigo-100 hover:border-indigo-300 transition-colors' : ''
                                      }`}
                                      title={onOpenCourseContent ? "點擊打開此課程的單元與家課" : undefined}
                                    >
                                      <GraduationCap size={10} />
                                      <span>{en.course_name}</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const validCourses = s.enrollments.filter((e2) => e2.course_name && e2.course_name.trim());
                                          handleDeleteEnrollment(en.id, s.student_name, en.course_name, validCourses.length);
                                        }}
                                        className="text-indigo-400 hover:text-red-600 font-bold ml-0.5"
                                        title="退出此課程"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))
                              )}
                            </div>

                            {/* 加選課程面板 (⭐ 僅顯示該學生所屬學校之課程) */}
                            {isAdding && (() => {
                              const studentCourses = getAvailableCoursesForStudent(s);
                              return (
                                <div className="mt-2 p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-xl flex items-center gap-2">
                                  <select
                                    value={selectedCourseToAdd}
                                    onChange={(e) => setSelectedCourseToAdd(e.target.value)}
                                    className={`flex-1 p-2 bg-white border border-indigo-200 rounded-lg text-xs outline-none focus:border-indigo-600 truncate ${
                                      selectedCourseToAdd ? 'text-black font-semibold' : 'text-gray-500'
                                    }`}
                                  >
                                    {studentCourses.length === 0 ? (
                                      <option value="" disabled>
                                        {s.branch ? `學校「${s.branch}」暫無可選課程` : '暫無可選課程'}
                                      </option>
                                    ) : (
                                      <>
                                        <option value="" className="text-gray-400">
                                          請選擇加選課程{s.branch ? ` (${s.branch})` : ''}...
                                        </option>
                                        {studentCourses.map((c, idx) => (
                                          <option key={`${c}_${idx}`} value={c} className="text-black font-semibold">
                                            {c}
                                          </option>
                                        ))}
                                      </>
                                    )}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={!selectedCourseToAdd}
                                    onClick={() => handleAddCourseForExistingStudent(s)}
                                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition-colors shadow-2xs shrink-0 disabled:opacity-50"
                                  >
                                    確認
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAddingCourseForStudent(null);
                                      setSelectedCourseToAdd('');
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 shrink-0 transition-colors"
                                    title="取消加選"
                                  >
                                    <X size={15} />
                                  </button>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {!isInline && onClose && (
          <div className="p-3 border-t border-gray-100 bg-gray-50 shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2 bg-gray-800 text-white rounded-xl font-bold text-xs hover:bg-gray-700"
            >
              完成
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
