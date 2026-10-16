'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronRight,
  MessageCircle,
  TrendingUp,
  Clock,
  RotateCcw,
  CheckCircle2,
  X,
  AlertCircle,
  Sparkles,
  BookOpen,
  Award,
  FileText,
  User,
  MapPin,
  Smile
} from 'lucide-react';
import { UserProfile } from '@/components/auth/AuthModal';
import { TabType } from '@/components/layout/BottomNav';
import { CalendarEvent } from '@/types/calendar';
import { CourseItem } from '@/components/homework/HomeworkSetupModal';
import { StudentEvaluation, loadStudentEvaluationsFromCloud } from '@/lib/appwrite';
import { chatService } from '@/lib/chatService';

export interface LeaveApplication {
  id: string;
  studentName: string;
  studentUsername: string;
  className: string;
  branch: string;
  courseName: string;
  date: string;
  coach: string;
  reason: string;
  remarks: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface StudentHomeViewProps {
  currentUser: UserProfile | null;
  onNavigateTab: (tab: TabType) => void;
  onOpenNotices: () => void;
  onOpenCalendar?: () => void;
  onOpenStudentHomework?: () => void;
  courses?: (string | CourseItem)[];
  calendarEvents?: CalendarEvent[];
  noticeCount?: number;
}

export const StudentHomeView: React.FC<StudentHomeViewProps> = ({
  currentUser,
  onNavigateTab,
  onOpenNotices,
  onOpenCalendar,
  onOpenStudentHomework,
  courses = [],
  calendarEvents = [],
  noticeCount = 0,
}) => {
  // 學員真實姓名與學號 (由當前登入帳戶提供)
  const studentName = currentUser?.name || currentUser?.studentName || currentUser?.childName || '學員';
  const studentId = currentUser?.username ? currentUser.username.toUpperCase() : '';
  const branchName = currentUser?.branch || '總校';

  // 今天與 14 天後之日期字串 (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayPlus14Str = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  }, []);

  // 星期轉換輔助函數
  const getWeekdayName = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()] || '日';
      }
    } catch {}
    return '日';
  };

  const getDayAndMonth = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return {
          day: parseInt(parts[2]).toString(),
          month: `${parseInt(parts[1])} 月`,
        };
      }
    } catch {}
    return { day: '1', month: '1 月' };
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch {}
    return dateStr;
  };

  // ⭐ 1. 解析學員真實所屬的全部課堂節次 (由真實 courses 與 calendarEvents 動態產出)
  const allStudentSessions = useMemo(() => {
    const list: {
      date: string;
      time: string;
      course: string;
      branch: string;
      coach: string;
    }[] = [];

    // 來源 A：從學員真實 enrolledCourses / visibleCourses 中的 sessionDates 提取
    courses.forEach((c) => {
      const cObj = typeof c === 'string' ? null : c;
      const cName = typeof c === 'string' ? c : c.name;
      const cBranch = (cObj && cObj.branch) ? cObj.branch : branchName;
      const cTime = (cObj && cObj.timeSlot) ? cObj.timeSlot : '15:00';
      const cCoach = (cObj && (cObj as any).teacher) ? (cObj as any).teacher : '導師';

      if (cObj && Array.isArray(cObj.sessionDates)) {
        cObj.sessionDates.forEach((d) => {
          if (d && typeof d === 'string') {
            const cleanD = d.trim();
            if (cleanD) {
              list.push({
                date: cleanD,
                time: cTime,
                course: cName,
                branch: cBranch,
                coach: cCoach,
              });
            }
          }
        });
      }
    });

    // 來源 B：從真實 calendarEvents 提取學員所屬的課堂事件
    calendarEvents.forEach((e) => {
      if (e.eventType === 'homework') return;
      const eDate = e.startDate ? e.startDate.split('T')[0] : '';
      if (!eDate) return;

      const eCourse = e.courseName || e.title || '';
      // 檢查是否符合學員課程或分校
      const isMatch = courses.length === 0 || courses.some((c) => {
        const cName = typeof c === 'string' ? c : c.name;
        return eCourse.includes(cName) || cName.includes(eCourse);
      });

      if (isMatch) {
        const eTime = e.timeSlot || (e.startDate.includes('T') ? e.startDate.split('T')[1].slice(0, 5) : '15:00');
        const already = list.some((item) => item.date === eDate && item.course === eCourse);
        if (!already) {
          list.push({
            date: eDate,
            time: eTime,
            course: eCourse,
            branch: e.branch || branchName,
            coach: e.creatorName || '導師',
          });
        }
      }
    });

    // 依日期與時間排序 (由近至遠)
    list.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.time.localeCompare(b.time);
    });

    return list;
  }, [courses, calendarEvents, branchName]);

  // ⭐ 下一堂：從真實節次中找出大於等於今天的第一節課
  const nextSession = useMemo(() => {
    return allStudentSessions.find((s) => s.date >= todayStr) || null;
  }, [allStudentSessions, todayStr]);

  // ⭐ 未來 14 日課堂：大於等於今天且在 14 天內的節次
  const upcoming14Sessions = useMemo(() => {
    return allStudentSessions.filter((s) => s.date >= todayStr && s.date <= todayPlus14Str);
  }, [allStudentSessions, todayStr, todayPlus14Str]);

  // ⭐ 2. 解析學員真實報讀課程卡片 (不使用任何寫死樣板)
  const realCourseCards = useMemo(() => {
    return courses.map((c) => {
      const cObj = typeof c === 'string' ? null : c;
      const cName = typeof c === 'string' ? c : c.name;
      const cBranch = (cObj && cObj.branch) ? cObj.branch : branchName;
      const sessionDates = (cObj && Array.isArray(cObj.sessionDates)) ? cObj.sessionDates : [];

      // 總堂數：取 totalSessions 或 sessionDates.length，預設 1
      const totalSessions = (cObj && cObj.totalSessions && cObj.totalSessions > 0)
        ? cObj.totalSessions
        : (sessionDates.length > 0 ? sessionDates.length : 1);

      // 已上/已過期堂數：sessionDates 中小於等於今天的堂數
      const completedSessions = sessionDates.filter((d) => d <= todayStr).length;

      // 有效期至：若有 sessionDates 則取最後一節課；或 scheduleRule.endDate
      let endDateStr = '';
      if (sessionDates.length > 0) {
        const sorted = [...sessionDates].sort();
        endDateStr = formatDateDisplay(sorted[sorted.length - 1]);
      } else if (cObj?.scheduleRule?.endDate) {
        endDateStr = formatDateDisplay(cObj.scheduleRule.endDate);
      }

      return {
        name: cName,
        branch: cBranch,
        totalSessions,
        completedSessions,
        endDate: endDateStr,
      };
    });
  }, [courses, branchName, todayStr]);

  // 彈窗狀態
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedSessionForLeave, setSelectedSessionForLeave] = useState<{
    date: string;
    course: string;
    branch: string;
    coach: string;
  } | null>(null);

  const [showMakeupModal, setShowMakeupModal] = useState(false);
  const [showGrowthReportModal, setShowGrowthReportModal] = useState(false);
  const [realEvaluation, setRealEvaluation] = useState<StudentEvaluation | null>(null);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);

  const handleOpenGrowthReport = async () => {
    setShowGrowthReportModal(true);
    setLoadingEvaluation(true);
    try {
      const allEvals = await loadStudentEvaluationsFromCloud();
      const myEval = allEvals.find(
        (ev) =>
          ev.studentName === studentName ||
          (studentId && ev.studentUsername && ev.studentUsername.toUpperCase() === studentId)
      );
      setRealEvaluation(myEval || null);
    } catch {
      setRealEvaluation(null);
    } finally {
      setLoadingEvaluation(false);
    }
  };
  const [leaveSuccessToast, setLeaveSuccessToast] = useState<string | null>(null);

  // 近期請假紀錄清單
  const [myLeaves, setMyLeaves] = useState<LeaveApplication[]>([]);
  const loadMyLeaves = React.useCallback(() => {
    try {
      const raw = localStorage.getItem('oc_leave_applications');
      if (raw) {
        const all: LeaveApplication[] = JSON.parse(raw);
        const filtered = all.filter(
          (lv) =>
            lv.studentName === studentName ||
            (currentUser?.username && lv.studentUsername === currentUser.username)
        );
        setMyLeaves(filtered);
      }
    } catch {}
  }, [studentName, currentUser?.username]);

  React.useEffect(() => {
    loadMyLeaves();
  }, [loadMyLeaves]);

  // 請假表單狀態
  const [leaveReason, setLeaveReason] = useState('事假');
  const [leaveRemarks, setLeaveRemarks] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // 點擊「請假」按鈕
  const handleOpenLeave = (session: { date: string; course: string; branch: string; coach: string }) => {
    setSelectedSessionForLeave(session);
    setLeaveReason('事假');
    setLeaveRemarks('');
    setShowLeaveModal(true);
  };

  // 確認提交請假申請 (自動化：保存請假記錄 + 預先連動點名簿 + 自動向導師/職員發送請假即時訊息)
  const handleSubmitLeave = async () => {
    if (!selectedSessionForLeave || !currentUser) return;
    setIsSubmittingLeave(true);

    const leaveRecord: LeaveApplication = {
      id: `leave_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      studentName,
      studentUsername: currentUser.username || studentId,
      className: currentUser.className || '',
      branch: selectedSessionForLeave.branch || currentUser.branch || '總校',
      courseName: selectedSessionForLeave.course,
      date: selectedSessionForLeave.date,
      coach: selectedSessionForLeave.coach || '負責導師',
      reason: leaveReason,
      remarks: leaveRemarks.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    // 1. 本地保存請假申請清單
    try {
      const raw = localStorage.getItem('oc_leave_applications');
      const list: LeaveApplication[] = raw ? JSON.parse(raw) : [];
      list.unshift(leaveRecord);
      localStorage.setItem('oc_leave_applications', JSON.stringify(list));
      setMyLeaves((prev) => [leaveRecord, ...prev]);
    } catch (e) {}

    // 2. 自動預先連動點名簿 (標記為請假)
    try {
      const attKey = `oc_att_${selectedSessionForLeave.branch}_${selectedSessionForLeave.course}_${selectedSessionForLeave.date}`;
      const rawAtt = localStorage.getItem(attKey);
      let attList = rawAtt ? JSON.parse(rawAtt) : [];
      if (Array.isArray(attList) && attList.length > 0) {
        let found = false;
        attList = attList.map((st: any) => {
          if (st.name === studentName) {
            found = true;
            return { ...st, status: 'excused', leaveReason: leaveReason };
          }
          return st;
        });
        if (!found) {
          attList.push({
            id: `stu_excused_${Date.now()}`,
            name: studentName,
            className: currentUser.className || '常規班',
            status: 'excused',
            leaveReason: leaveReason,
          });
        }
      } else {
        attList = [{
          id: `stu_excused_${Date.now()}`,
          name: studentName,
          className: currentUser.className || '常規班',
          status: 'excused',
          leaveReason: leaveReason,
        }];
      }
      localStorage.setItem(attKey, JSON.stringify(attList));
    } catch (e) {}

    // 3. 自動向導師/管理員發送「【請假申請】」即時訊息
    try {
      let allUsers: UserProfile[] = [];
      const rawUsers = localStorage.getItem('oc_users_list');
      if (rawUsers) {
        allUsers = JSON.parse(rawUsers);
      }
      const targetTeacher = allUsers.find(
        (u) =>
          (u.role === 'teacher' || u.role === 'assistant') &&
          ((u.name && selectedSessionForLeave.coach.includes(u.name)) ||
           (u.branch && u.branch === selectedSessionForLeave.branch))
      ) || allUsers.find((u) => u.role === 'teacher') || allUsers.find((u) => u.role === 'admin');

      if (targetTeacher) {
        const u1 = (currentUser.username || '').toLowerCase().trim();
        const u2 = (targetTeacher.username || '').toLowerCase().trim();
        const convId = [u1, u2].sort().join('__');
        const content = `【請假申請】\n學生姓名：${studentName}\n所屬班別：${currentUser.className || '常規班'} (${selectedSessionForLeave.branch || '總校'})\n課程名稱：${selectedSessionForLeave.course}\n請假日期：${selectedSessionForLeave.date}\n請假事由：${leaveReason}\n備註說明：${leaveRemarks.trim() || '無'}`;

        await chatService.sendMessage({
          conversationId: convId,
          sender: currentUser,
          receiver: {
            username: targetTeacher.username,
            name: targetTeacher.name || targetTeacher.username,
            role: targetTeacher.role,
          },
          content,
          type: 'text',
          branch: selectedSessionForLeave.branch || currentUser.branch,
          className: currentUser.className,
        });

        await chatService.upsertConversation({
          conversationId: convId,
          sender: currentUser,
          receiver: {
            username: targetTeacher.username,
            name: targetTeacher.name || targetTeacher.username,
            role: targetTeacher.role,
          },
          lastMessage: content,
          lastMessageTime: new Date().toISOString(),
          branch: selectedSessionForLeave.branch || currentUser.branch,
          className: currentUser.className,
        });
      }
    } catch (err) {
      console.warn('發送請假即時訊息略過:', err);
    }

    setIsSubmittingLeave(false);
    setShowLeaveModal(false);
    setLeaveSuccessToast(`已成功為【${selectedSessionForLeave.date}】提交請假申請！系統已自動向導師發送請假通知，並預先更新點名簿。`);
    setTimeout(() => setLeaveSuccessToast(null), 4500);
  };

  // 點擊「問教練 / 職員」
  const handleAskCoach = () => {
    onNavigateTab('msg');
  };

  // 點擊「日曆 ›」
  const handleGoCalendar = () => {
    if (onOpenCalendar) {
      onOpenCalendar();
    } else {
      onNavigateTab('calendar');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FA] pb-24 px-4 pt-3.5 space-y-4">
      {/* 浮動成功提示 */}
      {leaveSuccessToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#FF6B57] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-3 max-w-[90%] text-center">
          <CheckCircle2 size={16} className="shrink-0 text-orange-200" />
          <span>{leaveSuccessToast}</span>
        </div>
      )}

      {/* 🟢 1. 下一堂 (Next Class) 卡片 (真實排程) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-bold text-gray-800 tracking-tight">下一堂</h2>
          <button
            type="button"
            onClick={handleGoCalendar}
            className="text-xs font-semibold text-[#FF6B57] hover:text-[#E05340] flex items-center gap-0.5 transition-colors cursor-pointer"
          >
            <span>日曆</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {nextSession ? (
          <div className="bg-[#FFF5F3] border border-[#FED7D2] rounded-2xl overflow-hidden shadow-2xs">
            {/* 上半部：課堂詳情與日曆大數字標籤 */}
            <div className="p-3.5 flex items-center gap-3">
              {/* 白色日曆徽章 */}
              <div className="w-14 h-16 bg-white rounded-xl shadow-2xs border border-[#FED7D2] flex flex-col items-center justify-center shrink-0">
                <span className="text-[11px] font-semibold text-[#FF6B57] leading-none">
                  {getWeekdayName(nextSession.date)}
                </span>
                <span className="text-xl font-black text-gray-900 leading-tight my-0.5">
                  {getDayAndMonth(nextSession.date).day}
                </span>
                <span className="text-[9px] font-medium text-gray-400 leading-none">
                  {getDayAndMonth(nextSession.date).month}
                </span>
              </div>

              {/* 課堂詳細文字 */}
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-gray-900 truncate">
                  {nextSession.course}
                </h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">
                  {nextSession.time} · {nextSession.branch}
                </p>
                <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">
                  {studentName} · {nextSession.coach}
                </p>
              </div>
            </div>

            {/* 下半部：操作按鈕欄 (白色底背景 + 細線分隔) */}
            <div className="bg-white/80 border-t border-[#FED7D2] flex items-center divide-x divide-[#FED7D2]">
              <button
                type="button"
                onClick={() => handleOpenLeave({
                  date: `${formatDateDisplay(nextSession.date)}（${getWeekdayName(nextSession.date)}） ${nextSession.time}`,
                  course: nextSession.course,
                  branch: nextSession.branch,
                  coach: nextSession.coach,
                })}
                className="flex-1 py-2.5 text-center text-xs font-bold text-[#FF6B57] hover:bg-[#FFF5F3] transition-colors cursor-pointer"
              >
                請假
              </button>
              <button
                type="button"
                onClick={handleAskCoach}
                className="flex-1 py-2.5 text-center text-xs font-bold text-[#FF6B57] hover:bg-[#FFF5F3] transition-colors cursor-pointer"
              >
                問教練 / 職員
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#FFF5F3] border border-[#FED7D2] rounded-2xl p-4 text-center">
            <p className="text-xs font-bold text-gray-700">近期暫無已安排之課堂</p>
            <p className="text-[11px] text-gray-400 mt-0.5">點擊右上角「日曆」可查閱學校完整行事曆</p>
          </div>
        )}
      </section>

      {/* 🟢 2. 快捷操作按鈕區 (暫時不需報新班及付款 -> 保留「請假補堂」與「成長報告」) */}
      <section className="grid grid-cols-2 gap-3">
        {/* 請假補堂 */}
        <button
          type="button"
          onClick={() => setShowMakeupModal(true)}
          className="bg-white border border-gray-150 rounded-2xl p-3.5 shadow-2xs hover:border-[#FF6B57] hover:shadow-xs transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-[#FFF5F3] text-[#FF6B57] flex items-center justify-center group-hover:scale-105 transition-transform">
            <RotateCcw size={20} />
          </div>
          <span className="text-xs font-bold text-gray-800 group-hover:text-[#FF6B57]">
            請假補堂
          </span>
        </button>

        {/* 成長報告 */}
        <button
          type="button"
          onClick={handleOpenGrowthReport}
          className="bg-white border border-gray-150 rounded-2xl p-3.5 shadow-2xs hover:border-[#FF6B57] hover:shadow-xs transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-[#FFF5F3] text-[#FF6B57] flex items-center justify-center group-hover:scale-105 transition-transform">
            <TrendingUp size={20} />
          </div>
          <span className="text-xs font-bold text-gray-800 group-hover:text-[#FF6B57]">
            成長報告
          </span>
        </button>
      </section>

      {/* 🟢 3. 學員真實報讀課程清單 (套用學生真實課程) */}
      <section className="space-y-2.5">
        <div className="flex items-baseline gap-2 px-0.5">
          <h2 className="text-base font-black text-gray-900 tracking-tight">
            {studentName}
          </h2>
          {studentId && (
            <span className="text-xs font-medium text-gray-400">
              {studentId}
            </span>
          )}
        </div>

        {realCourseCards.length > 0 ? (
          realCourseCards.map((c, idx) => (
            <div
              key={idx}
              onClick={onOpenStudentHomework}
              className="bg-white border border-gray-150 rounded-2xl p-4 shadow-2xs flex items-center justify-between hover:border-[#FF6B57] transition-all cursor-pointer"
            >
              <div className="min-w-0 pr-2">
                <h3 className="text-sm font-bold text-gray-900 truncate">
                  {c.name}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {c.branch} {c.endDate ? `· 有效期至 ${c.endDate}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-xl font-black text-[#FF6B57]">
                    {c.completedSessions}
                  </span>
                  <span className="text-xs text-gray-400 font-bold">
                    /{c.totalSessions} 堂
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  補堂 0/0
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white border border-gray-150 rounded-2xl p-4 text-center">
            <p className="text-xs font-bold text-gray-600">目前尚未報讀課程</p>
            <p className="text-[11px] text-gray-400 mt-0.5">如需報讀或分配課程，請向學校職員查詢</p>
          </div>
        )}
      </section>

      {/* 🟢 4. 未來 14 日課堂 (真實排程) */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-gray-500 px-0.5">
          未來 14 日課堂
        </h2>

        {upcoming14Sessions.length > 0 ? (
          <div className="bg-white border border-gray-150 rounded-2xl shadow-2xs divide-y divide-gray-100 overflow-hidden">
            {upcoming14Sessions.map((session, sIdx) => (
              <div key={sIdx} className="p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">
                    {formatDateDisplay(session.date)}（{getWeekdayName(session.date)}） {session.time}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenLeave({
                      date: `${formatDateDisplay(session.date)}（${getWeekdayName(session.date)}） ${session.time}`,
                      course: session.course,
                      branch: session.branch,
                      coach: session.coach,
                    })}
                    className="px-3.5 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer"
                  >
                    請假
                  </button>
                </div>
                <p className="text-xs text-gray-500 font-medium truncate">
                  {session.course} · {session.branch} · {session.coach}
                </p>
                <button
                  type="button"
                  onClick={handleAskCoach}
                  className="text-xs font-semibold text-[#FF6B57] hover:underline pt-0.5 flex items-center gap-1 cursor-pointer"
                >
                  問教練 / 職員
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-150 rounded-2xl p-4 text-center shadow-2xs">
            <p className="text-xs font-bold text-gray-600">未來 14 日內暫無課堂安排</p>
            <p className="text-[11px] text-gray-400 mt-0.5">點擊上方「日曆」可查閱學校完整月份行事曆</p>
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════
          彈窗 1：請假申請彈窗 (Leave Modal)
      ═══════════════════════════════════════════════ */}
      {showLeaveModal && selectedSessionForLeave && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-gray-150 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B57] flex items-center justify-center">
                  <Clock size={18} />
                </div>
                <h3 className="text-base font-bold text-gray-900">課堂請假申請</h3>
              </div>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* 課堂資訊 */}
            <div className="bg-[#FFF5F3] border border-[#FED7D2] rounded-2xl p-3 space-y-1 text-xs">
              <div className="font-bold text-gray-900">{selectedSessionForLeave.course}</div>
              <div className="text-gray-600">課堂日期：{selectedSessionForLeave.date}</div>
              <div className="text-gray-600">上課分校：{selectedSessionForLeave.branch}</div>
              <div className="text-gray-600">導師/教練：{selectedSessionForLeave.coach}</div>
              <div className="text-[#FF6B57] font-semibold pt-1">學員：{studentName} {studentId ? `(${studentId})` : ''}</div>
            </div>

            {/* 請假原因 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">請假類別</label>
              <div className="grid grid-cols-3 gap-2">
                {['事假', '病假', '其他'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setLeaveReason(r)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      leaveReason === r
                        ? 'bg-[#FF6B57] text-white border-[#FF6B57] shadow-xs'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* 備註 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">備註說明 (選填)</label>
              <textarea
                value={leaveRemarks}
                onChange={(e) => setLeaveRemarks(e.target.value)}
                placeholder="例如：發燒請假、外出旅行等..."
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#FF6B57]"
              />
            </div>

            {/* 補堂提示 */}
            <p className="text-[11px] text-gray-400 leading-relaxed">
              💡 提早請假將記錄於系統，職員會於審核後為您安排補堂。
            </p>

            {/* 提交按鈕 */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmitLeave}
                disabled={isSubmittingLeave}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-[#FF6B57] hover:bg-[#E05340] rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {isSubmittingLeave ? '提交中...' : '確認申請請假'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          彈窗 2：請假補堂管理彈窗 (Leave & Makeup Modal)
      ═══════════════════════════════════════════════ */}
      {showMakeupModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-gray-150 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B57] flex items-center justify-center">
                  <RotateCcw size={18} />
                </div>
                <h3 className="text-base font-bold text-gray-900">請假補堂管理</h3>
              </div>
              <button
                onClick={() => setShowMakeupModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* 補堂配額卡片 */}
            <div className="bg-[#FFF5F3] border border-[#FED7D2] rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">已報讀課程</span>
                <span className="text-xs font-black text-[#FF6B57]">共 {realCourseCards.length} 個課程</span>
              </div>
              <div className="text-[11px] text-gray-600 space-y-1">
                {realCourseCards.length > 0 ? (
                  realCourseCards.map((rc, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="truncate max-w-[180px]">{rc.name}</span>
                      <span className="font-semibold text-gray-800">堂數 {rc.completedSessions}/{rc.totalSessions}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">目前尚無課程記錄</p>
                )}
              </div>
            </div>

            {/* 我的請假與補堂申請記錄 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                  <Clock size={13} className="text-[#FF6B57]" />
                  <span>近期請假記錄</span>
                </span>
                <span className="text-[10px] text-gray-400">已自動同步至導師考勤</span>
              </div>
              {myLeaves.length > 0 ? (
                <div className="max-h-44 overflow-y-auto space-y-2 pr-0.5">
                  {myLeaves.map((lv) => (
                    <div key={lv.id} className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 truncate max-w-[170px]">{lv.courseName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          lv.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {lv.status === 'approved' ? '🟢 已准假' : '🔵 已排入點名簿'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>日期：{lv.date}</span>
                        <span className="px-1.5 py-0.2 rounded bg-orange-50 text-[#FF6B57] font-semibold border border-orange-100">{lv.reason}</span>
                      </div>
                      {lv.remarks && (
                        <div className="text-[10px] text-gray-400 bg-white p-1 rounded border border-gray-100">
                          備註：{lv.remarks}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400">
                  尚無請假記錄。點擊課堂卡片「請假」即可提早申請。
                </div>
              )}
            </div>

            {/* 請假及補堂說明 */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-800">補堂須知</h4>
              <ul className="text-[11px] text-gray-500 space-y-1 list-disc list-inside leading-relaxed">
                <li>請假須於上課前儘早提出，以利安排調堂或補堂。</li>
                <li>補堂請於課程有效期內與導師或職員預約。</li>
                <li>如有任何查詢，請隨時點擊「問教練 / 職員」聯繫。</li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowMakeupModal(false);
                  handleAskCoach();
                }}
                className="w-full py-2.5 text-xs font-bold text-white bg-[#FF6B57] hover:bg-[#E05340] rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={15} />
                <span>聯繫導師/職員預約補堂</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          彈窗 3：成長報告彈窗 (Growth Report Modal)
      ═══════════════════════════════════════════════ */}
      {showGrowthReportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-gray-150 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B57] flex items-center justify-center">
                  <TrendingUp size={18} />
                </div>
                <h3 className="text-base font-bold text-gray-900">學員成長學習報告</h3>
              </div>
              <button
                onClick={() => setShowGrowthReportModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* 學員資訊 */}
            <div className="bg-gradient-to-br from-[#FFF5F3] to-orange-50 border border-[#FED7D2] rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-gray-900">{studentName}</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {realEvaluation?.courseName || realCourseCards[0]?.name || '常規課程'}
                </p>
                <p className="text-[10px] text-gray-400">{branchName}</p>
              </div>
              <div className="text-right">
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-orange-100 text-[#FF6B57] border border-orange-200">
                  {realEvaluation?.stageLevel || '評核中'}
                </span>
                {realEvaluation?.date && (
                  <p className="text-[10px] text-gray-400 mt-1">評核日期：{realEvaluation.date}</p>
                )}
              </div>
            </div>

            {/* ⭐ 真實評核資料展示 (絕無 DUMMY 假資料) */}
            {loadingEvaluation ? (
              <div className="py-8 text-center text-xs text-gray-400">載入導師評核報告中...</div>
            ) : realEvaluation ? (
              <div className="space-y-3">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-800">各項技能掌握評核</h4>
                    <span className="text-[10px] text-gray-500">評核導師：{realEvaluation.teacherName}</span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700">課堂專注度與學習態度</span>
                      <span className="text-[#FF6B57] font-bold">{realEvaluation.focusScore}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#FF6B57] rounded-full transition-all" style={{ width: `${realEvaluation.focusScore}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700">音樂技巧與演奏掌握</span>
                      <span className="text-[#FF6B57] font-bold">{realEvaluation.skillScore}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#FF6B57] rounded-full transition-all" style={{ width: `${realEvaluation.skillScore}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700">節奏掌握與樂理理解</span>
                      <span className="text-[#FF6B57] font-bold">{realEvaluation.rhythmScore}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#FF6B57] rounded-full transition-all" style={{ width: `${realEvaluation.rhythmScore}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* 導師真實評語 */}
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                    <Smile size={14} />
                    <span>{realEvaluation.teacherName} 導師評語</span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap">
                    {realEvaluation.comment || '導師未留下備註。'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-gray-50 border border-gray-200 rounded-2xl text-center space-y-2">
                <Award size={32} className="mx-auto text-gray-300" />
                <p className="text-xs font-bold text-gray-700">導師尚未為此學員填寫本期評核報告</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  導師將於「會員名冊」中為學員完成學習表現評核，評核完成後此處將自動呈現最新報告。
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGrowthReportModal(false)}
              className="w-full py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              關閉報告
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
