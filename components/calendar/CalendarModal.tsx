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
  Filter,
  Check,
  Sparkles,
  AlertCircle,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  User,
  Users,
  Layers,
  CalendarDays,
  ListOrdered
} from 'lucide-react';
import type { UserProfile, UserRole } from '@/components/auth/AuthModal';
import { ROLE_CONFIGS } from '@/components/auth/AuthModal';
import type { CalendarEvent, CalendarEventType } from '@/types/calendar';
import { EVENT_TYPE_CONFIG } from '@/types/calendar';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  branches?: string[];
  classes?: string[];
  courses?: any[];
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

  // 1. 權限檢查：管理員、導師及助教可建立/編輯/刪除校曆事件
  const canManage = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.role === 'teacher' || currentUser.role === 'assistant';
  }, [currentUser]);

  const isStudentOrParent = currentUser?.role === 'student' || currentUser?.role === 'parent';

  // 2. 視圖模式：'month' (月曆網格) 或 'agenda' (日程清單)
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');

  // 3. 當前瀏覽的月份基準日期 (預設為今天)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());

  // 4. 當前選取的日期 (預設今天 YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateToYMD(new Date()));

  // 5. 篩選條件
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBranch, setFilterBranch] = useState<string>(
    isStudentOrParent && currentUser?.branch ? currentUser.branch : 'all'
  );
  const [filterCourse, setFilterCourse] = useState<string>('all');

  // 6. 新增 / 編輯事件表單彈窗狀態
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // 表單內部欄位狀態
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formEventType, setFormEventType] = useState<CalendarEventType>('activity');
  const [formStartDate, setFormStartDate] = useState(selectedDate);
  const [formEndDate, setFormEndDate] = useState(selectedDate);
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formIsAllDay, setFormIsAllDay] = useState(true);
  const [formBranch, setFormBranch] = useState(branches[0] || '全部分校');
  const [formCourse, setFormCourse] = useState('全部課程');
  const [formClass, setFormClass] = useState('全體班別');
  const [formLocation, setFormLocation] = useState('');
  const [formTargetRole, setFormTargetRole] = useState<'all' | 'staff_only' | 'student_parent_only'>('all');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 年與月計算
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth(); // 0-indexed

  // 月份導航
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

  // 7. 依身分與篩選條件過濾行事曆事件
  const filteredEvents = useMemo(() => {
    const myRole = currentUser?.role;
    const myBranch = currentUser?.branch;
    const myEnrolledCourses = currentUser?.enrolledCourses || [];

    return calendarEvents.filter((evt) => {
      // 權限可見性過濾 (targetRoles)
      if (evt.targetRoles && evt.targetRoles !== 'all') {
        try {
          const roles = JSON.parse(evt.targetRoles);
          if (Array.isArray(roles) && !roles.includes('all')) {
            if (myRole && !roles.includes(myRole)) return false;
          }
        } catch (e) {
          if (evt.targetRoles === 'staff_only') {
            if (myRole === 'student' || myRole === 'parent') return false;
          } else if (evt.targetRoles === 'student_parent_only') {
            if (myRole === 'teacher' || myRole === 'assistant') return false;
          }
        }
      }

      // 學生 / 家長自動過濾分校
      if (isStudentOrParent && myBranch && myBranch !== '全部分校') {
        if (evt.branch && evt.branch !== '全部分校' && evt.branch !== myBranch) {
          return false;
        }
      }

      // 學生 / 家長自動過濾課程
      if (isStudentOrParent && myEnrolledCourses.length > 0) {
        if (evt.courseName && evt.courseName !== '全部課程' && !myEnrolledCourses.includes(evt.courseName)) {
          return false;
        }
      }

      // 類型篩選
      if (filterType !== 'all' && evt.eventType !== filterType) {
        return false;
      }

      // 分校篩選
      if (filterBranch !== 'all' && evt.branch && evt.branch !== '全部分校' && evt.branch !== filterBranch) {
        return false;
      }

      // 課程篩選
      if (filterCourse !== 'all' && evt.courseName && evt.courseName !== '全部課程' && evt.courseName !== filterCourse) {
        return false;
      }

      return true;
    });
  }, [calendarEvents, currentUser, isStudentOrParent, filterType, filterBranch, filterCourse]);

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
      const dayEvts = filteredEvents.filter((e) => {
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
      const dayEvts = filteredEvents.filter((e) => {
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
      const dayEvts = filteredEvents.filter((e) => {
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
  }, [year, month, selectedDate, filteredEvents]);

  // 9. 當前選中日期的所有事件
  const selectedDateEvents = useMemo(() => {
    return filteredEvents.filter((e) => {
      const s = (e.startDate || '').substring(0, 10);
      const ed = (e.endDate || e.startDate || '').substring(0, 10);
      return s <= selectedDate && selectedDate <= ed;
    });
  }, [filteredEvents, selectedDate]);

  // 開啟「新增日程」表單
  const handleOpenCreateForm = (dateToSet?: string) => {
    const targetDate = dateToSet || selectedDate || formatDateToYMD(new Date());
    setEditingEvent(null);
    setFormTitle('');
    setFormDescription('');
    setFormEventType('activity');
    setFormStartDate(targetDate);
    setFormEndDate(targetDate);
    setFormStartTime('09:00');
    setFormEndTime('10:00');
    setFormIsAllDay(true);
    setFormBranch(branches[0] || '全部分校');
    setFormCourse('全部課程');
    setFormClass('全體班別');
    setFormLocation('');
    setFormTargetRole('all');
    setShowFormModal(true);
  };

  // 開啟「編輯日程」表單
  const handleOpenEditForm = (evt: CalendarEvent) => {
    setEditingEvent(evt);
    setFormTitle(evt.title || '');
    setFormDescription(evt.description || '');
    setFormEventType(evt.eventType || 'activity');
    setFormStartDate((evt.startDate || '').substring(0, 10));
    setFormEndDate((evt.endDate || evt.startDate || '').substring(0, 10));
    setFormStartTime(evt.startDate?.includes('T') ? evt.startDate.substring(11, 16) : '09:00');
    setFormEndTime(evt.endDate?.includes('T') ? evt.endDate.substring(11, 16) : '10:00');
    setFormIsAllDay(evt.isAllDay !== false);
    setFormBranch(evt.branch || '全部分校');
    setFormCourse(evt.courseName || '全部課程');
    setFormClass(evt.className || '全體班別');
    setFormLocation(evt.location || '');

    let tRole: 'all' | 'staff_only' | 'student_parent_only' = 'all';
    if (evt.targetRoles === 'staff_only') tRole = 'staff_only';
    else if (evt.targetRoles === 'student_parent_only') tRole = 'student_parent_only';
    setFormTargetRole(tRole);

    setShowFormModal(true);
  };

  // 儲存事件 (新增或更新)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('請輸入日程標題！');
      return;
    }

    setFormSubmitting(true);
    try {
      const startDateTimeStr = formIsAllDay
        ? formStartDate
        : `${formStartDate}T${formStartTime}:00`;
      const endDateTimeStr = formIsAllDay
        ? formEndDate
        : `${formEndDate}T${formEndTime}:00`;

      const payload: CalendarEvent = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        eventType: formEventType,
        startDate: startDateTimeStr,
        endDate: endDateTimeStr,
        isAllDay: formIsAllDay,
        branch: formBranch,
        courseName: formCourse,
        className: formClass,
        location: formLocation.trim(),
        targetRoles: formTargetRole,
        creatorUsername: currentUser?.username || 'admin',
        creatorName: currentUser?.name || currentUser?.username || '管理員',
        createdAt: editingEvent?.createdAt || new Date().toISOString(),
      };

      const targetId = editingEvent?.$id || editingEvent?.id;
      await onSaveEvent(payload, targetId);
      setShowFormModal(false);
      showToast(editingEvent ? '✅ 日程已成功更新！' : '🎉 新日程已成功發布！');
    } catch (err: any) {
      alert('儲存日程失敗：' + (err.message || '未知錯誤'));
    } finally {
      setFormSubmitting(false);
    }
  };

  // 刪除事件
  const handleDeleteEvent = async (evt: CalendarEvent) => {
    const idToDelete = evt.$id || evt.id;
    if (!idToDelete) return;
    if (window.confirm(`確定要刪除日程「${evt.title}」嗎？`)) {
      try {
        await onDeleteEvent(idToDelete);
        showToast('🗑️ 日程已成功刪除');
      } catch (err: any) {
        alert('刪除失敗：' + (err.message || '未知錯誤'));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg h-[92vh] max-h-[780px] flex flex-col overflow-hidden relative border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* 1. 頂部導航欄 (頂部標題與視圖切換) */}
        <div className="bg-gradient-to-r from-[#FF6B57] to-[#FF8573] text-white px-4 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <CalendarIcon size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold tracking-wide">學校校曆與行事曆</h2>
              <p className="text-[10px] text-white/80">掌握假期、活動、上課與功課繳交日程</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 視圖切換 (月曆 / 清單) */}
            <div className="bg-black/15 p-0.5 rounded-xl flex items-center">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'month' ? 'bg-white text-[#FF6B57] shadow-xs' : 'text-white/80 hover:text-white'
                }`}
                title="月曆網格視圖"
              >
                <CalendarDays size={13} />
                <span className="hidden sm:inline">月曆</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('agenda')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'agenda' ? 'bg-white text-[#FF6B57] shadow-xs' : 'text-white/80 hover:text-white'
                }`}
                title="議程列表視圖"
              >
                <ListOrdered size={13} />
                <span className="hidden sm:inline">清單</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/20 transition-colors text-white"
              title="關閉"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 2. 篩選工具列 (類型、分校、課程) */}
        <div className="bg-gray-50 border-b border-gray-200 px-3.5 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-xs">
          {/* 類型快速標籤 */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2 py-1 rounded-lg font-bold transition-colors ${
                filterType === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              全部類型
            </button>
            {(Object.keys(EVENT_TYPE_CONFIG) as CalendarEventType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={`px-2 py-1 rounded-lg font-bold transition-colors flex items-center gap-0.5 ${
                  filterType === t
                    ? 'bg-[#FF6B57] text-white shadow-2xs'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                <span>{EVENT_TYPE_CONFIG[t].emoji}</span>
                <span>{EVENT_TYPE_CONFIG[t].label}</span>
              </button>
            ))}
          </div>

          {/* 若有多分校且非學生/家長，支援分校過濾 */}
          {!isStudentOrParent && branches.length > 1 && (
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="bg-white border border-gray-300 text-gray-800 font-bold rounded-lg px-2 py-1 text-xs outline-none shrink-0"
            >
              <option value="all">全部分校</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}

          {/* 課程過濾 */}
          {courseNames.length > 0 && (
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="bg-white border border-gray-300 text-gray-800 font-bold rounded-lg px-2 py-1 text-xs outline-none shrink-0 max-w-[130px] truncate"
            >
              <option value="all">全部課程</option>
              {courseNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {/* 導師/管理員快速新增按鈕 */}
          {canManage && (
            <button
              type="button"
              onClick={() => handleOpenCreateForm()}
              className="ml-auto px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold flex items-center gap-1 shrink-0 shadow-xs hover:opacity-95 transition-all active:scale-95"
            >
              <Plus size={14} />
              <span>新增日程</span>
            </button>
          )}
        </div>

        {/* 提示訊息 Toast */}
        {toastMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg animate-in fade-in slide-in-from-top-2">
            {toastMessage}
          </div>
        )}

        {/* 3. 主要內容區域 */}
        <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50/50">
          
          {/* ============================================================ */}
          {/* 模式 A：月曆網格視圖 (Month View) */}
          {/* ============================================================ */}
          {viewMode === 'month' && (
            <div className="flex-1 flex flex-col p-3 sm:p-4 space-y-3">
              
              {/* 月份切換導航 Bar */}
              <div className="bg-white p-2.5 rounded-2xl border border-gray-200 shadow-2xs flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-gray-900">
                    {year}年 {month + 1}月
                  </h3>
                  <button
                    type="button"
                    onClick={handleToday}
                    className="px-2 py-0.5 text-[11px] font-bold text-[#FF6B57] bg-orange-50 hover:bg-orange-100 rounded-md transition-colors"
                  >
                    今天
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                    title="上個月"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                    title="下個月"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* 7 欄日曆網格 (Sun ~ Sat) */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden shrink-0">
                {/* 星期標頭 */}
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/80 text-center text-[11px] font-extrabold text-gray-500 py-1.5">
                  <span className="text-red-500">日</span>
                  <span>一</span>
                  <span>二</span>
                  <span>三</span>
                  <span>四</span>
                  <span>五</span>
                  <span className="text-blue-500">六</span>
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
                        className={`min-h-[58px] sm:min-h-[64px] p-1 flex flex-col justify-between cursor-pointer transition-all relative ${
                          !cell.isCurrentMonth
                            ? 'bg-gray-50/40 text-gray-300'
                            : 'bg-white hover:bg-orange-50/30'
                        } ${
                          cell.isSelected
                            ? 'ring-2 ring-[#FF6B57] ring-inset bg-orange-50/40 z-10'
                            : ''
                        }`}
                      >
                        {/* 日期數字標頭 */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-extrabold w-5 h-5 flex items-center justify-center rounded-full leading-none ${
                              cell.isToday
                                ? 'bg-[#FF6B57] text-white shadow-2xs'
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

                          {/* 事件數量徽章 (若超過 2 則) */}
                          {cell.events.length > 2 && (
                            <span className="text-[9px] font-bold text-gray-400">
                              +{cell.events.length}
                            </span>
                          )}
                        </div>

                        {/* 事件彩色圓點 / 小條標籤 */}
                        <div className="space-y-0.5 mt-1 overflow-hidden">
                          {cell.events.slice(0, 2).map((ev) => {
                            const cfg = EVENT_TYPE_CONFIG[ev.eventType] || EVENT_TYPE_CONFIG.other;
                            return (
                              <div
                                key={ev.$id || ev.id || ev.title}
                                className={`text-[9px] px-1 py-0.2 rounded truncate font-bold leading-tight ${cfg.bgLight} ${cfg.color} border ${cfg.border}`}
                                title={`${ev.title} (${cfg.label})`}
                              >
                                {ev.title}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 選取日期之「當日詳細行程清單」抽屜 */}
              <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs flex-1 flex flex-col space-y-2">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm text-gray-900">
                      {selectedDate} 日程清單
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">
                      {selectedDateEvents.length} 則
                    </span>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleOpenCreateForm(selectedDate)}
                      className="text-xs text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1"
                    >
                      <Plus size={14} /> 新增當日行程
                    </button>
                  )}
                </div>

                {/* 當日事件卡片列表 */}
                <div className="flex-1 overflow-y-auto space-y-2 pt-1">
                  {selectedDateEvents.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-xs">
                      當日暫無特定校務活動或課程安排
                    </div>
                  ) : (
                    selectedDateEvents.map((evt) => {
                      const cfg = EVENT_TYPE_CONFIG[evt.eventType] || EVENT_TYPE_CONFIG.other;
                      return (
                        <div
                          key={evt.$id || evt.id}
                          className="p-3 rounded-xl border border-gray-200 bg-white hover:border-[#FF6B57]/40 transition-all shadow-2xs flex items-start justify-between gap-2"
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold flex items-center gap-0.5 ${cfg.bgLight} ${cfg.color} border ${cfg.border}`}
                              >
                                <span>{cfg.emoji}</span>
                                <span>{cfg.label}</span>
                              </span>
                              <h4 className="text-xs font-black text-gray-900 truncate">
                                {evt.title}
                              </h4>
                            </div>

                            {/* 時間與地點 */}
                            <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
                              <span className="flex items-center gap-0.5">
                                <Clock size={12} className="text-gray-400" />
                                {evt.isAllDay
                                  ? '全天'
                                  : `${evt.startDate?.substring(11, 16) || ''} ~ ${evt.endDate?.substring(11, 16) || ''}`}
                              </span>
                              {evt.location && (
                                <span className="flex items-center gap-0.5">
                                  <MapPin size={12} className="text-gray-400" />
                                  {evt.location}
                                </span>
                              )}
                              {evt.branch && evt.branch !== '全部分校' && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-bold text-[10px]">
                                  {evt.branch}
                                </span>
                              )}
                              {evt.courseName && evt.courseName !== '全部課程' && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                                  {evt.courseName}
                                </span>
                              )}
                            </div>

                            {/* 描述說明 */}
                            {evt.description && (
                              <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed bg-gray-50/70 p-1.5 rounded-lg border border-gray-100">
                                {evt.description}
                              </p>
                            )}
                          </div>

                          {/* 管理按鈕 */}
                          {canManage && (
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditForm(evt)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-100"
                                title="編輯"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEvent(evt)}
                                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                title="刪除"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* 模式 B：議程列表視圖 (Agenda / List View) */}
          {/* ============================================================ */}
          {viewMode === 'agenda' && (
            <div className="p-3 sm:p-4 space-y-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-extrabold text-gray-700">
                  即將到來的日程（共 {filteredEvents.length} 項）
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleOpenCreateForm()}
                    className="text-xs text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1"
                  >
                    <Plus size={14} /> 新增日程
                  </button>
                )}
              </div>

              {filteredEvents.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-400 text-xs">
                  目前沒有相符的行事曆日程
                </div>
              ) : (
                filteredEvents
                  .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
                  .map((evt) => {
                    const cfg = EVENT_TYPE_CONFIG[evt.eventType] || EVENT_TYPE_CONFIG.other;
                    const dateOnly = (evt.startDate || '').substring(0, 10);

                    return (
                      <div
                        key={evt.$id || evt.id}
                        className="p-3.5 rounded-2xl border border-gray-200 bg-white hover:border-[#FF6B57]/40 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* 左側日期方塊 */}
                          <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 text-center flex flex-col justify-center shrink-0">
                            <span className="text-[10px] font-bold text-orange-600 leading-none">
                              {dateOnly.substring(5, 7)}月
                            </span>
                            <span className="text-base font-black text-gray-900 leading-tight">
                              {dateOnly.substring(8, 10)}
                            </span>
                          </div>

                          {/* 事件內容 */}
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold flex items-center gap-0.5 ${cfg.bgLight} ${cfg.color} border ${cfg.border}`}
                              >
                                <span>{cfg.emoji}</span>
                                <span>{cfg.label}</span>
                              </span>
                              <h4 className="text-xs sm:text-sm font-extrabold text-gray-900 truncate">
                                {evt.title}
                              </h4>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
                              <span className="flex items-center gap-0.5">
                                <Clock size={12} className="text-gray-400" />
                                {evt.isAllDay
                                  ? '全天'
                                  : `${evt.startDate?.substring(11, 16) || ''} ~ ${evt.endDate?.substring(11, 16) || ''}`}
                              </span>
                              {evt.location && (
                                <span className="flex items-center gap-0.5">
                                  <MapPin size={12} className="text-gray-400" />
                                  {evt.location}
                                </span>
                              )}
                              {evt.branch && evt.branch !== '全部分校' && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-bold text-[10px]">
                                  {evt.branch}
                                </span>
                              )}
                              {evt.courseName && evt.courseName !== '全部課程' && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                                  {evt.courseName}
                                </span>
                              )}
                            </div>

                            {evt.description && (
                              <p className="text-[11px] text-gray-600 leading-relaxed bg-gray-50/80 p-2 rounded-xl border border-gray-100">
                                {evt.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 右側操作按鈕 */}
                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleOpenEditForm(evt)}
                              className="px-2.5 py-1 text-xs border border-gray-200 text-gray-700 hover:text-indigo-600 rounded-lg hover:bg-gray-50 font-bold flex items-center gap-1 transition-colors"
                            >
                              <Edit2 size={12} />
                              <span>編輯</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(evt)}
                              className="px-2.5 py-1 text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-bold flex items-center gap-1 transition-colors"
                            >
                              <Trash2 size={12} />
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

        {/* 4. 底部完成關閉按鈕 */}
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-xs transition-colors"
          >
            完成並關閉
          </button>
        </div>

        {/* ============================================================ */}
        {/* 5. 新增 / 編輯日程表單 Modal */}
        {/* ============================================================ */}
        {showFormModal && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] border border-gray-100 animate-in zoom-in-95">
              
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-xl shadow-xs">
                    <CalendarIcon size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900">
                      {editingEvent ? '編輯行事曆日程' : '新增行事曆日程'}
                    </h3>
                    <p className="text-[11px] text-gray-500">向全校、特定分校或指定課程發布日程</p>
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
                
                {/* 標題 */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    日程標題 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="例：全校開學典禮、奧數初階期中評估、中秋節放假..."
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none focus:border-purple-600 shadow-2xs"
                  />
                </div>

                {/* 類型選擇 */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    事件類型 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(EVENT_TYPE_CONFIG) as CalendarEventType[]).map((t) => {
                      const cfg = EVENT_TYPE_CONFIG[t];
                      const isSel = formEventType === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFormEventType(t)}
                          className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            isSel
                              ? `${cfg.bgLight} ${cfg.color} ${cfg.border} ring-2 ring-[#FF6B57]/30 shadow-2xs`
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>{cfg.emoji}</span>
                          <span>{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 日期與時間設定 */}
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800">日期與時間</span>
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsAllDay}
                        onChange={(e) => setFormIsAllDay(e.target.checked)}
                        className="rounded text-[#FF6B57] focus:ring-[#FF6B57]"
                      />
                      <span>全天事件</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-gray-500 font-semibold block mb-0.5">開始日期</span>
                      <input
                        type="date"
                        required
                        value={formStartDate}
                        onChange={(e) => {
                          setFormStartDate(e.target.value);
                          if (formEndDate < e.target.value) setFormEndDate(e.target.value);
                        }}
                        className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 font-bold outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-semibold block mb-0.5">結束日期</span>
                      <input
                        type="date"
                        required
                        value={formEndDate}
                        min={formStartDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 font-bold outline-none"
                      />
                    </div>
                  </div>

                  {!formIsAllDay && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-200">
                      <div>
                        <span className="text-[10px] text-gray-500 font-semibold block mb-0.5">開始時間</span>
                        <input
                          type="time"
                          value={formStartTime}
                          onChange={(e) => setFormStartTime(e.target.value)}
                          className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 font-bold outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-semibold block mb-0.5">結束時間</span>
                        <input
                          type="time"
                          value={formEndTime}
                          onChange={(e) => setFormEndTime(e.target.value)}
                          className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 font-bold outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 範圍指派 (分校、課程、班別) */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">適用分校</label>
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
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">關聯課程</label>
                    <select
                      value={formCourse}
                      onChange={(e) => setFormCourse(e.target.value)}
                      className="w-full p-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none truncate"
                    >
                      <option value="全部課程">全部課程</option>
                      {courseNames.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">適用班別</label>
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

                {/* 地點 */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">活動地點 (選填)</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="例：學校禮堂、302 課室、Zoom 視像會議室..."
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none focus:border-purple-600 shadow-2xs"
                  />
                </div>

                {/* 詳細說明 */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">日程備註與細節 (選填)</label>
                  <textarea
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="輸入相關注意事項、活動攜帶物品或備註說明..."
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none focus:border-purple-600 shadow-2xs resize-none"
                  />
                </div>

                {/* 目標身分受眾 */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">可見身分對象</label>
                  <select
                    value={formTargetRole}
                    onChange={(e: any) => setFormTargetRole(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 font-bold outline-none"
                  >
                    <option value="all">全員可見（教職員、學生與家長）</option>
                    <option value="staff_only">僅教職員可見（導師、助教、管理員）</option>
                    <option value="student_parent_only">僅學生與家長可見</option>
                  </select>
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
                    className="px-5 py-2 bg-gradient-to-r from-[#FF6B57] to-[#FF8573] text-white rounded-xl text-xs font-bold hover:opacity-95 shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {formSubmitting ? '儲存中...' : editingEvent ? '儲存修改' : '確認發布日程'}
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
