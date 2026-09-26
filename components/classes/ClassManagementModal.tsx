import React, { useState, useEffect } from 'react';
import {
  X, Users, Trash2, Download,
  CheckCircle, GraduationCap, Check, Edit2, RotateCcw, User,
  MapPin, Plus
} from 'lucide-react';
import { CourseItem, getCourseDisplayName } from '../homework/HomeworkSetupModal';
import { databases, DATABASE_ID } from '@/lib/appwrite';
import { ID, Query } from 'appwrite';
import { UserProfile } from '@/components/auth/AuthModal';

interface ClassManagementModalProps {
  isOpen?: boolean;
  isInline?: boolean; // ⭐ 支援滿板顯示 (非浮動彈窗)
  onClose?: () => void;
  branches: string[];
  classes: string[];
  courses: string[];
  courseItems?: (string | CourseItem)[];
  usersList?: UserProfile[];
  onUpdateUsersList?: (newUsers: UserProfile[]) => void;
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
  usersList = [],
  onUpdateUsersList,
  onDataChanged,
  onOpenCourseContent,
}) => {
  // ⭐ 需求 2：會員目錄只保留現有會員，刪除新增會員及Excel批次匯入
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

  const handleResetAllStates = () => {
    setEditingStudent(null);
    setEditStudentName('');
    setEditStudentClass('');
    setEditStudentBranch('');
    setSavingEdit(false);
    setAddingCourseForStudent(null);
    setSelectedCourseToAdd('');
    setFilterClass('全部班別');
    setFilterCourse('全部課程');
  };

  const handleCloseModal = () => {
    handleResetAllStates();
    if (onClose) onClose();
  };

  const prevOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (prevOpenRef.current && !isOpen) {
      handleResetAllStates();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  // 取得學生所屬學校之課程
  const getAvailableCoursesForStudent = (student: GroupedStudent): string[] => {
    const sBranch = (student.branch || '').trim();
    if (courseItems && courseItems.length > 0) {
      const matched = courseItems.filter((c) => {
        if (typeof c === 'string') return !sBranch;
        const cBranch = (c.branch || '').trim();
        if (!sBranch) return true;
        return !cBranch || cBranch === '全部分校' || cBranch === sBranch || sBranch.includes(cBranch) || cBranch.includes(sBranch);
      });
      const formatted = Array.from(new Set(matched.map((c) => getCourseDisplayName(c)))).filter(Boolean);
      return formatted;
    }
    return courses;
  };

  const fetchStudents = async () => {
    setLoadingList(true);
    // 1. 優先讀取本機快取防白屏
    try {
      const cached = localStorage.getItem('oc_local_students');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExistingStudents(parsed);
        }
      }
    } catch (e) {}

    // 2. 雲端同步
    try {
      const res = await databases.listDocuments(DATABASE_ID, 'students', [Query.limit(500)]);
      setExistingStudents(res.documents as unknown as StudentRecord[]);
      try {
        localStorage.setItem('oc_local_students', JSON.stringify(res.documents));
      } catch (e) {}
    } catch (err: any) {
      console.log('讀取學生清單中:', err.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStudents();
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      `"${s.enrollments.map((e) => e.course_name).filter(Boolean).join('; ').replace(/"/g, '""')}"`,
      s.enrollments.filter((e) => e.course_name).length,
    ]);

    const csvContent = String.fromCharCode(0xFEFF) + [headers.join(','), ...rows.map((r) => r.join(','))].join(String.fromCharCode(10));
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Online_Classroom_現有會員完整名單_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // 啟動編輯現有學生
  const handleStartEditStudent = (student: GroupedStudent) => {
    setEditingStudent(student);
    setEditStudentName(student.student_name);
    setEditStudentClass(student.class_name);
    setEditStudentBranch(student.branch);
  };

  // 儲存修改學生資料（同步更新該學生旗下所有註冊紀錄及帳戶名冊）
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

      // ⭐ 需求 1：同步更新帳戶管理名冊
      try {
        const rawUsers = localStorage.getItem('oc_users_list');
        const baseList: UserProfile[] = usersList && usersList.length > 0
          ? usersList
          : (rawUsers ? JSON.parse(rawUsers) : []);

        const updatedUsers = baseList.map((u) => {
          if (u.role === 'student' && u.name === student.student_name) {
            return {
              ...u,
              name: editStudentName.trim(),
              className: editStudentClass.trim(),
              branch: editStudentBranch.trim(),
            };
          }
          return u;
        });

        localStorage.setItem('oc_users_list', JSON.stringify(updatedUsers));
        if (onUpdateUsersList) onUpdateUsersList(updatedUsers);
      } catch (e) {}

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

  // ⭐ 需求 1：退出單一課程 (同時與帳戶管理中心帳戶名冊同步)
  const handleDeleteEnrollment = async (
    id: string,
    sName: string,
    cName: string,
    activeCoursesCount: number
  ) => {
    if (!window.confirm(`確定要為「${sName}」退出課程「${cName}」嗎？`)) return;
    try {
      if (activeCoursesCount <= 1) {
        await databases.updateDocument(DATABASE_ID, 'students', id, {
          course_name: '',
        });
        setExistingStudents((prev) =>
          prev.map((s) => (s.$id === id ? { ...s, course_name: '' } : s))
        );
      } else {
        await databases.deleteDocument(DATABASE_ID, 'students', id);
        setExistingStudents((prev) => prev.filter((s) => s.$id !== id));
      }

      // ⭐ 需求 1：同步更新帳戶管理中心中該學生的 enrolledCourses
      try {
        const rawUsers = localStorage.getItem('oc_users_list');
        const baseList: UserProfile[] = usersList && usersList.length > 0
          ? usersList
          : (rawUsers ? JSON.parse(rawUsers) : []);

        const updatedUsers = baseList.map((u) => {
          if (u.role === 'student' && u.name === sName) {
            const current = u.enrolledCourses || [];
            return { ...u, enrolledCourses: current.filter((c) => c !== cName) };
          }
          return u;
        });

        localStorage.setItem('oc_users_list', JSON.stringify(updatedUsers));
        if (onUpdateUsersList) onUpdateUsersList(updatedUsers);
      } catch (e) {}

      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      alert('退出失敗：' + err.message);
    }
  };

  // ⭐ 需求 1：徹底刪除學生 (同步刪除會員目錄與帳戶名冊中的學生帳戶)
  const handleDeleteStudentAll = async (student: GroupedStudent) => {
    if (!window.confirm(`確定要徹底刪除學生「${student.student_name}」的所有紀錄嗎？`)) return;
    try {
      for (const en of student.enrollments) {
        await databases.deleteDocument(DATABASE_ID, 'students', en.id);
      }
      setExistingStudents((prev) =>
        prev.filter((s) => !student.enrollments.some((en) => en.id === s.$id))
      );

      // 同步清理本地會員快取
      try {
        const cached = localStorage.getItem('oc_local_students');
        if (cached) {
          const list = JSON.parse(cached);
          const remaining = list.filter((s: any) => s.student_name !== student.student_name);
          localStorage.setItem('oc_local_students', JSON.stringify(remaining));
        }
      } catch (e) {}

      // 同步刪除帳戶名冊中的相對學生帳戶
      try {
        const rawUsers = localStorage.getItem('oc_users_list');
        const baseList: UserProfile[] = usersList && usersList.length > 0
          ? usersList
          : (rawUsers ? JSON.parse(rawUsers) : []);

        const remainingUsers = baseList.filter(
          (u) => !(u.role === 'student' && u.name === student.student_name)
        );

        localStorage.setItem('oc_users_list', JSON.stringify(remainingUsers));
        if (onUpdateUsersList) onUpdateUsersList(remainingUsers);
      } catch (e) {}

      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      alert('刪除失敗：' + err.message);
    }
  };

  // ⭐ 需求 1：為學生加選課程 (同時與帳戶管理中心帳戶名冊同步)
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

      // ⭐ 需求 1：同步更新帳戶管理中心中該學生的 enrolledCourses
      try {
        const rawUsers = localStorage.getItem('oc_users_list');
        const baseList: UserProfile[] = usersList && usersList.length > 0
          ? usersList
          : (rawUsers ? JSON.parse(rawUsers) : []);

        const updatedUsers = baseList.map((u) => {
          if (u.role === 'student' && u.name === student.student_name) {
            const current = u.enrolledCourses || [];
            if (!current.includes(courseToAdd)) {
              return { ...u, enrolledCourses: [...current, courseToAdd] };
            }
          }
          return u;
        });

        localStorage.setItem('oc_users_list', JSON.stringify(updatedUsers));
        if (onUpdateUsersList) onUpdateUsersList(updatedUsers);
      } catch (e) {}

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
            <h4 className="font-bold text-base">會員目錄 (現有會員名冊)</h4>
          </div>
          {onClose && !isInline && (
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>

        {/* ⭐ 需求 2：會員目錄只保留現有會員 (刪除新增會員及Excel批次匯入) */}
        <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-150 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-gray-800 flex items-center gap-1.5">
              <Users size={15} className="text-[#FF6B57]" />
              <span>現有會員總數：{groupedStudents.length} 位</span>
            </span>
          </div>
          <span className="text-[11px] text-gray-400">
            加選或刪除課程將即時與帳戶名冊同步
          </span>
        </div>

        {/* 內容區塊：只保留現有會員 */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 text-sm space-y-3">
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
            <span className="text-gray-500 font-semibold">顯示 {filteredGrouped.length} 位會員</span>
            <button
              type="button"
              onClick={handleExportFullList}
              className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold transition-colors shadow-2xs"
              title="匯出完整名單 (Export Full List)"
            >
              <Download size={13} />
              <span>匯出完整名單 (Excel CSV)</span>
            </button>
          </div>

          {loadingList ? (
            <p className="text-center py-6 text-xs text-gray-400">載入會員資料中...</p>
          ) : filteredGrouped.length === 0 ? (
            <p className="text-center py-8 text-xs text-gray-400">暫無符合條件的會員資料</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredGrouped.map((s) => {
                const isEditing = editingStudent?.key === s.key;
                const isAdding = addingCourseForStudent?.key === s.key;

                return (
                  <div
                    key={s.key}
                    className="p-3 bg-gray-50 border border-gray-150 rounded-xl space-y-2 text-xs shadow-2xs hover:border-gray-300 transition-all"
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
                              title="為此學生加選課程 (同步帳戶中心)"
                            >
                              <Plus size={11} />
                              <span>加選</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStudentAll(s)}
                              className="text-gray-400 hover:text-red-500 p-1"
                              title="刪除學生 (同步帳戶中心)"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* 所參加的課程標籤清單 (退出課程將即時同步帳戶中心) */}
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
                                      onOpenCourseContent?.(en.course_name, s.branch, true);
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
                                    title="退出此課程 (同步帳戶中心)"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))
                          )}
                        </div>

                        {/* 加選課程面板 */}
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
