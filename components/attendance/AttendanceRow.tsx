import React from 'react';
import { Check, X, Clock, AlertCircle, User } from 'lucide-react';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'unmarked';

export interface StudentAttendance {
  id: string;
  name: string;
  studentNo?: string;
  className?: string; // ⭐ 需求：會員名字下改為班別
  status: AttendanceStatus;
}

interface AttendanceRowProps {
  student: StudentAttendance;
  onStatusChange: (id: string, status: AttendanceStatus) => void;
}

export const AttendanceRow: React.FC<AttendanceRowProps> = ({ student, onStatusChange }) => {
  return (
    <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        {/* 左側頭像：以學生姓名首字呈現 */}
        <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-200">
          {student.name ? student.name.charAt(0) : <User size={14} />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-gray-800 text-sm truncate">{student.name}</span>
            {student.status === 'unmarked' && (
              <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded font-medium shrink-0">
                待點名
              </span>
            )}
          </div>
          {/* ⭐ 需求：會員名字下不要學號，改為班別 */}
          <div className="text-[11px] text-purple-700 font-semibold mt-0.5 flex items-center gap-1">
            <span className="text-[10px] text-gray-400 font-normal">班別：</span>
            <span>{student.className || '未設定班別'}</span>
          </div>
        </div>
      </div>

      {/* 四種點名狀態快捷按鈕 (預設未點名時全部為灰，不預設出席) */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onStatusChange(student.id, 'present')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            student.status === 'present'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
          title="出席"
        >
          出席
        </button>

        <button
          type="button"
          onClick={() => onStatusChange(student.id, 'absent')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            student.status === 'absent'
              ? 'bg-rose-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
          title="缺席"
        >
          缺席
        </button>

        <button
          type="button"
          onClick={() => onStatusChange(student.id, 'late')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            student.status === 'late'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
          title="遲到"
        >
          遲到
        </button>

        <button
          type="button"
          onClick={() => onStatusChange(student.id, 'excused')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            student.status === 'excused'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
          title="請假"
        >
          請假
        </button>
      </div>
    </div>
  );
};
