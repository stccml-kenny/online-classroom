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
