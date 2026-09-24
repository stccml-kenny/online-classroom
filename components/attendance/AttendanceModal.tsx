import React, { useState, useEffect, useMemo } from 'react';
import { X, UserCheck, Calendar, CheckCircle2, Save, Cloud, Loader2, ChevronLeft, ChevronRight, MapPin, GraduationCap } from 'lucide-react';
import { AttendanceRow, StudentAttendance, AttendanceStatus } from './AttendanceRow';
import { CourseItem, getCourseDisplayName } from '../homework/HomeworkSetupModal';
import { databases, DATABASE_ID } from '@/lib/appwrite';
import { ID, Query } from 'appwrite';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches?: string[];
  classes?: string[];
  courses?: string[];
  courseItems?: (string | CourseItem)[];
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen,
  onClose,
  branches = [],
  classes = [],
  courses = [],
  courseItems = [],
}) => {
  // ⭐ 需求 2：不要預選學校、班別、課程，初始皆為空
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleResetAndClose = () => {
    setSelectedBranch('');
    setSelectedClass('');
    setSelectedCourse('');
    setStudents([]);
    setSessionPage(0);
    setSaving(false);
    onClose();
  };

  const prevOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (prevOpenRef.current && !isOpen) {
      setSelectedBranch('');
      setSelectedClass('');
      setSelectedCourse('');
      setStudents([]);
      setSessionPage(0);
      setSaving(false);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);


  // ⭐ 需求 1 & 2：課程選擇因揀選學校而變更，未選學校時為空，不提供「全部課程」
  const filteredCourseItems = useMemo(() => {
    if (!selectedBranch) return [];
    return courseItems.filter((c) => {
      if (typeof c === 'string') return true;
      return !c.branch || c.branch === '全部分校' || c.branch === selectedBranch;
    });
  }, [courseItems, selectedBranch]);

  const filteredCourses = useMemo(() => {
    const list = filteredCourseItems.map((c) => getCourseDisplayName(c));
    return Array.from(new Set(list)).filter(Boolean);
  }, [filteredCourseItems]);

  // 當選擇的學校變更時，若選取的課程不匹配該校，重設課程為空
  useEffect(() => {
    if (selectedCourse && !filteredCourses.includes(selectedCourse)) {
      setSelectedCourse('');
    }
  }, [selectedBranch, filteredCourses, selectedCourse]);

  // ⭐ 需求 3：排定堂數 4 節為一行，如多於 4 節以下頁分頁顯示
  const [sessionPage, setSessionPage] = useState(0);
  const SESSIONS_PER_PAGE = 4;

  const currentCourseSessionDates = useMemo(() => {
    const matched = courseItems.find((c) => {
      if (typeof c === 'string') return c === selectedCourse;
      const displayName = getCourseDisplayName(c);
      return c.name === selectedCourse || displayName === selectedCourse;
    });
    return (matched && typeof matched !== 'string' && Array.isArray(matched.sessionDates))
      ? matched.sessionDates
      : [];
  }, [courseItems, selectedCourse]);

  const totalSessionPages = Math.ceil(currentCourseSessionDates.length / SESSIONS_PER_PAGE);
  const displayedSessions = currentCourseSessionDates.slice(
    sessionPage * SESSIONS_PER_PAGE,
    (sessionPage + 1) * SESSIONS_PER_PAGE
  );

  useEffect(() => {
    setSessionPage(0);
  }, [selectedCourse]);

  // 當彈窗打開時，重置所有選取狀態，不預選任何學校、班別、課程
  useEffect(() => {
    if (isOpen) {
      setSelectedBranch('');
      setSelectedClass('');
      setSelectedCourse('');
      setStudents([]);
    }
  }, [isOpen]);

  // ⭐ 需求 3：當選擇分校、班別及課程後才顯示相對的會員 (未選齊前不顯示學生名冊)
  useEffect(() => {
    if (!isOpen) return;

    if (!selectedBranch || !selectedClass || !selectedCourse) {
      setStudents([]);
      return;
    }

    const fetchStudentsForAttendance = async () => {
      setLoading(true);
      const cacheKey = `oc_att_${selectedBranch}_${selectedClass}_${selectedCourse}_${date}`;

      // 1. 若當天已有儲存過的點名快取，優先載入已記錄狀態
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          setStudents(JSON.parse(cached));
          setLoading(false);
          return;
        } catch (e) {}
      }

      // 2. 從 Appwrite students 資料表讀取學生名冊
      try {
        const cleanClass = selectedClass === '全部班別' ? '' : selectedClass.replace(' 班', '').trim();
        const res = await databases.listDocuments(
          DATABASE_ID,
          'students',
          [Query.limit(500)]
        );

        const matched = (res.documents as any[]).filter((doc) => {
          const matchBranch = !doc.branch || doc.branch === selectedBranch;
          const matchClass = !cleanClass || doc.class_name?.includes(cleanClass) || cleanClass.includes(doc.class_name);
          const docCourse = (doc.course_name || '').trim();
          const matchCourse = docCourse && (
            selectedCourse === docCourse ||
            selectedCourse.startsWith(docCourse) ||
            docCourse.startsWith(selectedCourse)
          );
          return matchBranch && matchClass && matchCourse;
        });

        const uniqueNames = new Set<string>();
        const studentList: StudentAttendance[] = [];
        matched.forEach((doc, idx) => {
          if (doc.student_name && !uniqueNames.has(doc.student_name)) {
            uniqueNames.add(doc.student_name);
            studentList.push({
              id: doc.$id || `stu_${idx}`,
              name: doc.student_name,
              studentNo: String(studentList.length + 1).padStart(2, '0'),
              status: 'unmarked', // ⭐ 學生不要預設出席，初始為未點名
            });
          }
        });

        setStudents(studentList);
      } catch (err: any) {
        console.warn('讀取學生名冊略過或離線中:', err.message);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentsForAttendance();
  }, [selectedBranch, selectedClass, selectedCourse, date, isOpen]);

  if (!isOpen) return null;

  const handleStatusChange = (id: string, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
  };

  const handleMarkAllPresent = () => {
    setStudents((prev) => prev.map((s) => ({ ...s, status: 'present' })));
  };

  const handleSaveAttendance = async () => {
    if (students.length === 0) {
      alert('目前名冊尚無學生可儲存點名！');
      return;
    }
    setSaving(true);
    const cacheKey = `oc_att_${selectedBranch}_${selectedClass}_${selectedCourse}_${date}`;

    try {
      localStorage.setItem(cacheKey, JSON.stringify(students));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    let cloudSaved = false;
    try {
      const promises = students.map(async (s) => {
        const payload: any = {
          branch: selectedBranch,
          class_name: selectedClass,
          student_name: s.name,
          date,
          status: s.status,
        };
        try {
          return await databases.createDocument(DATABASE_ID, 'attendance', ID.unique(), payload);
        } catch (firstErr: any) {
          if (
            firstErr.message?.includes('status') ||
            firstErr.message?.includes('Unknown attribute') ||
            firstErr.code === 400
          ) {
            delete payload.status;
            payload.student_name = `${s.name} [${s.status}]`;
            return await databases.createDocument(DATABASE_ID, 'attendance', ID.unique(), payload);
          }
          throw firstErr;
        }
      });
      await Promise.all(promises);
      cloudSaved = true;
    } catch (err: any) {
      console.warn('雲端資料庫寫入略過:', err.message);
    } finally {
      setSaving(false);
    }

    if (cloudSaved) {
      alert('✅ 點名記錄已成功儲存並同步至雲端！');
    } else {
      alert('✅ 點名記錄已成功保存於本機！');
    }
    onClose();
  };

  const presentCount = students.filter((s) => s.status === 'present').length;
  const absentCount = students.filter((s) => s.status === 'absent').length;
  const lateCount = students.filter((s) => s.status === 'late').length;
  const excusedCount = students.filter((s) => s.status === 'excused').length;
  const unmarkedCount = students.filter((s) => s.status === 'unmarked' || !s.status).length;
  const totalCount = students.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-30 flex items-end justify-center">
      <div className="bg-[#F8F9FA] w-full max-w-md rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* 頂部標題列 */}
        <div className="bg-white px-5 py-3.5 rounded-t-2xl border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-50 text-[#FF6B57] rounded-lg">
              <UserCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-gray-800 text-lg">活動 / 課程點名</h3>
                <span title="雲端連線">
                  <Cloud size={14} className="text-blue-500" />
                </span>
              </div>
              <p className="text-xs text-gray-400">班別與課程即時學生連線</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* 篩選控制器 */}
        <div className="bg-white px-4 py-2.5 border-b border-gray-100 space-y-2">
          {/* ⭐ 需求 2：不預選且不含「全部分校 / 全部班別 / 全部課程」 */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setSelectedCourse('');
              }}
              className="bg-purple-50 text-purple-700 font-semibold text-xs px-2.5 py-2 rounded-xl border-none outline-none truncate"
            >
              <option value="" disabled>請選擇學校/分校...</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-purple-50/70 text-purple-700 font-semibold text-xs px-2.5 py-2 rounded-xl border-none outline-none truncate"
            >
              <option value="" disabled>請選擇班別...</option>
              {classes.map((c) => (
                <option key={c} value={c}>{c.endsWith('班') ? c : `${c} 班`}</option>
              ))}
            </select>
          </div>

          {/* ⭐ 課程選擇獨立一行滿寬，需先選學校才能選課程 */}
          <div>
            <select
              value={selectedCourse}
              disabled={!selectedBranch}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full bg-indigo-50 text-indigo-700 font-semibold text-xs px-3 py-2 rounded-xl border border-indigo-100 outline-none disabled:opacity-50"
            >
              <option value="" disabled>
                {!selectedBranch ? '請先選擇學校/分校' : '請選擇課程...'}
              </option>
              {filteredCourses.map((cr, idx) => (
                <option key={`${cr}_${idx}`} value={cr}>{cr}</option>
              ))}
            </select>
          </div>

          {/* ⭐ 需求 3：排定堂數 4 節為一行，多於 4 節以下頁/上頁分頁切換 */}
          {currentCourseSessionDates.length > 0 && (
            <div className="pt-1 border-t border-gray-100 space-y-1.5">
              <div className="flex justify-between items-center text-[11px] text-gray-500 font-semibold px-0.5">
                <span className="flex items-center gap-1 text-indigo-950 font-bold">
                  <Calendar size={12} className="text-indigo-600" />
                  <span>排定堂數 (共 {currentCourseSessionDates.length} 節)：</span>
                </span>
                {totalSessionPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={sessionPage === 0}
                      onClick={() => setSessionPage((prev) => Math.max(0, prev - 1))}
                      className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30 text-[10px] font-bold transition-colors"
                    >
                      ◀ 上頁
                    </button>
                    <span className="text-[10px] text-indigo-600 font-bold px-1">
                      {sessionPage + 1}/{totalSessionPages}
                    </span>
                    <button
                      type="button"
                      disabled={sessionPage >= totalSessionPages - 1}
                      onClick={() => setSessionPage((prev) => Math.min(totalSessionPages - 1, prev + 1))}
                      className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30 text-[10px] font-bold transition-colors"
                    >
                      下頁 ▶
                    </button>
                  </div>
                )}
              </div>

              {/* 4 節為一行 (grid-cols-4) */}
              <div className="grid grid-cols-4 gap-1.5">
                {displayedSessions.map((d, localIdx) => {
                  const globalIdx = sessionPage * SESSIONS_PER_PAGE + localIdx;
                  const isCurrent = date === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDate(d)}
                      className={`py-1.5 px-1 rounded-xl text-center flex flex-col items-center justify-center border transition-all shadow-2xs ${
                        isCurrent
                          ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-600/20'
                          : 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border-indigo-100'
                      }`}
                    >
                      <span className="text-[11px] font-bold leading-tight">第 {globalIdx + 1} 節</span>
                      <span className="text-[9px] opacity-80 mt-0.5">({d.slice(5)})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 日期選擇與全體出席 */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-200">
              <Calendar size={13} className="text-[#FF6B57]" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-xs outline-none"
              />
            </div>
            <button
              onClick={handleMarkAllPresent}
              disabled={students.length === 0}
              className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 size={13} /> 全體出席
            </button>
          </div>
        </div>

        {/* 即時統計數據面板 */}
        <div className="bg-white px-4 py-2.5 border-b border-gray-100 flex justify-around text-center text-xs">
          <div>
            <div className="font-bold text-gray-800 text-sm">{totalCount} 人</div>
            <div className="text-[10px] text-gray-400">總人數</div>
          </div>
          <div>
            <div className="font-bold text-emerald-600 text-sm">{presentCount} 人</div>
            <div className="text-[10px] text-gray-400">實到</div>
          </div>
          <div>
            <div className="font-bold text-rose-500 text-sm">{absentCount} 人</div>
            <div className="text-[10px] text-gray-400">缺席</div>
          </div>
          <div>
            <div className="font-bold text-amber-500 text-sm">{lateCount} 人</div>
            <div className="text-[10px] text-gray-400">遲到</div>
          </div>
          <div>
            <div className="font-bold text-blue-500 text-sm">{excusedCount} 人</div>
            <div className="text-[10px] text-gray-400">請假</div>
          </div>
          {unmarkedCount > 0 && (
            <div>
              <div className="font-bold text-purple-600 text-sm">{unmarkedCount} 人</div>
              <div className="text-[10px] text-purple-400">待點名</div>
            </div>
          )}
          <div>
            <div className="font-bold text-[#FF6B57] text-sm">{attendanceRate}%</div>
            <div className="text-[10px] text-gray-400">出席率</div>
          </div>
        </div>

        {/* 學生點名清單 (學生不預設出席，真實呈現) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-xs">載入學生名冊中...</div>
          ) : (!selectedBranch || !selectedClass || !selectedCourse) ? (
            <div className="text-center py-12 text-gray-400 text-xs flex flex-col items-center gap-2 bg-white rounded-2xl border border-dashed border-gray-200 p-6">
              <UserCheck size={34} className="text-indigo-400 animate-pulse" />
              <p className="font-bold text-gray-700 text-sm">請依序選取學校、班別及課程</p>
              <p className="text-[11px] text-gray-400 leading-relaxed max-w-[260px]">
                請在上方選定學校、班別並指定點名課程，系統將自動載入該堂課的學生會員名單
              </p>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs flex flex-col items-center gap-2 bg-white rounded-2xl border border-dashed border-gray-200 p-6">
              <UserCheck size={32} className="text-gray-300" />
              <p className="font-semibold text-gray-600">此分校、班別與課程暫無學生登記</p>
              <p className="text-[10px] text-gray-400">
                請至「會員目錄」確認學生已登記於該分校、班別及課程
              </p>
            </div>
          ) : (
            students.map((student) => (
              <AttendanceRow
                key={student.id}
                student={student}
                onStatusChange={handleStatusChange}
              />
            ))
          )}
        </div>

        {/* 底部確認儲存 */}
        <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium text-xs hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSaveAttendance}
            disabled={saving || students.length === 0}
            className="flex-2 py-2.5 bg-[#FF6B57] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#e05a48] shadow-sm disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{saving ? '正在儲存點名記錄...' : '提交並保存點名記錄'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
