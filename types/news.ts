export type NewsCategory = '校務通知' | '活動快訊' | '重要提醒' | '停課/天氣' | '行政公告' | '一般消息';

export interface NewsAttachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface NewsItem {
  $id?: string;
  id?: string;
  title: string;
  content: string;
  category: NewsCategory | string;
  is_pinned?: boolean;
  is_important?: boolean;
  branch?: string; // '全部分校' 或特定學校
  target_roles?: string; // JSON: ["all"] 或 ["student","parent"]
  publish_date: string; // ISO 8601 Datetime string
  expiry_date?: string; // 選填下架日期 ISO 8601
  attachments?: string; // JSON: NewsAttachment[]
  author_name?: string;
  author_id?: string;
  createdAt?: string;
  $createdAt?: string;
}

export const NEWS_CATEGORIES: { label: NewsCategory; color: string; bg: string; border: string }[] = [
  { label: '校務通知', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { label: '活動快訊', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  { label: '重要提醒', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  { label: '停課/天氣', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  { label: '行政公告', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  { label: '一般消息', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
];
