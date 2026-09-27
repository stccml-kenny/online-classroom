'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Edit2,
  Clock,
  MapPin,
  BookOpen,
  GraduationCap,
  ListOrdered,
  Sparkles,
  School,
  FileText,
  Search,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import type { UserProfile } from '@/components/auth/AuthModal';
import type { CalendarEvent } from '@/types/calendar';
import { CourseItem, getCourseDisplayName, isCourseMatch } from '@/components/homework/HomeworkSetupModal';
import { HomeworkItem } from '@/components/homework/HomeworkCard';
import { databases, DATABASE_ID } from '@/lib/appwrite';
import { Query } from 'appwrite';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  branches?: string[];
  classes?: string[];
  courses?: (string | CourseItem)[];
  courseNames?: string[];
  calendarEvents: CalendarEvent[];
  onSaveEvent: (eventData: CalendarEvent, existingId?: string) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  isInline?: boolean;
}

// 格式化日期字串為 YYYY-MM-DD
function formatDateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  branches = [],
  classes = [],
  courses = [],
  courseNames = [],
  calendarEvents = [],
  onSaveEvent,
  onDeleteEvent,
  isInline = false,
}) => {
  if (!isOpen) return null;

  // 1. 權限檢查：管理員、導師及助教可建立/編輯/刪除課程日程；學生與家長純唯讀
  const isStudentOrParent = currentUser?.role === 'student' || currentUser?.role === 'parent';
  const canManage = useMemo(() => {
    if (!currentUser || isStudentOrParent) return false;
    return currentUser.role === 'admin' || currentUser.role === 'teacher' || currentUser.role === 'assistant';
  }, [currentUser, isStudentOrParent]);

  // 2. ⭐ 增加【課程清單】與【功課清單】雙標籤切換
  const [activeSubTab, setActiveSubTab] = useState<'courses' | 'homework'>('courses');

  // 3. 搜尋與過濾條件 (學生及家長預設鎖定所屬學校)
  const studentSchool = (currentUser?.branch || '').trim();
  const [filterBranch, setFilterBranch] = useState<string>(
    isStudentOrParent && studentSchool && studentSchool !== '全部分校' ? studentSchool : 'all'
  );
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 4. 新增 / 編輯課程上課日程表單狀態 (僅限管理員/導師)
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // 表單內部欄位
  const [formCourseName, setFormCourseName] = useState(courseNames[0] || '');
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(() => formatDateToYMD(new Date()));
  const [formTimeSlot, setFormTimeSlot] = useState('14:00 - 15:30');
  const [formBranch, setFormBranch] = useState(branches[0] || '全部分校');
  const [formClass, setFormClass] = useState('全體班別');
  const [formLocation, setFormLocation] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 讀取家課清單 (供功課清單使用)
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [loadingHomework, setLoadingHomework] = useState(false);

  useEffect(() => {
    const fetchHomework = async () => {
      setLoadingHomework(true);
      try {
        const res = await databases.listDocuments(DATABASE_ID, 'homework', [
          Query.orderAsc('due_date'),
          Query.limit(100),
        ]);
        setHomeworkList(res.documents as unknown as HomeworkItem[]);
      } catch (err: any) {
        try {
          const saved = localStorage.getItem('oc_local_homework');
          if (saved) setHomeworkList(JSON.parse(saved));
        } catch (e) {}
      } finally {
        setLoadingHomework(false);
      }
    };
    fetchHomework();
  }, []);

  const enrolledCoursesList = useMemo(() => {
    return Array.isArray(currentUser?.enrolledCourses) ? currentUser!.enrolledCourses : [];
  }, [currentUser]);

  // ============================================================================
  // ⭐ 核心資料 A：【課程清單】(各課程排定的每節上課日程)
  // ============================================================================
  const allCourseEvents = useMemo<CalendarEvent[]>(() => {
    const events: CalendarEvent[] = [];

    // 1. 從 courses 提取排定的課節日期 (sessionDates)
    courses.forEach((c) => {
      if (typeof c === 'object' && c !== null) {
        const cBranch = (c.branch || '').trim();

        // 學生與家長身分：只納入該學校的課程
        if (isStudentOrParent && studentSchool && studentSchool !== '全部分校') {
          if (cBranch && cBranch !== studentSchool) return;
        }

        // 學生與家長身分：只納入自己有修讀的課程
        if (isStudentOrParent && enrolledCoursesList.length > 0) {
          const matched = enrolledCoursesList.some((ec) => isCourseMatch(ec, c.name));
          if (!matched) return;
        }

        const dates = Array.isArray(c.sessionDates) ? c.sessionDates : [];
        const courseTitle = c.name;
        const branchName = c.branch || '全部分校';
        const slot = c.timeSlot || '';
        const classesList = (c.targetClasses || []).join(', ');

        dates.forEach((dateStr, idx) => {
          if (!dateStr || !dateStr.trim()) return;
          const cleanDate = dateStr.trim();
          events.push({
            id: `crs_${c.id || c.name}_${cleanDate}_${idx}`,
            title: `${courseTitle} (第 ${idx + 1} 節)`,
            description: `【${courseTitle}】第 ${idx + 1} 節上課${slot ? ` · 時間：${slot}` : ''}${branchName ? ` · 學校：${branchName}` : ''}${classesList ? ` · 班別：${classesList}` : ''}`,
            eventType: 'course',
            startDate: cleanDate,
            endDate: cleanDate,
            isAllDay: !slot,
            timeSlot: slot,
            sessionIndex: idx + 1,
            branch: branchName,
            courseName: courseTitle,
            className: classesList || '全體班別',
            location: slot ? `上課時間：${slot}` : '',
            creatorName: '課程系統排程',
          });
        });
      }
    });

    // 2. 合併手動建立的課程事件
    const validManualEvents = calendarEvents.filter((e) => {
      if (e.eventType && e.eventType !== 'course') return false;
      if (isStudentOrParent && studentSchool && studentSchool !== '全部分校') {
        if (e.branch && e.branch !== '全部分校' && e.branch !== studentSchool) return false;
      }
      if (isStudentOrParent && enrolledCoursesList.length > 0 && e.courseName) {
        const matched = enrolledCoursesList.some((ec) => isCourseMatch(ec, e.courseName || ''));
        if (!matched) return false;
      }
      return true;
    });

    return [...events, ...validManualEvents];
  }, [courses, calendarEvents, isStudentOrParent, studentSchool, enrolledCoursesList]);

  // 套用篩選至【課程清單】
  const displayedCourseEvents = useMemo(() => {
    return allCourseEvents
      .filter((evt) => {
        // 分校過濾 (非學生家長時可用)
        if (!isStudentOrParent && filterBranch !== 'all') {
          if (evt.branch && evt.branch !== '全部分校' && evt.branch !== filterBranch) return false;
        }
        // 課程過濾
        if (filterCourse !== 'all') {
          if (evt.courseName && evt.courseName !== '全部課程' && evt.courseName !== filterCourse) return false;
        }
        // 關鍵字搜尋
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const t = (evt.title || '').toLowerCase();
          const d = (evt.description || '').toLowerCase();
          const c = (evt.courseName || '').toLowerCase();
          if (!t.includes(q) && !d.includes(q) && !c.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  }, [allCourseEvents, filterBranch, filterCourse, searchQuery, isStudentOrParent]);

  // ============================================================================
  // ⭐ 核心資料 B：【功課清單】(作業與截止日程)
  // ============================================================================
  const allHomeworkEvents = useMemo<CalendarEvent[]>(() => {
    const hwEvents: CalendarEvent[] = [];
    homeworkList.forEach((hw, idx) => {
      // 1. 分校過濾
      if (studentSchool && studentSchool !== '全部分校') {
        if (hw.branch && hw.branch !== '全部分校' && hw.branch !== studentSchool) return;
      }
      // 2. 學生修讀課程過濾
      if (enrolledCoursesList.length > 0 && hw.course_name) {
        const matched = enrolledCoursesList.some((ec) => isCourseMatch(ec, hw.course_name || ''));
        if (!matched) return;
      }

      const dueDateStr = (hw.due_date || '').substring(0, 10);
      if (!dueDateStr) return;

      hwEvents.push({
        id: hw.$id || `hw_${idx}_${dueDateStr}`,
        title: hw.title,
        description: hw.description || (hw.unit_title ? `單元：${hw.unit_title}` : '在線功課作業'),
        eventType: 'homework',
        startDate: dueDateStr,
        endDate: dueDateStr,
        isAllDay: true,
        timeSlot: '截止日期',
        courseName: hw.course_name || '一般功課',
        branch: hw.branch || studentSchool || '全部分校',
        className: hw.unit_title ? `單元：${hw.unit_title}` : '',
        location: '在線功課作業',
        creatorName: '導師發布',
      });
    });
    return hwEvents;
  }, [homeworkList, studentSchool, enrolledCoursesList]);

  // 套用篩選至【功課清單】
  const displayedHomeworkEvents = useMemo(() => {
    return allHomeworkEvents
      .filter((evt) => {
        // 分校過濾
        if (!isStudentOrParent && filterBranch !== 'all') {
          if (evt.branch && evt.branch !== '全部分校' && evt.branch !== filterBranch) return false;
        }
        // 課程過濾
        if (filterCourse !== 'all') {
          if (evt.courseName && evt.courseName !== '全部課程' && evt.courseName !== filterCourse) return false;
        }
        // 關鍵字搜尋
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const t = (evt.title || '').toLowerCase();
          const d = (evt.description || '').toLowerCase();
          const c = (evt.courseName || '').toLowerCase();
          if (!t.includes(q) && !d.includes(q) && !c.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  }, [allHomeworkEvents, filterBranch, filterCourse, searchQuery, isStudentOrParent]);

  // 可供下拉選單篩選的課程名稱清單
  const availableCourseNames = useMemo(() => {
    if (isStudentOrParent && enrolledCoursesList.length > 0) {
      return enrolledCoursesList;
    }
    return courseNames.length > 0 ? courseNames : ['小學英語常規班', '中學數學專修班'];
  }, [isStudentOrParent, enrolledCoursesList, courseNames]);

  // 處理開啟表單
  const handleOpenCreateForm = () => {
    setEditingEvent(null);
    setFormCourseName(availableCourseNames[0] || '一般課程');
    setFormTitle('');
    setFormDate(formatDateToYMD(new Date()));
    setFormTimeSlot('14:00 - 15:30');
    setFormBranch(studentSchool && studentSchool !== '全部分校' ? studentSchool : (branches[0] || '全部分校'));
    setFormClass('全體班別');
    setFormLocation('');
    setFormDescription('');
    setShowFormModal(true);
  };

  const handleOpenEditForm = (evt: CalendarEvent) => {
    setEditingEvent(evt);
    setFormCourseName(evt.courseName || availableCourseNames[0] || '一般課程');
    setFormTitle(evt.title || '');
    setFormDate((evt.startDate || '').substring(0, 10));
    setFormTimeSlot(evt.timeSlot || '14:00 - 15:30');
    setFormBranch(evt.branch || '全部分校');
    setFormClass(evt.className || '全體班別');
    setFormLocation(evt.location || '');
    setFormDescription(evt.description || '');
    setShowFormModal(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast('請輸入上課日程標題');
      return;
    }

    setFormSubmitting(true);
    try {
      const eventData: CalendarEvent = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        eventType: 'course',
        startDate: formDate,
        endDate: formDate,
        isAllDay: !formTimeSlot,
        timeSlot: formTimeSlot,
        branch: formBranch,
        courseName: formCourseName,
        className: formClass,
        location: formLocation,
        creatorUsername: currentUser?.username || '',
        creatorName: currentUser?.name || currentUser?.username || '導師',
        createdAt: new Date().toISOString(),
      };

      await onSaveEvent(eventData, editingEvent?.$id || editingEvent?.id);
      setShowFormModal(false);
      showToast(editingEvent ? '上課日程已成功更新！' : '上課日程已成功新增！');
    } catch (err: any) {
      showToast('儲存失敗：' + (err.message || '未知錯誤'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除此上課日程記錄嗎？')) return;
    try {
      await onDeleteEvent(id);
      showToast('上課日程已刪除');
    } catch (err: any) {
      showToast('刪除失敗：' + (err.message || '未知錯誤'));
    }
  };

  return (
    <div className={isInline ? "flex-1 w-full flex flex-col bg-[#F8F9FA] overflow-hidden" : "fixed inset-0 z-50 flex flex-col bg-[#F8F9FA] w-screen h-screen overflow-hidden animate-in fade-in duration-200"}>
      
      {/* 1. 頂部滿板功能導航列 */}
      <div className="bg-gradient-to-r from-[#FF6B57] via-[#FF7A66] to-[#FF8E7D] text-white px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
            <CalendarIcon size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-wide">
                課程行事曆
              </h1>
              {isStudentOrParent && studentSchool && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-white/25 text-white flex items-center gap-1">
                  <School size={12} />
                  <span>{studentSchool}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-white/90">
              {isStudentOrParent
                ? `專屬 ${studentSchool || '本校'} 課程上課節次與功課截止清單`
                : '檢視各分校課程上課節次與功課排程清單'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* ⭐ 增加【課程清單】與【功課清單】雙標籤切換 */}
          <div className="bg-black/15 p-1 rounded-xl flex items-center">
            <button
              type="button"
              onClick={() => setActiveSubTab('courses')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'courses'
                  ? 'bg-white text-[#FF6B57] shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <BookOpen size={14} />
              <span>課程清單</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-100 text-[#FF6B57] font-black">
                {displayedCourseEvents.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('homework')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'homework'
                  ? 'bg-white text-[#FF6B57] shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <ListOrdered size={14} />
              <span>功課清單</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-black">
                {displayedHomeworkEvents.length}
              </span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
            title="關閉行事曆"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Toast 提示 */}
      {toastMessage && (
        <div className="bg-gray-900 text-white text-xs font-bold px-4 py-2 text-center animate-in fade-in shrink-0">
          {toastMessage}
        </div>
      )}

      {/* 2. 篩選與搜尋工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 min-w-[280px]">
          {/* 分校篩選 (僅教職員) */}
          {!isStudentOrParent && branches.length > 1 && (
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="bg-gray-50 border border-gray-300 text-gray-800 font-bold rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-[#FF6B57] shrink-0"
            >
              <option value="all">全部分校</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}

          {/* 課程篩選 */}
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="bg-gray-50 border border-gray-300 text-gray-800 font-bold rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-[#FF6B57] shrink-0"
          >
            <option value="all">全部課程</option>
            {availableCourseNames.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* 關鍵字搜尋 */}
          <div className="relative flex-1 min-w-[120px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={activeSubTab === 'courses' ? "搜尋上課節次..." : "搜尋功課名稱..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 bg-gray-50 border border-gray-300 text-gray-800 rounded-xl text-xs outline-none focus:border-[#FF6B57] focus:bg-white"
            />
          </div>
        </div>

        {/* 管理員/導師快捷新增上課日按鈕 */}
        {canManage && activeSubTab === 'courses' && (
          <button
            type="button"
            onClick={handleOpenCreateForm}
            className="px-3.5 py-1.5 bg-[#FF6B57] hover:bg-[#e05a48] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 shrink-0"
          >
            <Plus size={14} />
            <span>新增上課日</span>
          </button>
        )}
      </div>

      {/* 3. 核心內容清單區 */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
        {/* ============================================================ */}
        {/* 頁面 A：【課程清單】(排定課堂節次清單) */}
        {/* ============================================================ */}
        {activeSubTab === 'courses' && (
          <div className="max-w-4xl w-full mx-auto space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-extrabold text-gray-800">
                {isStudentOrParent
                  ? `我的課程上課日程（共 ${displayedCourseEvents.length} 堂課）`
                  : `全部已排定之課程上課日程（共 ${displayedCourseEvents.length} 堂課）`}
              </span>
            </div>

            {displayedCourseEvents.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center text-gray-400 text-sm space-y-2">
                <BookOpen size={32} className="mx-auto text-gray-300" />
                <p className="font-bold">目前沒有符合條件之課程上課日程</p>
                {canManage && (
                  <button
                    type="button"
                    onClick={handleOpenCreateForm}
                    className="mt-2 px-4 py-2 bg-[#FF6B57] text-white rounded-xl text-xs font-bold hover:bg-[#e05a48] transition-colors"
                  >
                    立即排定第一節上課日
                  </button>
                )}
              </div>
            ) : (
              displayedCourseEvents.map((evt) => {
                const dateOnly = (evt.startDate || '').substring(0, 10);

                return (
                  <div
                    key={evt.id || evt.$id}
                    className="p-4 rounded-2xl border border-gray-200 bg-white hover:border-indigo-300 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* 左側日期方塊 */}
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 text-center flex flex-col justify-center shrink-0 shadow-2xs">
                        <span className="text-[11px] font-bold text-indigo-600 leading-none">
                          {dateOnly.substring(5, 7)}月
                        </span>
                        <span className="text-lg font-black text-gray-900 leading-tight">
                          {dateOnly.substring(8, 10)}
                        </span>
                      </div>

                      {/* 內容主體 */}
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-indigo-100 text-indigo-800 border border-indigo-300 flex items-center gap-1">
                            <span>📚 課程上課</span>
                            {evt.sessionIndex && <span>· 第 {evt.sessionIndex} 節</span>}
                          </span>
                          <h4 className="text-sm font-black text-gray-900 truncate">
                            {evt.title}
                          </h4>
                          {evt.branch && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold border border-purple-200">
                              {evt.branch}
                            </span>
                          )}
                          {evt.className && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-bold">
                              {evt.className}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                          <span className="flex items-center gap-1 font-bold text-indigo-700">
                            <Clock size={13} />
                            {evt.timeSlot || '全天'}
                          </span>
                          {evt.courseName && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <BookOpen size={13} />
                              {evt.courseName}
                            </span>
                          )}
                          {evt.location && evt.location !== evt.timeSlot && (
                            <span className="flex items-center gap-1 text-gray-400">
                              <MapPin size={13} />
                              {evt.location}
                            </span>
                          )}
                        </div>

                        {evt.description && (
                          <p className="text-xs text-gray-600 line-clamp-2 pt-0.5">
                            {evt.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 教職員管理按鈕 */}
                    {canManage && (
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditForm(evt)}
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                          title="編輯"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => evt.id && handleDelete(evt.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="刪除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 頁面 B：【功課清單】(功課截止與作業清單) */}
        {/* ============================================================ */}
        {activeSubTab === 'homework' && (
          <div className="max-w-4xl w-full mx-auto space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-extrabold text-gray-800">
                {isStudentOrParent
                  ? `我的功課繳交清單（共 ${displayedHomeworkEvents.length} 項功課）`
                  : `全部課程之功課繳交日程（共 ${displayedHomeworkEvents.length} 項功課）`}
              </span>
            </div>

            {loadingHomework ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-2">
                <Loader2 size={24} className="animate-spin text-[#FF6B57]" />
                <p className="text-xs font-bold">載入功課清單中...</p>
              </div>
            ) : displayedHomeworkEvents.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center text-gray-400 text-sm space-y-2">
                <ListOrdered size={32} className="mx-auto text-gray-300" />
                <p className="font-bold">目前沒有待繳交之功課清單</p>
              </div>
            ) : (
              displayedHomeworkEvents.map((evt) => {
                const dateOnly = (evt.startDate || '').substring(0, 10);

                return (
                  <div
                    key={evt.id || evt.$id}
                    className="p-4 rounded-2xl border border-amber-200 bg-white hover:border-amber-400 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* 左側日期方塊 */}
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-center flex flex-col justify-center shrink-0 shadow-2xs text-amber-800">
                        <span className="text-[11px] font-bold leading-none">
                          {dateOnly.substring(5, 7)}月
                        </span>
                        <span className="text-lg font-black leading-tight">
                          {dateOnly.substring(8, 10)}
                        </span>
                      </div>

                      {/* 內容主體 */}
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-black border bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1">
                            <FileText size={11} /> 功課清單
                          </span>
                          <h4 className="text-sm font-black text-gray-900 truncate">
                            {evt.title}
                          </h4>
                          {evt.branch && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold border border-purple-200">
                              {evt.branch}
                            </span>
                          )}
                          {evt.className && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold border border-amber-200">
                              {evt.className}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                          <span className="flex items-center gap-1 font-bold text-amber-700">
                            <Clock size={13} />
                            截止日期：{dateOnly}
                          </span>
                          {evt.courseName && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <BookOpen size={13} />
                              {evt.courseName}
                            </span>
                          )}
                        </div>

                        {evt.description && (
                          <p className="text-xs text-gray-600 line-clamp-2 pt-0.5">
                            {evt.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 4. 底部滿板關閉列 (僅在浮動彈窗模式下呈現) */}
      {!isInline && (
        <div className="p-3.5 bg-white border-t border-gray-200 flex justify-end shrink-0 shadow-md">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-xs"
          >
            完成並關閉
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 新增 / 編輯課程上課日表單彈窗 (教職員專屬) */}
      {/* ============================================================ */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200 animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-[#FF6B57] to-[#FF8E7D] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <CalendarIcon size={16} />
                <h3 className="font-extrabold text-sm">
                  {editingEvent ? '編輯課程上課日' : '新增課程上課日'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
              {/* 所屬課程 */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  所屬課程 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formCourseName}
                  onChange={(e) => setFormCourseName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#FF6B57] font-bold text-gray-800"
                >
                  {availableCourseNames.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* 上課日標題 */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  日程標題 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：第 5 節 - 口語演練與模擬測試"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#FF6B57] focus:bg-white font-bold text-gray-900"
                />
              </div>

              {/* 上課日期與時段 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">上課日期</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#FF6B57] font-bold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">上課時段</label>
                  <input
                    type="text"
                    placeholder="14:00 - 15:30"
                    value={formTimeSlot}
                    onChange={(e) => setFormTimeSlot(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#FF6B57] font-bold text-gray-800"
                  />
                </div>
              </div>

              {/* 分校與班別 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">分校</label>
                  <select
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    className="w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#FF6B57] font-bold text-gray-800"
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">目標班別</label>
                  <select
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    className="w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#FF6B57] font-bold text-gray-800"
                  >
                    <option value="全體班別">全體班別</option>
                    {classes.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 上課地點 / 課室 */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">上課地點 / 課室 (選填)</label>
                <input
                  type="text"
                  placeholder="例如：302 課室 或 線上 Zoom 會議室"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#FF6B57] text-gray-800"
                />
              </div>

              {/* 課堂說明 */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">課堂說明 (選填)</label>
                <textarea
                  rows={3}
                  placeholder="可備註當堂所需教材或重點事項..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#FF6B57] text-xs text-gray-800 resize-none"
                ></textarea>
              </div>

              {/* 表單操作按鈕 */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-xl font-bold transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-6 py-2 bg-[#FF6B57] hover:bg-[#e05a48] text-white rounded-xl font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {formSubmitting && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingEvent ? '儲存變更' : '立即新增'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
