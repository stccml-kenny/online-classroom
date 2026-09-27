'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav, TabType } from '@/components/layout/BottomNav';
import { MoreView } from '@/components/more/MoreView';
import { NoticeModal } from '@/components/notices/NoticeModal';
import { HomeworkModal } from '@/components/homework/HomeworkModal';
import { CourseContentModal } from '@/components/curriculum/CourseContentModal';
import { AttendanceModal } from '@/components/attendance/AttendanceModal';
import { ClassManagementModal } from '@/components/classes/ClassManagementModal';
import { HomeworkSetupModal, CourseItem, isCourseMatch } from '@/components/homework/HomeworkSetupModal';
import { AuthModal, UserProfile, ROLE_CONFIGS } from '@/components/auth/AuthModal';
import { HomeView } from '@/components/home/HomeView';
import { ChatView } from '@/components/chat/ChatView';
import { DirectMessageModal } from '@/components/chat/DirectMessageModal';
import { chatService } from '@/lib/chatService';
import { RoleChatPermissions, DEFAULT_ROLE_CHAT_PERMISSIONS } from '@/types/chat';

import { AccountManagementModal } from '@/components/admin/AccountManagementModal';
import { CalendarModal } from '@/components/calendar/CalendarModal';
import type { CalendarEvent } from '@/types/calendar';
import {
  databases,
  DATABASE_ID,
  saveAllAccountsToCloud,
  loadAllAccountsFromCloud,
  directLoginFromCloud,
  saveAllCoursesToCloud,
  loadAllCoursesFromCloud,
  loadCalendarEventsFromCloud,
  saveCalendarEventToCloud,
  deleteCalendarEventFromCloud,
} from '@/lib/appwrite';
import { ID, Query } from 'appwrite';

export default function OnlineClassroomApp() {
  // ⭐ 需求：首頁要有開始使用，之後要求登入帳戶，預設進入首頁 (home)
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // ⭐ 核心架構：以登入用戶帳號 (currentUser) 為系統絕對核心，所有權限、課程與家課跟著帳戶走
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const [chatTargetUser, setChatTargetUser] = useState<UserProfile | null>(null);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<'login' | 'register'>('login');
  const [showAccountMgmtModal, setShowAccountMgmtModal] = useState<boolean>(false);
  const [accountMgmtInitialTab, setAccountMgmtInitialTab] = useState<'issue' | 'excel' | 'list' | 'chat_settings'>('issue');
  const [roleChatPermissions, setRoleChatPermissions] = useState<RoleChatPermissions>(DEFAULT_ROLE_CHAT_PERMISSIONS);

  const handleOpenAccountMgmt = (tab: 'issue' | 'excel' | 'list' | 'chat_settings' = 'issue') => {
    setAccountMgmtInitialTab(tab);
    setShowAccountMgmtModal(true);
  };

  const handleUpdateRoleChatPermissions = (newPermissions: RoleChatPermissions) => {
    setRoleChatPermissions(newPermissions);
    saveSettingToCloud('role_chat_permissions', newPermissions);
  };

  const isCurrentUserChatEnabled = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true; // 管理員始終開啟
    return !!roleChatPermissions[currentUser.role as keyof RoleChatPermissions];
  }, [currentUser, roleChatPermissions]);

  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const handleSaveCalendarEvent = async (eventData: CalendarEvent, existingId?: string) => {
    const savedDoc = await saveCalendarEventToCloud(eventData, existingId);
    setCalendarEvents((prev) => {
      const idx = prev.findIndex((e) => (e.$id && e.$id === (existingId || savedDoc.$id)) || (e.id && e.id === (existingId || savedDoc.id)));
      let updated: CalendarEvent[];
      if (idx !== -1) {
        updated = [...prev];
        updated[idx] = { ...updated[idx], ...savedDoc };
      } else {
        updated = [savedDoc, ...prev];
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('oc_calendar_events', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleDeleteCalendarEvent = async (eventId: string) => {
    await deleteCalendarEventFromCloud(eventId);
    setCalendarEvents((prev) => {
      const updated = prev.filter((e) => e.$id !== eventId && e.id !== eventId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('oc_calendar_events', JSON.stringify(updated));
      }
      return updated;
    });
  };
  const [showHomeworkModal, setShowHomeworkModal] = useState(false);
  const [showCourseContentModal, setShowCourseContentModal] = useState(false);
  const [courseModalInitialCourse, setCourseModalInitialCourse] = useState<string>('');
  const [courseModalInitialBranch, setCourseModalInitialBranch] = useState<string>('');
  const [courseModalInitialTab, setCourseModalInitialTab] = useState<'units' | 'homework'>('units');
  const [courseModalIsLocked, setCourseModalIsLocked] = useState<boolean>(false);

  // ⭐ 需求：點擊課程打開課程單元及單元家課，鎖上該頁的學校及課程選項
  const handleOpenCourseContent = (courseName?: string, branch?: string, isLocked: boolean = false) => {
    setCourseModalInitialCourse(courseName || '');
    setCourseModalInitialBranch(branch || '全部分校');
    setCourseModalInitialTab('units');
    setCourseModalIsLocked(isLocked);
    setShowCourseContentModal(true);
  };

  // ⭐ 需求 3：學生帳戶中首頁在線交功課按後直接顯示所有已參加之課程的家課
  const handleOpenStudentHomework = () => {
    setCourseModalInitialCourse('全部課程');
    setCourseModalInitialBranch(currentUser?.branch || '全部分校');
    setCourseModalInitialTab('homework');
    setCourseModalIsLocked(false);
    setShowCourseContentModal(true);
  };

  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);

  // 全域學校/分校、班別及課程
  const [branches, setBranches] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [courses, setCourses] = useState<(string | CourseItem)[]>([]);

  const isStudentOrParent = currentUser?.role === 'student' || currentUser?.role === 'parent';

  // ⭐ 需求 3：核心 CODE 緊隨用戶帳戶！
  // 學生身分：嚴格只呈現自己帳號中 enrolledCourses 參加的課程
  // 家長身分：嚴格只呈現關聯子女帳號參加的課程
  // 導師身分：呈現所屬學校之課程
  // 管理員身分：呈現全校所有課程
  const visibleCourses = React.useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.role === 'admin') {
      return courses;
    }

    if (currentUser.role === 'student') {
      const myCourses = currentUser.enrolledCourses || [];
      if (myCourses.length === 0) {
        // 若學生帳戶尚未分配課程，僅依其所屬分校呈現基礎課程
        const sBranch = (currentUser.branch || '').trim().toLowerCase();
        return courses.filter((c) => {
          const cBranch = (typeof c === 'object' && c !== null ? c.branch || '' : '').trim().toLowerCase();
          return !cBranch || cBranch === '全部分校' || !sBranch || sBranch === '全部分校' || cBranch === sBranch || cBranch.includes(sBranch);
        });
      }
      return courses.filter((c) => {
        const cName = typeof c === 'string' ? c : c.name;
        const cSlot = typeof c === 'object' && c !== null ? c.timeSlot : '';
        const cBranch = typeof c === 'object' && c !== null ? c.branch : '';
        return myCourses.some((mc) => isCourseMatch(mc, cName, cSlot, cBranch, currentUser.branch));
      });
    }

    if (currentUser.role === 'parent') {
      const linkedUsernames = (currentUser.childrenUsernames || []).map((u) => u.trim().toLowerCase());
      const matchedChildren = usersList.filter((u) =>
        linkedUsernames.includes((u.username || '').toLowerCase()) ||
        (currentUser.childName && u.name === currentUser.childName)
      );

      const allChildrenCourses = new Set<string>();
      matchedChildren.forEach((child) => {
        (child.enrolledCourses || []).forEach((cr) => allChildrenCourses.add(cr));
      });

      const childrenCourseList = Array.from(allChildrenCourses);
      if (childrenCourseList.length === 0) {
        return [];
      }
      return courses.filter((c) => {
        const cName = typeof c === 'string' ? c : c.name;
        const cSlot = typeof c === 'object' && c !== null ? c.timeSlot : '';
        const cBranch = typeof c === 'object' && c !== null ? c.branch : '';
        return childrenCourseList.some((cc) => isCourseMatch(cc, cName, cSlot, cBranch, currentUser.branch));
      });
    }

    if (currentUser.role === 'teacher' || currentUser.role === 'assistant') {
      const tBranch = (currentUser.branch || '').trim().toLowerCase();
      if (!tBranch || tBranch === '全部分校' || tBranch === '總校') {
        return courses;
      }
      return courses.filter((c) => {
        const cBranch = (typeof c === 'object' && c !== null ? c.branch || '' : '').trim().toLowerCase();
        return !cBranch || cBranch === '全部分校' || cBranch === tBranch || cBranch.includes(tBranch) || tBranch.includes(cBranch);
      });
    }

    return courses;
  }, [courses, currentUser, usersList]);

  // 純字串課程名稱清單
  const courseNames = Array.from(
    new Set(
      visibleCourses.map((c) => {
        if (typeof c === 'string') return c.trim();
        if (c.timeSlot && c.timeSlot.trim()) {
          const slot = c.timeSlot.trim();
          if (c.name.includes(slot)) return c.name.trim();
          return `${c.name.trim()} (${slot})`;
        }
        return c.name ? c.name.trim() : '';
      }).filter(Boolean)
    )
  );

  // ⭐ 全域雙軌資料庫同步引擎 (在 app 載入與 refresh 時保證帳戶密碼、課程與資料庫全面同步)
  const loadSharedSettings = async () => {
    try {
      // 1. 從資料庫載入最新帳戶清單 (保證跨裝置密碼與帳號一致)
      const cloudAccounts = await loadAllAccountsFromCloud();
      setUsersList(cloudAccounts);

      // 若目前已登入用戶，自最新資料庫帳戶中刷新其資料 (保證即時同步最新修讀課程與密碼)
      if (currentUser) {
        const freshUser = cloudAccounts.find(
          (u) => u.username.toLowerCase() === currentUser.username.toLowerCase()
        );
        if (freshUser) {
          setCurrentUser(freshUser);
          try { localStorage.setItem('oc_current_user', JSON.stringify(freshUser)); } catch (e) {}
        }
      }

      // 2. 從 Appwrite 資料庫載入最新課程清單 (直接讀寫 courses/course 獨立表)
      const cloudCourses = await loadAllCoursesFromCloud();
      setCourses(cloudCourses);

      // 3. 讀取 Appwrite 雲端 homework_settings 表 (分校與班別設定)
      let loadedClasses: string[] = [];
      let loadedBranches: string[] = [];
      try {
        const settingsRes = await databases.listDocuments(
          DATABASE_ID,
          'homework_settings',
          [Query.limit(100)]
        );
        settingsRes.documents.forEach((doc: any) => {
          if (doc.setting_key === 'classes' && doc.setting_value) {
            try {
              const parsed = JSON.parse(doc.setting_value);
              if (Array.isArray(parsed) && parsed.length > 0) loadedClasses = parsed;
            } catch (e) {}
          } else if (doc.setting_key === 'branches' && doc.setting_value) {
            try {
              const parsed = JSON.parse(doc.setting_value);
              if (Array.isArray(parsed) && parsed.length > 0) loadedBranches = parsed;
            } catch (e) {}
          } else if (doc.setting_key === 'role_chat_permissions' && doc.setting_value) {
            try {
              const parsed = JSON.parse(doc.setting_value);
              if (parsed && typeof parsed === 'object') setRoleChatPermissions(parsed);
            } catch (e) {}
          }
        });
      } catch (e) {}

      if (loadedBranches.length > 0) setBranches(loadedBranches);
      if (loadedClasses.length > 0) setClasses(loadedClasses);

      // 4. 讀取 Appwrite 雲端行事曆事件 (calendar_events)
      try {
        const cloudEvents = await loadCalendarEventsFromCloud();
        if (cloudEvents && cloudEvents.length > 0) {
          setCalendarEvents(cloudEvents);
        }
      } catch (e) {}
    } catch (err: any) {
      console.warn('雲端資料庫初始化同步完成:', err.message);
    }
  };

  const saveSettingToCloud = async (key: string, value: any) => {
    const jsonStr = JSON.stringify(value);
    try {
      localStorage.setItem(`oc_settings_${key}`, jsonStr);
      const res = await databases.listDocuments(
        DATABASE_ID,
        'homework_settings',
        [Query.limit(100)]
      );
      const existingDoc = res.documents.find((d: any) => d.setting_key === key);
      if (existingDoc) {
        await databases.updateDocument(
          DATABASE_ID,
          'homework_settings',
          existingDoc.$id,
          { setting_value: jsonStr }
        );
      } else {
        await databases.createDocument(
          DATABASE_ID,
          'homework_settings',
          ID.unique(),
          { setting_key: key, setting_value: jsonStr }
        );
      }
    } catch (err: any) {
      console.warn(`設定寫入 homework_settings (${key}) 略過 (由本機保存):`, err.message);
    }
  };

  useEffect(() => {
    // 1. 本地快取防白屏
    try {
      const savedBranches = localStorage.getItem('oc_settings_branches');
      if (savedBranches) setBranches(JSON.parse(savedBranches));

      const savedCourses = localStorage.getItem('oc_settings_courses');
      if (savedCourses) setCourses(JSON.parse(savedCourses));

      const savedClasses = localStorage.getItem('oc_settings_classes');
      if (savedClasses) setClasses(JSON.parse(savedClasses));

      const savedRoleChat = localStorage.getItem('oc_settings_role_chat_permissions');
      if (savedRoleChat) {
        try {
          setRoleChatPermissions(JSON.parse(savedRoleChat));
        } catch (e) {}
      }

      const savedCalEvents = localStorage.getItem('oc_calendar_events');
      if (savedCalEvents) {
        try {
          setCalendarEvents(JSON.parse(savedCalEvents));
        } catch (e) {}
      }

      const savedUser = localStorage.getItem('oc_current_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        setCurrentUser(u);
      }

      const savedUsersList = localStorage.getItem('oc_users_list');
      if (savedUsersList) {
        const parsed = JSON.parse(savedUsersList);
        if (Array.isArray(parsed)) setUsersList(parsed);
      }
    } catch (e) {}

    // 2. 立即從 Appwrite 雲端載入最新帳戶、課程、班別與通告
    loadSharedSettings();
    loadNotices();
  }, []);

  // ⭐ 即時訊息未讀計數與即時同步 (依角色權限動態開關)
  useEffect(() => {
    if (!currentUser || !isCurrentUserChatEnabled) {
      setUnreadChatCount(0);
      return;
    }

    const refreshUnread = async () => {
      try {
        const count = await chatService.getTotalUnreadCount(currentUser.username);
        setUnreadChatCount(count);
      } catch (e) {
        console.warn('更新未讀計數失敗:', e);
      }
    };

    refreshUnread();

    // 定時 8 秒輪詢確保未讀紅點即時精確
    const timer = setInterval(refreshUnread, 8000);

    const unsub = chatService.subscribeToNewMessages(currentUser.username, () => {
      refreshUnread();
    });

    return () => {
      clearInterval(timer);
      unsub();
    };
  }, [currentUser, activeTab, isCurrentUserChatEnabled]);

  // ⭐ 若身分被暫停且處於即時訊息標籤，自動重導至首頁
  useEffect(() => {
    if (currentUser && !isCurrentUserChatEnabled && activeTab === 'msg') {
      setActiveTab('home');
    }
  }, [currentUser, isCurrentUserChatEnabled, activeTab]);


  const handleUpdateBranches = (newBranches: string[]) => {
    setBranches(newBranches);
    saveSettingToCloud('branches', newBranches);
  };

  // ⭐ 課程異動直接寫入 Appwrite courses/course 獨立資料表
  const handleUpdateCourses = async (newCourses: (string | CourseItem)[]) => {
    setCourses(newCourses);
    await saveAllCoursesToCloud(newCourses);
  };

  const handleUpdateClasses = (newClasses: string[]) => {
    setClasses(newClasses);
    saveSettingToCloud('classes', newClasses);
  };

  // --- 帳戶管理與登入/登出處理 ---
  const handleOpenAuth = (defaultTab: 'login' | 'register' = 'login') => {
    setAuthDefaultTab(defaultTab);
    setShowAuthModal(true);
  };

  // ⭐ 帳戶異動直接寫入 Appwrite 帳戶表及專屬 acc_* 備援
  const handleUpdateUsersList = async (newUsers: UserProfile[]) => {
    setUsersList(newUsers);
    await saveAllAccountsToCloud(newUsers);
    if (currentUser) {
      const freshUser = newUsers.find((u) => u.username.toLowerCase() === currentUser.username.toLowerCase());
      if (freshUser) {
        setCurrentUser(freshUser);
        try { localStorage.setItem('oc_current_user', JSON.stringify(freshUser)); } catch (e) {}
      }
    }
  };

  const handleLoginSuccess = (user: UserProfile) => {
    if (!user) return;
    setCurrentUser(user);
    try {
      localStorage.setItem('oc_current_user', JSON.stringify(user));
    } catch (e) {}
    setUsersList((prev) => {
      if (!user.username) return prev;
      if (!prev.some((u) => u && u.username && u.username.toLowerCase() === user.username.toLowerCase())) {
        const updated = [user, ...prev];
        try { localStorage.setItem('oc_users_list', JSON.stringify(updated)); } catch (e) {}
        return updated;
      }
      return prev;
    });
  };

  const handleRegisterSuccess = async (user: UserProfile) => {
    const updated = [...usersList, user];
    setUsersList(updated);
    setCurrentUser(user);
    try {
      localStorage.setItem('oc_users_list', JSON.stringify(updated));
      localStorage.setItem('oc_current_user', JSON.stringify(user));
    } catch (e) {}
    await saveAllAccountsToCloud(updated);
  };

  // ⭐ 帳戶登出後跳回首頁
  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('oc_current_user');
    } catch (e) {}
    setActiveTab('home');
  };

  const loadNotices = async () => {
    setLoading(true);
    try {
      const res = await databases.listDocuments(DATABASE_ID, 'notices');
      setNotices(res.documents);
    } catch (err) {
      console.log('載入通告中:', err);
    } finally {
      setLoading(false);
    }
  };

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'home': return '智能網上教室';
      case 'msg': return '即時訊息 · 一對一諮詢';
      case 'members': return '會員目錄';
      case 'courses': return currentUser?.role === 'student' ? '我的課程' : '課程管理';
      case 'attendance': return '課程點名';
      case 'more': return '更多';
      default: return 'Online-Classroom';
    }
  };

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-2xl relative pb-20">
        <Header
          title={getHeaderTitle()}
          currentUser={currentUser}
          onOpenAuth={() => handleOpenAuth('login')}
          onLogout={handleLogout}
          onOpenChat={isCurrentUserChatEnabled ? () => setActiveTab('msg') : undefined}
          unreadChatCount={isCurrentUserChatEnabled ? unreadChatCount : 0}
        />

        {/* ⭐ 首頁視窗：登入介紹、開始使用入口、5大身分說明與快捷工作區 */}
        {activeTab === 'home' && (
          <HomeView
            currentUser={currentUser}
            onOpenAuth={() => handleOpenAuth('login')}
            onLogout={handleLogout}
            onNavigateTab={setActiveTab}
            onOpenNotices={() => setShowNoticeModal(true)}
            onOpenCalendar={() => setShowCalendarModal(true)}
            onOpenSetup={() => setShowSetupModal(true)}
            onOpenAccountMgmt={() => handleOpenAccountMgmt('issue')}
            onOpenStudentHomework={handleOpenStudentHomework}
            noticeCount={notices.length}
            courseCount={visibleCourses.length}
            memberCount={0}
          />
        )}

        {activeTab === 'more' && (
          <MoreView
            noticeCount={notices.length}
            onOpenNotices={() => setShowNoticeModal(true)}
            onOpenCalendar={() => setShowCalendarModal(true)}
            onOpenSetup={() => setShowSetupModal(true)}
            onOpenAccountMgmt={handleOpenAccountMgmt}
            currentUser={currentUser}
            onOpenAuth={handleOpenAuth}
            onLogout={handleLogout}
          />
        )}

        {/* ⭐ 課程目錄：以帳戶為核心，學生只看自己修讀的課程 */}
        {activeTab === 'courses' && (
          <div className="flex-1 w-full bg-[#F8F9FA] flex flex-col overflow-hidden pb-16">
            <HomeworkSetupModal
              isOpen={true}
              isInline={true}
              mode="courses_only"
              branches={branches}
              classes={classes}
              courses={visibleCourses}
              usersList={usersList}
              onUpdateUsersList={handleUpdateUsersList}
              onUpdateBranches={handleUpdateBranches}
              onUpdateClasses={handleUpdateClasses}
              onUpdateCourses={handleUpdateCourses}
              onOpenCourseContent={handleOpenCourseContent}
              isReadOnly={isStudentOrParent}
              currentUser={currentUser}
            />
          </div>
        )}

        {/* ⭐ 會員目錄：只保留現有會員 (滿板顯示，支援與帳戶中心即時雙向同步) */}
        {activeTab === 'members' && (
          <div className="flex-1 w-full bg-[#F8F9FA] flex flex-col overflow-hidden pb-16">
            <ClassManagementModal
              isOpen={true}
              isInline={true}
              branches={branches}
              classes={classes}
              courses={courseNames}
              courseItems={courses}
              usersList={usersList}
              onUpdateUsersList={handleUpdateUsersList}
              onOpenCourseContent={handleOpenCourseContent}
            />
          </div>
        )}

        {/* ⭐ 課程點名：底部導航滿板顯示 */}
        {activeTab === 'attendance' && (
          <div className="flex-1 w-full bg-[#F8F9FA] flex flex-col overflow-hidden pb-16">
            <AttendanceModal
              isOpen={true}
              isInline={true}
              branches={branches}
              classes={classes}
              courses={courseNames}
              courseItems={courses}
            />
          </div>
        )}

        {activeTab === 'msg' && (
          <div className="flex-1 w-full bg-[#F8F9FA] flex flex-col overflow-hidden pb-16">
            {!isCurrentUserChatEnabled ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white min-h-[60vh]">
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mb-4 border border-amber-200 shadow-xs">
                  <MessageCircle size={32} />
                </div>
                <h3 className="text-base font-extrabold text-gray-800 mb-2">即時訊息功能暫停開放</h3>
                <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-6">
                  目前【{ROLE_CONFIGS[currentUser?.role || 'student']?.label || currentUser?.role}】帳戶之即時訊息功能已由系統管理員暫停開放。如有課程、請假或行政查詢，請透過校方電話或官方途徑聯繫，敬請理解。
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('home')}
                  className="px-5 py-2.5 bg-[#FF6B57] text-white text-xs font-bold rounded-xl shadow-xs hover:opacity-95 transition-all"
                >
                  返回首頁
                </button>
              </div>
            ) : (
              <ChatView
                currentUser={currentUser}
                usersList={usersList}
                courses={courses}
                initialTargetUser={chatTargetUser}
                onOpenAuth={() => handleOpenAuth('login')}
                roleChatPermissions={roleChatPermissions}
              />
            )}
          </div>
        )}

        {currentUser && <BottomNav activeTab={activeTab} onTabChange={setActiveTab} userRole={currentUser?.role} unreadChatCount={unreadChatCount} isChatEnabled={isCurrentUserChatEnabled} />}

        {/* 1. 電子通告彈窗 */}
        <NoticeModal
          isOpen={showNoticeModal}
          onClose={() => setShowNoticeModal(false)}
          notices={notices}
          loading={loading}
        />

        {/* 2. 第一層目錄：課程內容彈窗 (學生/家長唯讀並提供交功課功能，支援直接顯示單元家課) */}
        <CourseContentModal
          isOpen={showCourseContentModal}
          onClose={() => {
            setShowCourseContentModal(false);
            setCourseModalInitialCourse('');
            setCourseModalInitialBranch('');
            setCourseModalInitialTab('units');
            setCourseModalIsLocked(false);
          }}
          branches={branches}
          courses={courseNames}
          classes={classes}
          courseItems={visibleCourses}
          initialCourse={courseModalInitialCourse}
          initialBranch={courseModalInitialBranch}
          initialTab={courseModalInitialTab}
          isLocked={courseModalIsLocked}
          isReadOnly={isStudentOrParent}
          currentUser={currentUser}
        />

        {/* 3. 獨立家課彈窗 (備用向下相容) */}
        <HomeworkModal
          isOpen={showHomeworkModal}
          onClose={() => setShowHomeworkModal(false)}
          branches={branches}
          courses={courseNames}
        />

        {/* 4. 活動 / 課程點名彈窗 */}
        {showAttendanceModal && (
          <AttendanceModal
            isOpen={true}
            onClose={() => setShowAttendanceModal(false)}
            branches={branches}
            classes={classes}
            courses={courseNames}
            courseItems={courses}
          />
        )}

        {/* 5. 會員目錄 (班級學生名冊) */}
        {showClassModal && (
          <ClassManagementModal
            isOpen={true}
            onClose={() => setShowClassModal(false)}
            branches={branches}
            classes={classes}
            courses={courseNames}
            courseItems={courses}
            usersList={usersList}
            onUpdateUsersList={handleUpdateUsersList}
          />
        )}

        {/* 6. ⭐ 設定按鍵彈窗 (從「更多」設定開啟：只保留學校/分校及班別設定) */}
        {showSetupModal && (
          <HomeworkSetupModal
            isOpen={true}
            mode="settings_only"
            onClose={() => setShowSetupModal(false)}
            branches={branches}
            classes={classes}
            courses={courses}
            usersList={usersList}
            onUpdateUsersList={handleUpdateUsersList}
            onUpdateBranches={handleUpdateBranches}
            onUpdateClasses={handleUpdateClasses}
            onUpdateCourses={handleUpdateCourses}
          />
        )}

        {/* 7. ⭐ 應用程式登入系統彈窗 (8位數字密碼安全驗證 · 由管理員統一派發) */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultTab={authDefaultTab}
          branches={branches}
          classes={classes}
          currentUser={currentUser}
          usersList={usersList}
          onLoginSuccess={handleLoginSuccess}
          onRegisterSuccess={handleRegisterSuccess}
          onLogout={handleLogout}
          onVerifyLogin={directLoginFromCloud}
        />

        {/* 8. 👑 系統管理員專屬：帳戶管理與派發中心 (統一派發5大身分帳號) */}
        {showAccountMgmtModal && (
          <AccountManagementModal
            isOpen={true}
            onClose={() => setShowAccountMgmtModal(false)}
            branches={branches}
            classes={classes}
            courses={courses}
            courseNames={courseNames}
            currentUser={currentUser}
            usersList={usersList}
            onUpdateUsersList={handleUpdateUsersList}
            initialTab={accountMgmtInitialTab}
            roleChatPermissions={roleChatPermissions}
            onUpdateRoleChatPermissions={handleUpdateRoleChatPermissions}
          />
        )}

        {/* 9. 📅 學校校曆與行事曆彈窗 */}
        <CalendarModal
          isOpen={showCalendarModal}
          onClose={() => setShowCalendarModal(false)}
          currentUser={currentUser}
          branches={branches}
          classes={classes}
          courses={courses}
          courseNames={courseNames}
          calendarEvents={calendarEvents}
          onSaveEvent={handleSaveCalendarEvent}
          onDeleteEvent={handleDeleteCalendarEvent}
        />
      </div>
    </div>
  );
}
