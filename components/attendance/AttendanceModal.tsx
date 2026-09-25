import React, { useState, useEffect, useMemo } from 'react';
import { X, UserCheck, CheckCircle2, Save, Cloud, Loader2, Calendar, MapPin, GraduationCap } from 'lucide-react';
import { AttendanceRow, StudentAttendance, AttendanceStatus } from './AttendanceRow';
import { CourseItem, getCourseDisplayName } from '../homework/HomeworkSetupModal';
import { databases, DATABASE_ID } from '@/lib/appwrite';
import { ID, Query } from 'appwrite';

interface AttendanceModalProps {
  isOpen?: boolean;
  isInline?: boolean; // ⭐ 支援滿板顯示 (非浮動彈窗)
  onClose?: () => void;
  branches?: string[];
  classes?: string[];
  courses?: string[];
  courseItems?: (string | CourseItem)[];
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen = true,
  isInline = false,
  onClose,
  branches = [],
  classes = [],
  courses = [],
  courseItems = [],
}) => {
  // ⭐ 需求：課程點名不需篩選班別，不需日子篩選；初始未選時為空
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  // 點名日期預設為今天
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleResetAndClose = () => {
    setSelectedBranch('');
    setSelectedCourse('');
    setStudents([]);
    setSaving(false);
    if (onClose) onClose();
  };

  const prevOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (prevOpenRef.current && !isOpen) {
      setSelectedBranch('');
      setSelectedCourse('');
      setStudents([]);
      setSaving(false);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  // ⭐ 課程選擇因揀選學校而變更，未選學校時為空
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

  // 取得目前課程排定的堂數日程 (若有的話供老師切換節數)
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

  // 當打開時重置選取狀態
  useEffect(() => {
    if (isOpen) {
      setSelectedBranch('');
      setSelectedCourse('');
      setStudents([]);
    }
  }, [isOpen]);

  // ⭐ 需求：當選擇分校與課程後即顯示該課程之所有學生 (不需篩選班別)
  useEffect(() => {
    if (!isOpen) return;

    if (!selectedBranch || !selectedCourse) {
      setStudents([]);
      return;
    }

    const fetchStudentsForAttendance = async () => {
      setLoading(true);
      const cacheKey = `oc_att_${selectedBranch}_${selectedCourse}_${date}`;

      // 1. 若已有儲存過的點名快取，優先載入已記錄狀態
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          setStudents(JSON.parse(cached));
          setLoading(false);
          return;
        } catch (e) {}
      }

      // 2. 從 Appwrite students 資料表讀取學生名冊 (依分校與課程過濾，不限班別)
      try {
        const res = await databases.listDocuments(
          DATABASE_ID,
          'students',
          [Query.limit(500)]
        );

        const matched = (res.documents as any[]).filter((doc) => {
          const matchBranch = !doc.branch || doc.branch === selectedBranch;
          const docCourse = (doc.course_name || '').trim();
          const matchCourse = docCourse && (
            selectedCourse === docCourse ||
            selectedCourse.startsWith(docCourse) ||
            docCourse.startsWith(selectedCourse)
          );
          return matchBranch && matchCourse;
        });

        const uniqueNames = new Set<string>();
        const studentList: StudentAttendance[] = [];
        matched.forEach((doc, idx) => {
          if (doc.student_name && !uniqueNames.has(doc.student_name)) {
            uniqueNames.add(doc.student_name);
            studentList.push({
              id: doc.$id || `stu_${idx}`,
              name: doc.student_name,
              // ⭐ 需求：會員名字下改為班別
              className: doc.class_name ? (doc.class_name.endsWith('班') ? doc.class_name : `${doc.class_name} 班`) : '未設定班別',
              status: 'unmarked',
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
  }, [selectedBranch, selectedCourse, date, isOpen]);

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
    const cacheKey = `oc_att_${selectedBranch}_${selectedCourse}_${date}`;

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
          class_name: s.className || '',
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
    if (onClose) onClose();
  };

  const presentCount = students.filter((s) => s.status === 'present').length;
  const absentCount = students.filter((s) => s.status === 'absent').length;
  const lateCount = students.filter((s) => s.status === 'late').length;
  const excusedCount = students.filter((s) => s.status === 'excused').length;
  const unmarkedCount = students.filter((s) => s.status === 'unmarked' || !s.status).length;
  const totalCount = students.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className={isInline ? "w-full flex-1 flex flex-col bg-[#F8F9FA] overflow-hidden" : "fixed inset-0 bg-black/50 z-30 flex items-end justify-center"}>
      <div className={isInline ? "w-full flex-1 flex flex-col overflow-hidden bg-[#F8F9FA]" : "bg-[#F8F9FA] w-full max-w-md rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl"}>
        {/* 頂部標題列 */}
        <div className={`bg-white px-5 py-3.5 border-b border-gray-100 flex justify-between items-center shrink-0 ${isInline ? '' : 'rounded-t-2xl'}`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-50 text-[#FF6B57] rounded-lg">
              <UserCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-gray-800 text-lg">課程點名</h3>
                <span title="雲端連線">
                  <Cloud size={14} className="text-blue-500" />
                </span>
              </div>
              <p className="text-xs text-gray-400">課程專屬即時點名與出席統計</p>
            </div>
          </div>
          {onClose && !isInline && (
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          )}
        </div>

        {/* 篩選控制器：⭐ 需求：不需篩選班別、不需日子篩選 */}
        <div className="bg-white px-4 py-2.5 border-b border-gray-100 space-y-2 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* 學校選擇 */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                <MapPin size={12} className="text-purple-600" />
                <span>學校 / 分校</span>
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  setSelectedCourse('');
                }}
                className="w-full bg-purple-50 text-purple-700 font-semibold text-xs px-2.5 py-2 rounded-xl border border-purple-100 outline-none truncate"
              >
                <option value="" disabled>請選擇學校/分校...</option>
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* 課程選擇 (不需班別，直接依學校選課) */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                <GraduationCap size={12} className="text-indigo-600" />
                <span>課程名稱</span>
              </label>
              <select
                value={selectedCourse}
                disabled={!selectedBranch}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full bg-indigo-50 text-indigo-700 font-semibold text-xs px-2.5 py-2 rounded-xl border border-indigo-100 outline-none disabled:opacity-50 truncate"
              >
                <option value="" disabled>
                  {!selectedBranch
                    ? '請先選擇學校/分校'
                    : filteredCourses.length === 0
                    ? '此學校暫無相關課程'
                    : '請選擇點名課程...'}
                </option>
                {filteredCourses.map((cr, idx) => (
                  <option key={`${cr}_${idx}`} value={cr}>{cr}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 堂數快捷選擇 (若課程有排定日程) 與 全體出席按鈕 */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
            {currentCourseSessionDates.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto pb-0.5">
                <span className="text-[11px] text-gray-500 font-bold shrink-0">堂數：</span>
                <div className="flex items-center gap-1">
                  {currentCourseSessionDates.map((d, sIdx) => {
                    const isCurrent = date === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDate(d)}
                        className={`px-2 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                          isCurrent
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        }`}
                      >
                        第 {sIdx + 1} 節
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-gray-500 font-medium">
                點名進度：即時連線
              </div>
            )}

            <button
              onClick={handleMarkAllPresent}
              disabled={students.length === 0}
              className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 hover:bg-emerald-100 transition-colors disabled:opacity-50 shrink-0 ml-auto"
            >
              <CheckCircle2 size={13} /> 全體出席
            </button>
          </div>
        </div>

        {/* 即時統計數據面板 */}
        <div className="bg-white px-4 py-2 border-b border-gray-100 flex justify-around text-center text-xs shrink-0">
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

        {/* 學生點名清單 (名字下顯示所屬班別) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-xs">載入學生名冊中...</div>
          ) : (!selectedBranch || !selectedCourse) ? (
            <div className="text-center py-12 text-gray-400 text-xs flex flex-col items-center gap-2 bg-white rounded-2xl border border-dashed border-gray-200 p-6">
              <UserCheck size={34} className="text-indigo-400 animate-pulse" />
              <p className="font-bold text-gray-700 text-sm">請選取學校及課程</p>
              <p className="text-[11px] text-gray-400 leading-relaxed max-w-[260px]">
                選定學校並指定課程後，系統將自動列出該課程的所有學生會員名單與所屬班別
              </p>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs flex flex-col items-center gap-2 bg-white rounded-2xl border border-dashed border-gray-200 p-6">
              <UserCheck size={32} className="text-gray-300" />
              <p className="font-semibold text-gray-600">此課程暫無學生登記</p>
              <p className="text-[10px] text-gray-400">
                可至底部「會員」目錄為學生登記此課程
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
        <div className="p-3 bg-white border-t border-gray-100 flex gap-2 shrink-0">
          {!isInline && onClose && (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium text-xs hover:bg-gray-50"
            >
              取消
            </button>
          )}
          <button
            onClick={handleSaveAttendance}
            disabled={saving || students.length === 0}
            className={`${!isInline && onClose ? 'flex-2' : 'w-full'} py-2.5 bg-[#FF6B57] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#e05a48] shadow-sm disabled:opacity-60`}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{saving ? '正在儲存點名記錄...' : '提交並保存點名記錄'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
