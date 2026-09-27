import { client, databases, DATABASE_ID } from '@/lib/appwrite';
import { ID, Query } from 'appwrite';
import type { ChatMessage, ChatConversation, MessageType } from '@/types/chat';
import type { UserProfile } from '@/components/auth/AuthModal';

const CONVERSATIONS_COLLECTION = 'chat_conversations';
const MESSAGES_COLLECTION = 'chat_messages';

// 產生唯一定義的兩人間對話通道 ID (雙方帳號依英文字母排序，確保雙向一致)
export function makeConversationId(user1: string, user2: string): string {
  const u1 = (user1 || '').toLowerCase().trim();
  const u2 = (user2 || '').toLowerCase().trim();
  return [u1, u2].sort().join('__');
}

// 本地暫存快取機制 (保證在離線或伺服器延遲時秒開)
function getLocalCache<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(`oc_chat_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocalCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`oc_chat_${key}`, JSON.stringify(data));
  } catch {}
}

export const chatService = {
  /**
   * 取得指定用戶的所有對話列表
   */
  async getConversations(currentUsername: string): Promise<ChatConversation[]> {
    const uLower = (currentUsername || '').toLowerCase().trim();
    if (!uLower) return [];

    const localList = getLocalCache<ChatConversation[]>(`convs_${uLower}`, []);

    try {
      // 嘗試從 Appwrite 抓取對話表
      const res = await databases.listDocuments(DATABASE_ID, CONVERSATIONS_COLLECTION, [
        Query.orderDesc('lastMessageTime'),
        Query.limit(100),
      ]);

      if (res && res.documents) {
        // 過濾出包含當前用戶的對話
        const matched = res.documents
          .filter((d: any) => {
            const parts: string[] = Array.isArray(d.participants) ? d.participants : [];
            return parts.some((p) => (p || '').toLowerCase().trim() === uLower);
          })
          .map((d: any) => ({
            $id: d.$id,
            conversationId: d.conversationId,
            participants: d.participants || [],
            participantRoles: d.participantRoles || [],
            participantNames: d.participantNames || [],
            lastMessage: d.lastMessage || '',
            lastMessageTime: d.lastMessageTime || '',
            lastSenderId: d.lastSenderId || '',
            unreadCountMap: d.unreadCountMap || '{}',
            branch: d.branch || '',
            className: d.className || '',
          }));

        // 更新本地快取
        setLocalCache(`convs_${uLower}`, matched);
        return matched;
      }
    } catch (err) {
      console.warn('從 Appwrite 讀取對話表失敗，使用本地快取:', err);
    }

    return localList;
  },

  /**
   * 取得指定對話通道內的歷史訊息 (按時間升序排列)
   */
  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    if (!conversationId) return [];
    const localMsgs = getLocalCache<ChatMessage[]>(`msgs_${conversationId}`, []);

    try {
      const res = await databases.listDocuments(DATABASE_ID, MESSAGES_COLLECTION, [
        Query.equal('conversationId', conversationId),
        Query.orderAsc('timestamp'),
        Query.limit(200),
      ]);

      if (res && res.documents) {
        const remoteMsgs: ChatMessage[] = res.documents.map((d: any) => ({
          $id: d.$id,
          conversationId: d.conversationId,
          senderId: d.senderId,
          senderName: d.senderName,
          senderRole: d.senderRole,
          receiverId: d.receiverId,
          content: d.content,
          type: d.type || 'text',
          fileUrl: d.fileUrl || '',
          fileName: d.fileName || '',
          isRead: !!d.isRead,
          timestamp: d.timestamp || d.$createdAt,
        }));

        // 與本地未完成的樂觀更新合併
        const remoteIds = new Set(remoteMsgs.map((m) => m.$id));
        const pendingLocal = localMsgs.filter(
          (m) => m.$id && m.$id.startsWith('temp_') && !remoteIds.has(m.$id)
        );
        const combined = [...remoteMsgs, ...pendingLocal];

        setLocalCache(`msgs_${conversationId}`, combined);
        return combined;
      }
    } catch (err) {
      console.warn('從 Appwrite 讀取歷史訊息失敗，使用本地快取:', err);
    }

    return localMsgs;
  },

  /**
   * 發送一則即時訊息
   */
  async sendMessage(params: {
    conversationId: string;
    sender: UserProfile;
    receiver: { username: string; name: string; role: any };
    content: string;
    type?: MessageType;
    fileUrl?: string;
    fileName?: string;
    branch?: string;
    className?: string;
  }): Promise<ChatMessage> {
    const timestamp = new Date().toISOString();
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newMsg: ChatMessage = {
      $id: tempId,
      conversationId: params.conversationId,
      senderId: params.sender.username,
      senderName: params.sender.name || params.sender.username,
      senderRole: params.sender.role,
      receiverId: params.receiver.username,
      content: params.content,
      type: params.type || 'text',
      fileUrl: params.fileUrl || '',
      fileName: params.fileName || '',
      isRead: false,
      timestamp,
    };

    // 1. 立即樂觀寫入本地快取
    const existingMsgs = getLocalCache<ChatMessage[]>(`msgs_${params.conversationId}`, []);
    setLocalCache(`msgs_${params.conversationId}`, [...existingMsgs, newMsg]);

    // 2. 異步同步至 Appwrite 雲端
    try {
      const payload = {
        conversationId: params.conversationId,
        senderId: newMsg.senderId,
        senderName: newMsg.senderName,
        senderRole: newMsg.senderRole,
        receiverId: newMsg.receiverId,
        content: newMsg.content,
        type: newMsg.type,
        fileUrl: newMsg.fileUrl || '',
        fileName: newMsg.fileName || '',
        isRead: false,
        timestamp,
      };

      const doc = await databases.createDocument(
        DATABASE_ID,
        MESSAGES_COLLECTION,
        ID.unique(),
        payload
      );
      newMsg.$id = doc.$id;

      // 替換本地快取中的 tempId 為真正 ID
      const updatedList = getLocalCache<ChatMessage[]>(`msgs_${params.conversationId}`, []).map((m) =>
        m.$id === tempId ? newMsg : m
      );
      setLocalCache(`msgs_${params.conversationId}`, updatedList);

      // 3. 更新或建立對話表 (chat_conversations)
      try {
        await this.upsertConversation({
          conversationId: params.conversationId,
          sender: params.sender,
          receiver: params.receiver,
          lastMessage: params.content,
          lastMessageTime: timestamp,
          branch: params.branch,
          className: params.className,
        });
      } catch (ce) {
        console.warn('更新 chat_conversations 失敗:', ce);
      }
    } catch (err) {
      console.warn('Appwrite 發送訊息失敗 (保留本地發送記錄):', err);
    }

    return newMsg;
  },

  /**
   * 建立或更新對話總表摘要 (記錄最後訊息與未讀數)
   */
  async upsertConversation(params: {
    conversationId: string;
    sender: UserProfile;
    receiver: { username: string; name: string; role: any };
    lastMessage: string;
    lastMessageTime: string;
    branch?: string;
    className?: string;
  }): Promise<void> {
    const { conversationId, sender, receiver, lastMessage, lastMessageTime, branch, className } = params;

    let existingDoc: any = null;
    try {
      const check = await databases.listDocuments(DATABASE_ID, CONVERSATIONS_COLLECTION, [
        Query.equal('conversationId', conversationId),
        Query.limit(1),
      ]);
      if (check.documents && check.documents.length > 0) {
        existingDoc = check.documents[0];
      }
    } catch {}

    const participants = [sender.username, receiver.username];
    const participantRoles = [sender.role, receiver.role];
    const participantNames = [sender.name || sender.username, receiver.name || receiver.username];

    let unreadMap: Record<string, number> = {};
    if (existingDoc && existingDoc.unreadCountMap) {
      try {
        unreadMap = JSON.parse(existingDoc.unreadCountMap);
      } catch {}
    }

    // 接收者未讀數 +1
    const rKey = receiver.username.toLowerCase();
    unreadMap[rKey] = (unreadMap[rKey] || 0) + 1;

    const payload: any = {
      conversationId,
      participants,
      participantRoles,
      participantNames,
      lastMessage,
      lastMessageTime,
      lastSenderId: sender.username,
      unreadCountMap: JSON.stringify(unreadMap),
    };

    if (branch) payload.branch = branch;
    if (className) payload.className = className;

    if (existingDoc) {
      await databases.updateDocument(DATABASE_ID, CONVERSATIONS_COLLECTION, existingDoc.$id, payload);
    } else {
      await databases.createDocument(DATABASE_ID, CONVERSATIONS_COLLECTION, ID.unique(), payload);
    }
  },

  /**
   * 將指定對話中所有屬於當前使用者的未讀訊息標記為「已讀」
   */
  async markMessagesAsRead(conversationId: string, currentUsername: string): Promise<void> {
    const uLower = (currentUsername || '').toLowerCase().trim();
    if (!conversationId || !uLower) return;

    // 1. 本地快取立即更新
    const localMsgs = getLocalCache<ChatMessage[]>(`msgs_${conversationId}`, []);
    let changed = false;
    const updatedMsgs = localMsgs.map((m) => {
      if (m.receiverId.toLowerCase().trim() === uLower && !m.isRead) {
        changed = true;
        return { ...m, isRead: true };
      }
      return m;
    });
    if (changed) {
      setLocalCache(`msgs_${conversationId}`, updatedMsgs);
    }

    // 2. 異步更新 Appwrite 雲端訊息記錄
    try {
      const res = await databases.listDocuments(DATABASE_ID, MESSAGES_COLLECTION, [
        Query.equal('conversationId', conversationId),
        Query.equal('receiverId', currentUsername),
        Query.equal('isRead', false),
        Query.limit(50),
      ]);

      if (res && res.documents.length > 0) {
        for (const doc of res.documents) {
          await databases.updateDocument(DATABASE_ID, MESSAGES_COLLECTION, doc.$id, {
            isRead: true,
          }).catch(() => {});
        }
      }

      // 3. 重設 chat_conversations 中當前用戶的 unread 數為 0
      const convRes = await databases.listDocuments(DATABASE_ID, CONVERSATIONS_COLLECTION, [
        Query.equal('conversationId', conversationId),
        Query.limit(1),
      ]);

      if (convRes && convRes.documents.length > 0) {
        const cDoc = convRes.documents[0];
        let uMap: Record<string, number> = {};
        try {
          uMap = JSON.parse(cDoc.unreadCountMap || '{}');
        } catch {}
        if (uMap[uLower]) {
          uMap[uLower] = 0;
          await databases.updateDocument(DATABASE_ID, CONVERSATIONS_COLLECTION, cDoc.$id, {
            unreadCountMap: JSON.stringify(uMap),
          }).catch(() => {});
        }
      }
    } catch (e) {
      // 忽略標記已讀錯誤
    }
  },

  /**
   * 計算當前使用者的全域總未讀訊息數
   */
  async getTotalUnreadCount(currentUsername: string): Promise<number> {
    const uLower = (currentUsername || '').toLowerCase().trim();
    if (!uLower) return 0;

    try {
      const convs = await this.getConversations(currentUsername);
      let count = 0;
      convs.forEach((c) => {
        try {
          const map = JSON.parse(c.unreadCountMap || '{}');
          count += map[uLower] || 0;
        } catch {}
      });
      return count;
    } catch {
      return 0;
    }
  },

  /**
   * 即時訂閱新訊息 (Appwrite WebSocket Realtime)
   */
  subscribeToNewMessages(
    currentUsername: string,
    onMessageReceived: (message: ChatMessage) => void
  ): () => void {
    if (typeof window === 'undefined' || !client) {
      return () => {};
    }

    try {
      const uLower = (currentUsername || '').toLowerCase().trim();
      const channel = `databases.${DATABASE_ID}.collections.${MESSAGES_COLLECTION}.documents`;

      const unsubscribe = client.subscribe(channel, (response: any) => {
        if (!response || !response.events) return;
        const isCreate = response.events.some((e: string) => e.endsWith('.create'));

        if (isCreate && response.payload) {
          const d = response.payload;
          const msg: ChatMessage = {
            $id: d.$id,
            conversationId: d.conversationId,
            senderId: d.senderId,
            senderName: d.senderName,
            senderRole: d.senderRole,
            receiverId: d.receiverId,
            content: d.content,
            type: d.type || 'text',
            fileUrl: d.fileUrl || '',
            fileName: d.fileName || '',
            isRead: !!d.isRead,
            timestamp: d.timestamp || d.$createdAt,
          };

          // 只有當訊息與自己有關 (自己是接收者或發送者) 時才觸發
          if (
            msg.receiverId.toLowerCase().trim() === uLower ||
            msg.senderId.toLowerCase().trim() === uLower
          ) {
            onMessageReceived(msg);
          }
        }
      });

      return unsubscribe;
    } catch (e) {
      console.warn('Realtime 訂閱失敗:', e);
      return () => {};
    }
  },
};
