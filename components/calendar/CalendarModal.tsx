'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  Clock,
  MapPin,
  Tag,
  BookOpen,
  GraduationCap,
  CalendarDays,
  ListOrdered,
  Sparkles,
  School
} from 'lucide-react';
import type { UserProfile, UserRole } from '@/components/auth/AuthModal';
import type { CalendarEvent } from '@/types/calendar';
import { EVENT_TYPE_CONFIG } from '@/types/calendar';
import { CourseItem, getCourseDisplayName } from '@/components/homework/HomeworkSetupModal';

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
}) => {
  if (!isOpen) return null;

  // 1. 權限檢查：管理員、導師及助教可建立/編輯/刪除課程日程；學生與家長純唯讀
  const isStudentOrParent = currentUser?.role === 'student' || currentUser?.role === 'parent';
  const canManage = useMemo(() => {
    if (!currentUser || isStudentOrParent) return false;
    return currentUser.role === 'admin' || currentUser.role === 'teacher' || currentUser.role === 'assistant';
  }, [currentUser, isStudentOrParent]);

  // 2. 視圖模式：'month' (月曆網格) 或 'agenda' (日程清單)
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');

  // 3. 當前瀏覽的月份基準日期 (預設今天)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());

  // 4. 當前選取的日期 (預設今天 YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateToYMD(new Date()));

  // 5. 篩選條件 (學生及家長預設鎖定所屬學校)
  const studentSchool = (currentUser?.branch || '').trim();
  const [filterBranch, setFilterBranch] = useState<string>(
    isStudentOrParent && studentSchool && studentSchool !== '全部分校' ? studentSchool : 'all'
  );
  const [filterCourse, setFilterCourse] = useState<string>('all');

  // 6. 新增 / 編輯日程表單狀態 (僅限管理員/導師)
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // 表單內部欄位
  const [formCourseName, setFormCourseName] = useState(courseNames[0] || '');
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(selectedDate);
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

  // 年與月計算
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };
  const handleToday = () => {
    const today = new Date();
    setCurrentMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(formatDateToYMD(today));
  };

  // ⭐ 需求 1 & 2：行事曆關聯課程上課日期 (從 courses 的 sessionDates 提取)
  // ⭐ 需求 4：學生及家長帳戶只顯示該學校的課程
  const allCourseScheduleEvents = useMemo<CalendarEvent[]>(() => {
    const events: CalendarEvent[] = [];

    // 1. 從課程物件提取排定的課節日期
    courses.forEach((c) => {
      if (typeof c === 'object' && c !== null) {
        const cBranch = (c.branch || '').trim();

        // 學生與家長身分：嚴格只納入該學校的課程
        if (isStudentOrParent && studentSchool && studentSchool !== '全部分校') {
          if (cBranch && cBranch !== studentSchool) {
            return; // 略過非該學校之課程
          }
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

    // 2. 合併手動建立的課程事件 (若有)，嚴格過濾掉已移除的類型（假期、評估、活動、功課、其他）
    const validManualEvents = calendarEvents.filter((e) => {
      // 僅保留 course 類型
      if (e.eventType && e.eventType !== 'course') return false;

      // 學生與家長嚴格只看該學校
      if (isStudentOrParent && studentSchool && studentSchool !== '全部分校') {
        if (e.branch && e.branch !== '全部分校' && e.branch !== studentSchool) {
          return false;
        }
      }
      return true;
    });

    return [...events, ...validManualEvents];
  }, [courses, calendarEvents, isStudentOrParent, studentSchool]);

  // 7. 套用頂部下拉過濾（分校與特定課程）
  const displayedEvents = useMemo(() => {
    return allCourseScheduleEvents.filter((evt) => {
      // 分校過濾 (非學生家長時可用)
      if (!isStudentOrParent && filterBranch !== 'all') {
        if (evt.branch && evt.branch !== '全部分校' && evt.branch !== filterBranch) {
          return false;
        }
      }

      // 課程過濾
      if (filterCourse !== 'all') {
        if (evt.courseName && evt.courseName !== '全部課程' && evt.courseName !== filterCourse) {
          return false;
        }
      }

      return true;
    });
  }, [allCourseScheduleEvents, filterBranch, filterCourse, isStudentOrParent]);

  // 8. 建立月曆網格矩陣
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      events: CalendarEvent[];
    }[] = [];

    const todayStr = formatDateToYMD(new Date());

    // 填充上個月的尾巴
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, daysInPrevMonth - i);
      const dateStr = formatDateToYMD(prevDate);
      const dayEvts = displayedEvents.filter((e) => {
        const s = (e.startDate || '').substring(0, 10);
        const ed = (e.endDate || e.startDate || '').substring(0, 10);
        return s <= dateStr && dateStr <= ed;
      });
      cells.push({
        dateStr,
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        events: dayEvts,
      });
    }

    // 填充當月的日期
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const thisDate = new Date(year, month, d);
      const dateStr = formatDateToYMD(thisDate);
      const dayEvts = displayedEvents.filter((e) => {
        const s = (e.startDate || '').substring(0, 10);
        const ed = (e.endDate || e.startDate || '').substring(0, 10);
        return s <= dateStr && dateStr <= ed;
      });
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        events: dayEvts,
      });
    }

    // 填充下個月的開頭至 35 或 42 格 (保證網格完整)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let nextD = 1; nextD <= remaining; nextD++) {
      const nextDate = new Date(year, month + 1, nextD);
      const dateStr = formatDateToYMD(nextDate);
      const dayEvts = displayedEvents.filter((e) => {
        const s = (e.startDate || '').substring(0, 10);
        const ed = (e.endDate || e.startDate || '').substring(0, 10);
        return s <= dateStr && dateStr <= ed;
      });
      cells.push({
        dateStr,
        dayNumber: nextD,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        events: dayEvts,
      });
    }

    return cells;
  }, [year, month, selectedDate, displayedEvents]);

  // 9. 當前選中日期的上課日程清單
  const selectedDateEvents = useMemo(() => {
    return displayedEvents.filter((e) => {
      const s = (e.startDate || '').substring(0, 10);
      const ed = (e.endDate || e.startDate || '').substring(0, 10);
      return s <= selectedDate && selectedDate <= ed;
    });
  }, [displayedEvents, selectedDate]);

  // 開啟新增表單 (僅管理員/導師)
  const handleOpenCreateForm = (targetDate?: string) => {
    if (!canManage) return;
    setEditingEvent(null);
    setFormCourseName(courseNames[0] || '');
    setFormTitle('');
    setFormDate(targetDate || selectedDate || formatDateToYMD(new Date()));
    setFormTimeSlot('14:00 - 15:30');
    setFormBranch(branches[0] || '全部分校');
    setFormClass('全體班別');
    setFormLocation('');
    setFormDescription('');
    setShowFormModal(true);
  };

  // 開啟編輯表單 (僅手動建立之事件可編輯)
  const handleOpenEditForm = (evt: CalendarEvent) => {
    if (!canManage) return;
    setEditingEvent(evt);
    setFormCourseName(evt.courseName || courseNames[0] || '');
    setFormTitle(evt.title || '');
    setFormDate((evt.startDate || '').substring(0, 10));
    setFormTimeSlot(evt.timeSlot || '');
    setFormBranch(evt.branch || branches[0] || '全部分校');
    setFormClass(evt.className || '全體班別');
    setFormLocation(evt.location || '');
    setFormDescription(evt.description || '');
    setShowFormModal(true);
  };

  // 儲存表單
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    const finalTitle = formTitle.trim() || `${formCourseName} 上課`;
    setFormSubmitting(true);
    try {
      const payload: CalendarEvent = {
        title: finalTitle,
        description: formDescription.trim(),
        eventType: 'course',
        startDate: formDate,
        endDate: formDate,
        isAllDay: !formTimeSlot,
        timeSlot: formTimeSlot.trim(),
        branch: formBranch,
        courseName: formCourseName,
        className: formClass,
        location: formLocation.trim() || (formTimeSlot ? `時間：${formTimeSlot}` : ''),
        creatorUsername: currentUser?.username || 'admin',
        creatorName: currentUser?.name || '教職員',
        createdAt: editingEvent?.createdAt || new Date().toISOString(),
      };

      const targetId = editingEvent?.$id || editingEvent?.id;
      await onSaveEvent(payload, targetId);
      setShowFormModal(false);
      showToast(editingEvent ? '✅ 課程日程已更新！' : '🎉 新課程日程已發布！');
    } catch (err: any) {
      alert('儲存失敗：' + (err.message || '未知錯誤'));
    } finally {
      setFormSubmitting(false);
    }
  };

  // 刪除事件
  const handleDeleteEvent = async (evt: CalendarEvent) => {
    if (!canManage) return;
    const idToDelete = evt.$id || evt.id;
    if (!idToDelete) return;
    if (window.confirm(`確定要刪除「${evt.title}」此上課日程嗎？`)) {
      try {
        await onDeleteEvent(idToDelete);
        showToast('🗑️ 日程已刪除');
      } catch (err: any) {
        alert('刪除失敗：' + (err.message || '未知錯誤'));
      }
    }
  };

  return (
    /* ⭐ 需求 1：行事曆全板顯示 (滿板視窗，佔滿全螢幕) */
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F8F9FA] w-screen h-screen overflow-hidden animate-in fade-in duration-200">
      
      {/* 1. 頂部滿板功能導航列 */}
      <div className="bg-gradient-to-r from-[#FF6B57] via-[#FF7A66] to-[#FF8E7D] text-white px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
            <CalendarIcon size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-wide">
                課程行事曆 · 上課日程
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
                ? `專屬 ${studentSchool || '本校'} 課程上課日程表`
                : '檢視各分校課程上課節次與排程日曆'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* 視圖切換 (月曆 / 清單) */}
          <div className="bg-black/15 p-1 rounded-xl flex items-center">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'month'
                  ? 'bg-white text-[#FF6B57] shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <CalendarDays size={14} />
              <span>月曆網格</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'agenda'
                  ? 'bg-white text-[#FF6B57] shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <ListOrdered size={14} />
              <span>上課清單</span>
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

      {/* 2. 篩選與操作工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold text-gray-500 shrink-0">篩選課程：</span>

          {/* ⭐ 需求 4：學生及家長只顯示該學校的課程，因此分校選單僅限教職員可用 */}
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

          {/* 課程下拉篩選 */}
          {courseNames.length > 0 && (
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="bg-gray-50 border border-gray-300 text-gray-800 font-bold rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-[#FF6B57] shrink-0 max-w-[200px] truncate"
            >
              <option value="all">全部課程</option>
              {courseNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          <span className="text-xs text-indigo-700 font-bold bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 shrink-0">
            📚 上課課節共 {displayedEvents.length} 堂
          </span>
        </div>

        {/* ⭐ 需求 5：學生及家長帳戶沒有新增當日行程 (僅管理員/導師可見新增按鈕) */}
        {canManage && (
          <button
            type="button"
            onClick={() => handleOpenCreateForm()}
            className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shrink-0 shadow-xs hover:opacity-95 transition-all active:scale-95"
          >
            <Plus size={15} />
            <span>新增課程上課日</span>
          </button>
        )}
      </div>

      {/* 提示訊息 Toast */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-xl animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* 3. 核心全板內容區 */}
      <div className="flex-1 overflow-y-auto flex flex-col p-4 sm:p-6 space-y-4">
        
        {/* ============================================================ */}
        {/* 視圖 A：月曆網格視圖 */}
        {/* ============================================================ */}
        {viewMode === 'month' && (
          <div className="flex-1 flex flex-col space-y-4 max-w-6xl w-full mx-auto">
            
            {/* 月份導航橫列 */}
            <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <h2 className="text-lg sm:text-xl font-black text-gray-900">
                  {year}年 {month + 1}月
                </h2>
                <button
                  type="button"
                  onClick={handleToday}
                  className="px-2.5 py-1 text-xs font-bold text-[#FF6B57] bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                >
                  回到今天
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200"
                  title="上個月"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200"
                  title="下個月"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* 7 欄月曆全板網格 */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden shrink-0">
              {/* 星期標頭 */}
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/90 text-center text-xs sm:text-sm font-extrabold text-gray-600 py-2.5">
                <span className="text-red-500">週日</span>
                <span>週一</span>
                <span>週二</span>
                <span>週三</span>
                <span>週四</span>
                <span>週五</span>
                <span className="text-blue-600">週六</span>
              </div>

              {/* 日期單元格 */}
              <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
                {calendarGrid.map((cell, idx) => {
                  const isSunday = idx % 7 === 0;
                  const isSaturday = idx % 7 === 6;

                  return (
                    <div
                      key={cell.dateStr}
                      onClick={() => setSelectedDate(cell.dateStr)}
                      className={`min-h-[78px] sm:min-h-[96px] p-1.5 flex flex-col justify-between cursor-pointer transition-all relative ${
                        !cell.isCurrentMonth
                          ? 'bg-gray-50/40 text-gray-300'
                          : 'bg-white hover:bg-orange-50/30'
                      } ${
                        cell.isSelected
                          ? 'ring-2 ring-[#FF6B57] ring-inset bg-orange-50/40 z-10'
                          : ''
                      }`}
                    >
                      {/* 日期數字 */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs sm:text-sm font-black w-6 h-6 flex items-center justify-center rounded-full leading-none ${
                            cell.isToday
                              ? 'bg-[#FF6B57] text-white shadow-xs'
                              : cell.isSelected
                              ? 'text-[#FF6B57]'
                              : isSunday
                              ? 'text-red-500'
                              : isSaturday
                              ? 'text-blue-600'
                              : 'text-gray-800'
                          }`}
                        >
                          {cell.dayNumber}
                        </span>

                        {cell.events.length > 2 && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded">
                            {cell.events.length} 堂
                          </span>
                        )}
                      </div>

                      {/* 課程上課標籤 */}
                      <div className="space-y-1 mt-1 overflow-hidden">
                        {cell.events.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id || ev.$id || ev.title}
                            className="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-md truncate font-extrabold leading-tight bg-indigo-50 text-indigo-900 border border-indigo-200 flex items-center gap-1 shadow-2xs"
                            title={`${ev.title} ${ev.timeSlot ? `(${ev.timeSlot})` : ''}`}
                          >
                            <span className="shrink-0 text-indigo-600">📚</span>
                            <span className="truncate">{ev.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 選取日期之「當日課程上課日程」區塊 */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-gray-900">
                      {selectedDate} 上課日程
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      當日排定 {selectedDateEvents.length} 節課程
                    </p>
                  </div>
                </div>

                {/* ⭐ 需求 5：學生及家長帳戶沒有新增當日行程 (僅教職員顯示) */}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleOpenCreateForm(selectedDate)}
                    className="text-xs text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <Plus size={14} /> 新增當日課程
                  </button>
                )}
              </div>

              {/* 當日課程卡片列表 */}
              <div className="space-y-2.5">
                {selectedDateEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    當日無排定任何課程上課
                  </div>
                ) : (
                  selectedDateEvents.map((evt) => (
                    <div
                      key={evt.id || evt.$id}
                      className="p-3.5 sm:p-4 rounded-2xl border border-gray-200 bg-white hover:border-indigo-300 transition-all shadow-2xs flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-indigo-100 text-indigo-800 border border-indigo-300 flex items-center gap-1">
                            <span>📚 課程上課</span>
                            {evt.sessionIndex && (
                              <span>· 第 {evt.sessionIndex} 節</span>
                            )}
                          </span>
                          <h4 className="text-xs sm:text-sm font-black text-gray-900 truncate">
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

                        {/* 時間資訊 */}
                        <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                          <span className="flex items-center gap-1 font-bold text-indigo-700">
                            <Clock size={13} />
                            {evt.timeSlot || (evt.isAllDay ? '全天' : '請參閱排程')}
                          </span>
                          {evt.location && evt.location !== evt.timeSlot && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <MapPin size={13} />
                              {evt.location}
                            </span>
                          )}
                        </div>

                        {evt.description && (
                          <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                            {evt.description}
                          </p>
                        )}
                      </div>

                      {/* 僅手動建立之課程事件且具管理權限時顯示編輯刪除 */}
                      {canManage && evt.$id && (
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditForm(evt)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-100"
                            title="編輯"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(evt)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                            title="刪除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* 視圖 B：上課日程列表視圖 (Agenda / List View) */}
        {/* ============================================================ */}
        {viewMode === 'agenda' && (
          <div className="max-w-4xl w-full mx-auto space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-extrabold text-gray-800">
                全部已排定之課程上課日程（共 {displayedEvents.length} 堂）
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleOpenCreateForm()}
                  className="text-xs text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl transition-colors"
                >
                  <Plus size={14} /> 新增課程上課日
                </button>
              )}
            </div>

            {displayedEvents.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center text-gray-400 text-sm">
                目前沒有排定的課程上課日程
              </div>
            ) : (
              displayedEvents
                .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
                .map((evt) => {
                  const dateOnly = (evt.startDate || '').substring(0, 10);

                  return (
                    <div
                      key={evt.id || evt.$id}
                      className="p-4 rounded-2xl border border-gray-200 bg-white hover:border-indigo-300 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
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

                        {/* 內容 */}
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-indigo-100 text-indigo-800 border border-indigo-300">
                              📚 課程上課
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
                            {evt.location && evt.location !== evt.timeSlot && (
                              <span className="flex items-center gap-1 text-gray-500">
                                <MapPin size={13} />
                                {evt.location}
                              </span>
                            )}
                          </div>

                          {evt.description && (
                            <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                              {evt.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 編輯刪除 (僅限教職員手動發布之項目) */}
                      {canManage && evt.$id && (
                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleOpenEditForm(evt)}
                            className="px-3 py-1.5 text-xs border border-gray-200 text-gray-700 hover:text-indigo-600 rounded-xl hover:bg-gray-50 font-bold flex items-center gap-1 transition-colors"
                          >
                            <Edit2 size={13} />
                            <span>編輯</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(evt)}
                            className="px-3 py-1.5 text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold flex items-center gap-1 transition-colors"
                          >
                            <Trash2 size={13} />
                            <span>刪除</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        )}

      </div>

      {/* 4. 底部滿板關閉列 */}
      <div className="p-3.5 bg-white border-t border-gray-200 flex justify-end shrink-0 shadow-md">
        <button
          type="button"
          onClick={onClose}
          className="px-8 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-xs"
        >
          完成並關閉
        </button>
      </div>

      {/* ============================================================ */}
      {/* 5. 新增 / 編輯課程上課日 Modal (僅限教職員) */}
      {/* ============================================================ */}
      {showFormModal && canManage && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] border border-gray-100 animate-in zoom-in-95">
            
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-xl shadow-xs">
                  <CalendarIcon size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">
                    {editingEvent ? '編輯課程上課日程' : '新增課程上課日程'}
                  </h3>
                  <p className="text-[11px] text-gray-500">排定特定分校與班別之上課日期</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3.5">
              
              {/* 選擇課程 */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  所屬課程 <span className="text-red-500">*</span>
                </label>
                {courseNames.length > 0 ? (
                  <select
                    value={formCourseName}
                    onChange={(e) => {
                      setFormCourseName(e.target.value);
                      if (!formTitle) setFormTitle(`${e.target.value} 上課`);
                    }}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none focus:border-purple-600"
                  >
                    {courseNames.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={formCourseName}
                    onChange={(e) => setFormCourseName(e.target.value)}
                    placeholder="輸入課程名稱"
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none"
                  />
                )}
              </div>

              {/* 標題 (選填) */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  日程標題 (選填)
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={`預設：${formCourseName || '課程'} 上課`}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none focus:border-purple-600 shadow-2xs"
                />
              </div>

              {/* 上課日期與時間 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    上課日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    上課時間
                  </label>
                  <input
                    type="text"
                    value={formTimeSlot}
                    onChange={(e) => setFormTimeSlot(e.target.value)}
                    placeholder="例：14:00 - 15:30"
                    className="w-full p-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none"
                  />
                </div>
              </div>

              {/* 學校/分校 與 班別 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">所屬學校/分校</label>
                  <select
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none"
                  >
                    <option value="全部分校">全部分校</option>
                    {branches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">目標班別</label>
                  <select
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none"
                  >
                    <option value="全體班別">全體班別</option>
                    {classes.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 上課地點 */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">課室或地點 (選填)</label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="例：302 課室、線上會議室..."
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none shadow-2xs"
                />
              </div>

              {/* 備註 */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">上課備註 (選填)</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="請攜帶之講義或課前準備事項..."
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none shadow-2xs resize-none"
                />
              </div>

              {/* 提交按鈕 */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-[#FF6B57] to-[#FF8573] text-white rounded-xl text-xs font-bold hover:opacity-95 shadow-md transition-all disabled:opacity-50"
                >
                  {formSubmitting ? '儲存中...' : editingEvent ? '儲存修改' : '確認新增上課日'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
