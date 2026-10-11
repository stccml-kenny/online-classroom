'use client';

import React, { useState } from 'react';
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
  // 學員姓名與學號 (優先取當前帳戶，預設優雅兼容截圖)
  const studentName = currentUser?.name || currentUser?.studentName || currentUser?.childName || 'Heinz Chin Chun Hang';
  const studentId = currentUser?.username ? currentUser.username.toUpperCase() : 'KDS10343';
  const branchName = currentUser?.branch || '北角和富店';

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
  const [leaveSuccessToast, setLeaveSuccessToast] = useState<string | null>(null);

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

  // 確認提交請假申請
  const handleSubmitLeave = () => {
    if (!selectedSessionForLeave) return;
    setIsSubmittingLeave(true);
    setTimeout(() => {
      setIsSubmittingLeave(false);
      setShowLeaveModal(false);
      setLeaveSuccessToast(`已成功為【${selectedSessionForLeave.date}】提交請假申請，系統將安排相應補堂！`);
      setTimeout(() => setLeaveSuccessToast(null), 4000);
    }, 600);
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
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#147D6F] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-3 max-w-[90%] text-center">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-200" />
          <span>{leaveSuccessToast}</span>
        </div>
      )}

      {/* 🟢 1. 下一堂 (Next Class) 卡片 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-bold text-gray-800 tracking-tight">下一堂</h2>
          <button
            type="button"
            onClick={handleGoCalendar}
            className="text-xs font-semibold text-[#147D6F] hover:text-[#0E5B50] flex items-center gap-0.5 transition-colors cursor-pointer"
          >
            <span>日曆</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* 下一堂 主體卡片 (薄荷綠優雅質感) */}
        <div className="bg-[#EBF7F5] border border-[#D3ECE6] rounded-2xl overflow-hidden shadow-2xs">
          {/* 上半部：課堂詳情與日曆大數字標籤 */}
          <div className="p-3.5 flex items-center gap-3">
            {/* 白色日曆徽章 */}
            <div className="w-14 h-16 bg-white rounded-xl shadow-2xs border border-[#CDEAE4] flex flex-col items-center justify-center shrink-0">
              <span className="text-[11px] font-semibold text-[#147D6F] leading-none">六</span>
              <span className="text-xl font-black text-gray-900 leading-tight my-0.5">17</span>
              <span className="text-[9px] font-medium text-gray-400 leading-none">10 月</span>
            </div>

            {/* 課堂詳細文字 */}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-gray-900 truncate">
                初階班 · NP-B6-5
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">
                15:00 · 北角和富店
              </p>
              <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">
                {studentName} · Coach Kayan
              </p>
            </div>
          </div>

          {/* 下半部：操作按鈕欄 (白色底背景 + 細線分隔) */}
          <div className="bg-white/80 border-t border-[#D3ECE6] flex items-center divide-x divide-[#D3ECE6]">
            <button
              type="button"
              onClick={() => handleOpenLeave({
                date: '17/10/2026（六） 15:00',
                course: '初階班 · NP-B6-5',
                branch: '北角和富店',
                coach: 'Coach Kayan'
              })}
              className="flex-1 py-2.5 text-center text-xs font-bold text-[#147D6F] hover:bg-[#EBF7F5] transition-colors cursor-pointer"
            >
              請假
            </button>
            <button
              type="button"
              onClick={handleAskCoach}
              className="flex-1 py-2.5 text-center text-xs font-bold text-[#147D6F] hover:bg-[#EBF7F5] transition-colors cursor-pointer"
            >
              問教練 / 職員
            </button>
          </div>
        </div>
      </section>

      {/* 🟢 2. 快捷操作按鈕區 (暫時不需報新班及付款 -> 保留「請假補堂」與「成長報告」) */}
      <section className="grid grid-cols-2 gap-3">
        {/* 請假補堂 */}
        <button
          type="button"
          onClick={() => setShowMakeupModal(true)}
          className="bg-white border border-gray-150 rounded-2xl p-3.5 shadow-2xs hover:border-[#147D6F] hover:shadow-xs transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-[#EBF7F5] text-[#147D6F] flex items-center justify-center group-hover:scale-105 transition-transform">
            <RotateCcw size={20} />
          </div>
          <span className="text-xs font-bold text-gray-800 group-hover:text-[#147D6F]">
            請假補堂
          </span>
        </button>

        {/* 成長報告 */}
        <button
          type="button"
          onClick={() => setShowGrowthReportModal(true)}
          className="bg-white border border-gray-150 rounded-2xl p-3.5 shadow-2xs hover:border-[#147D6F] hover:shadow-xs transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-[#EBF7F5] text-[#147D6F] flex items-center justify-center group-hover:scale-105 transition-transform">
            <TrendingUp size={20} />
          </div>
          <span className="text-xs font-bold text-gray-800 group-hover:text-[#147D6F]">
            成長報告
          </span>
        </button>
      </section>

      {/* 🟢 3. 學員姓名與所參加課程 (課堂堂數進度) */}
      <section className="space-y-2.5">
        <div className="flex items-baseline gap-2 px-0.5">
          <h2 className="text-base font-black text-gray-900 tracking-tight">
            {studentName}
          </h2>
          <span className="text-xs font-medium text-gray-400">
            {studentId}
          </span>
        </div>

        {/* 課程卡片 1 */}
        <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <h3 className="text-sm font-bold text-gray-900 truncate">
              初階班 · NP-B6-6
            </h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              北角和富 · 有效期至 19/9/2026
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-xl font-black text-[#147D6F]">0</span>
              <span className="text-xs text-gray-400 font-bold">/1 堂</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              補堂 0/1
            </p>
          </div>
        </div>

        {/* 課程卡片 2 */}
        <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <h3 className="text-sm font-bold text-gray-900 truncate">
              初階班 · NP-B6-5
            </h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              北角和富 · 有效期至 12/12/2026
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-xl font-black text-[#147D6F]">7</span>
              <span className="text-xs text-gray-400 font-bold">/12 堂</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              補堂 0/3
            </p>
          </div>
        </div>
      </section>

      {/* 🟢 4. 未來 14 日課堂 (Upcoming 14 Days Classes) */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-gray-500 px-0.5">
          未來 14 日課堂
        </h2>

        <div className="bg-white border border-gray-150 rounded-2xl shadow-2xs divide-y divide-gray-100 overflow-hidden">
          {/* 第 1 節課 */}
          <div className="p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">
                17/10/2026（六） 15:00
              </span>
              <button
                type="button"
                onClick={() => handleOpenLeave({
                  date: '17/10/2026（六） 15:00',
                  course: '初階班 · NP-B6-5',
                  branch: '北角和富店',
                  coach: 'Coach Kayan'
                })}
                className="px-3.5 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer"
              >
                請假
              </button>
            </div>
            <p className="text-xs text-gray-500 font-medium">
              初階班 · NP-B6-5 · 北角和富店 · Coach Kayan
            </p>
            <button
              type="button"
              onClick={handleAskCoach}
              className="text-xs font-semibold text-[#147D6F] hover:underline pt-0.5 flex items-center gap-1 cursor-pointer"
            >
              問教練 / 職員
            </button>
          </div>

          {/* 第 2 節課 */}
          <div className="p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">
                24/10/2026（六） 15:00
              </span>
              <button
                type="button"
                onClick={() => handleOpenLeave({
                  date: '24/10/2026（六） 15:00',
                  course: '初階班 · NP-B6-5',
                  branch: '北角和富店',
                  coach: 'Coach Kayan'
                })}
                className="px-3.5 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer"
              >
                請假
              </button>
            </div>
            <p className="text-xs text-gray-500 font-medium">
              初階班 · NP-B6-5 · 北角和富店 · Coach Kayan
            </p>
            <button
              type="button"
              onClick={handleAskCoach}
              className="text-xs font-semibold text-[#147D6F] hover:underline pt-0.5 flex items-center gap-1 cursor-pointer"
            >
              問教練 / 職員
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          彈窗 1：請假申請彈窗 (Leave Modal)
      ═══════════════════════════════════════════════ */}
      {showLeaveModal && selectedSessionForLeave && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-gray-150 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#147D6F] flex items-center justify-center">
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
            <div className="bg-[#EBF7F5] border border-[#D3ECE6] rounded-2xl p-3 space-y-1 text-xs">
              <div className="font-bold text-gray-900">{selectedSessionForLeave.course}</div>
              <div className="text-gray-600">課堂日期：{selectedSessionForLeave.date}</div>
              <div className="text-gray-600">上課分校：{selectedSessionForLeave.branch}</div>
              <div className="text-gray-600">授課教練：{selectedSessionForLeave.coach}</div>
              <div className="text-[#147D6F] font-semibold pt-1">學員：{studentName} ({studentId})</div>
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
                        ? 'bg-[#147D6F] text-white border-[#147D6F] shadow-xs'
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
                placeholder="例如：發燒請假、家庭旅行等..."
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#147D6F]"
              />
            </div>

            {/* 補堂提示 */}
            <p className="text-[11px] text-gray-400 leading-relaxed">
              💡 提早請假將自動為您保留補堂名額，可於「請假補堂」頁面申請相應堂數之補堂。
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
                className="flex-1 py-2.5 text-xs font-bold text-white bg-[#147D6F] hover:bg-[#0E5B50] rounded-xl shadow-md transition-all disabled:opacity-50"
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
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#147D6F] flex items-center justify-center">
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
            <div className="bg-[#EBF7F5] border border-[#D3ECE6] rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">可用補堂配額</span>
                <span className="text-xs font-black text-[#147D6F]">共 0 堂待預約</span>
              </div>
              <div className="text-[11px] text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>初階班 · NP-B6-6</span>
                  <span className="font-semibold text-gray-800">補堂配額 0/1</span>
                </div>
                <div className="flex justify-between">
                  <span>初階班 · NP-B6-5</span>
                  <span className="font-semibold text-gray-800">補堂配額 0/3</span>
                </div>
              </div>
            </div>

            {/* 請假及補堂說明 */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-800">補堂須知</h4>
              <ul className="text-[11px] text-gray-500 space-y-1 list-disc list-inside leading-relaxed">
                <li>請假須於上課前至少 2 小時提出。</li>
                <li>補堂請於課程有效期內完成預約。</li>
                <li>如需指定教練或調動分校，請點擊「問教練 / 職員」聯繫處理。</li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowMakeupModal(false);
                  handleAskCoach();
                }}
                className="w-full py-2.5 text-xs font-bold text-white bg-[#147D6F] hover:bg-[#0E5B50] rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={15} />
                <span>聯繫教練/職員預約補堂</span>
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
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#147D6F] flex items-center justify-center">
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
            <div className="bg-gradient-to-br from-[#EBF7F5] to-teal-50 border border-[#D3ECE6] rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-gray-900">{studentName}</h4>
                <p className="text-xs text-gray-500 mt-0.5">初階班 · NP-B6-5</p>
                <p className="text-[10px] text-gray-400">{branchName}</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-[#147D6F]">100%</span>
                <p className="text-[10px] text-gray-500 font-semibold">課堂出席率</p>
              </div>
            </div>

            {/* 學習指標掌握進度 */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-gray-800">各項技能掌握評估</h4>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-700">課堂專注度與紀律</span>
                  <span className="text-[#147D6F]">95% (優異)</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#147D6F] rounded-full" style={{ width: '95%' }}></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-700">基本動作與技巧協調</span>
                  <span className="text-[#147D6F]">90% (良好)</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#147D6F] rounded-full" style={{ width: '90%' }}></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-700">團隊合作與互動表現</span>
                  <span className="text-[#147D6F]">92% (優異)</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#147D6F] rounded-full" style={{ width: '92%' }}></div>
                </div>
              </div>
            </div>

            {/* 教練評語 */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <Smile size={14} />
                <span>Coach Kayan 導師評語</span>
              </div>
              <p className="text-xs text-amber-900/90 leading-relaxed">
                Chin Chun Hang 在近期課堂中表現積極主動，能迅速掌握教練示範之動作要點，與同儕互動融洽，期望繼續保持良好學習態度！
              </p>
            </div>

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
