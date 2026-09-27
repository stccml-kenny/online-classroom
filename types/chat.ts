import { UserRole } from '@/components/auth/AuthModal';

export type MessageType = 'text' | 'leave_request' | 'homework_qa' | 'feedback' | 'image' | 'file';

export interface ChatMessage {
  $id?: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  receiverId: string;
  content: string;
  type: MessageType;
  fileUrl?: string;
  fileName?: string;
  isRead: boolean;
  timestamp: string; // ISO 8601 string
}

export interface ChatConversation {
  $id?: string;
  conversationId: string;
  participants: string[];
  participantRoles?: UserRole[];
  participantNames?: string[];
  lastMessage?: string;
  lastMessageTime?: string;
  lastSenderId?: string;
  unreadCountMap?: string; // JSON: Record<string, number>
  branch?: string;
  className?: string;
}

export interface ChatContact {
  username: string;
  name: string;
  role: UserRole;
  branch?: string;
  className?: string;
  email?: string;
  childrenUsernames?: string[];
  childrenNames?: string[];
  enrolledCourses?: string[];
}

export interface CustomChatGroup {
  id: string;
  name: string;
  memberUsernames: string[];
  color?: string;
  createdAt: string;
}

// ⭐ 系統管理員角色即時訊息權限設定 (啟動 / 暫停)
export interface RoleChatPermissions {
  teacher: boolean;
  assistant: boolean;
  student: boolean;
  parent: boolean;
}

export const DEFAULT_ROLE_CHAT_PERMISSIONS: RoleChatPermissions = {
  teacher: true,
  assistant: true,
  student: false, // 預設暫停家長與學生
  parent: false,  // 預設暫停家長與學生
};
