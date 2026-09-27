export type CalendarEventType = 'holiday' | 'course' | 'exam' | 'activity' | 'homework' | 'other';

export interface CalendarEvent {
  $id?: string;
  id?: string; // 兼容本地與雲端
  title: string;
  description?: string;
  eventType: CalendarEventType;
  startDate: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  endDate: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  isAllDay: boolean;
  branch: string; // '全部分校' or specific branch
  courseName?: string; // '全部課程' or specific course
  className?: string; // '全體班別' or specific class
  targetRoles?: string; // JSON: ["all"] or ["teacher","student"]
  location?: string;
  color?: string;
  creatorUsername?: string;
  creatorName?: string;
  createdAt?: string;
  isVirtualHomework?: boolean; // 若為自動由單元家課動態生成的日程標記
  homeworkId?: string;
}

export const EVENT_TYPE_CONFIG: Record<
  CalendarEventType,
  { label: string; emoji: string; color: string; bgLight: string; border: string; dotColor: string }
> = {
  holiday: { label: '假期/校務', emoji: '🔴', color: 'text-red-700', bgLight: 'bg-red-50', border: 'border-red-200', dotColor: 'bg-red-500' },
  course: { label: '課程活動', emoji: '🔵', color: 'text-blue-700', bgLight: 'bg-blue-50', border: 'border-blue-200', dotColor: 'bg-blue-500' },
  exam: { label: '評估測驗', emoji: '🟢', color: 'text-emerald-700', bgLight: 'bg-emerald-50', border: 'border-emerald-200', dotColor: 'bg-emerald-500' },
  activity: { label: '校園活動', emoji: '🟣', color: 'text-purple-700', bgLight: 'bg-purple-50', border: 'border-purple-200', dotColor: 'bg-purple-500' },
  homework: { label: '功課截止', emoji: '🟠', color: 'text-amber-700', bgLight: 'bg-amber-50', border: 'border-amber-200', dotColor: 'bg-amber-500' },
  other: { label: '其他事項', emoji: '⚪', color: 'text-gray-700', bgLight: 'bg-gray-50', border: 'border-gray-200', dotColor: 'bg-gray-500' },
};
