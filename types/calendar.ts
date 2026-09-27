export type CalendarEventType = 'course' | 'homework';

export interface CalendarEvent {
  $id?: string;
  id?: string; // 兼容本地與雲端
  title: string;
  description?: string;
  eventType?: CalendarEventType;
  startDate: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  endDate: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  isAllDay?: boolean;
  timeSlot?: string;
  sessionIndex?: number;
  branch: string; // '全部分校' or specific branch
  courseName?: string; // '全部課程' or specific course
  className?: string; // '全體班別' or specific class
  targetRoles?: string; // JSON: ["all"] or ["teacher","student"]
  location?: string;
  color?: string;
  creatorUsername?: string;
  creatorName?: string;
  createdAt?: string;
}

export const EVENT_TYPE_CONFIG: Record<
  CalendarEventType,
  { label: string; emoji: string; color: string; bgLight: string; border: string; dotColor: string }
> = {
  course: {
    label: '課程上課',
    emoji: '📚',
    color: 'text-indigo-700',
    bgLight: 'bg-indigo-50',
    border: 'border-indigo-200',
    dotColor: 'bg-indigo-600',
  },
  homework: {
    label: '功課清單',
    emoji: '📝',
    color: 'text-amber-700',
    bgLight: 'bg-amber-50',
    border: 'border-amber-200',
    dotColor: 'bg-amber-600',
  },
};
