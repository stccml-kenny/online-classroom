'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { BottomNav, TabType } from '@/components/layout/BottomNav';
import { MoreView } from '@/components/more/MoreView';
import { NoticeModal } from '@/components/notices/NoticeModal';
import { HomeworkModal } from '@/components/homework/HomeworkModal';
import { CourseContentModal } from '@/components/curriculum/CourseContentModal';
import { AttendanceModal } from '@/components/attendance/AttendanceModal';
import { ClassManagementModal } from '@/components/classes/ClassManagementModal';
import { HomeworkSetupModal, CourseItem } from '@/components/homework/HomeworkSetupModal';
import { AuthModal, UserProfile } from '@/components/auth/AuthModal';
import { HomeView } from '@/components/home/HomeView';
import { AccountManagementModal } from '@/components/admin/AccountManagementModal';
import { databases, DATABASE_ID } from '@/lib/appwrite';
import { ID, Query } from 'appwrite';

export default function OnlineClassroomApp() {
  // ⭐ 需求：首頁要有開始使用，之後要求登入帳戶，預設進入首頁 (home)
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // ⭐ 用戶登記與登入狀態管理 (支援 5 大角色與 8 位數字密碼)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<'login' | 'register'>('login');
  const [showAccountMgmtModal, setShowAccountMgmtModal] = useState<boolean>(false);

  const [showNoticeModal, setShowNoticeModal] = useState(false);
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

  // ⭐ 全域共享之學校/分校、課程、班別及功課範本資料（已移除所有 dummy 假資料，初始為乾淨空白）
  const [branches, setBranches] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [courses, setCourses] = useState<(string | CourseItem)[]>([]);

  const isStudentOrParent = currentUser?.role === 'student' || currentUser?.role === 'parent';

  // ⭐ 需求：家長及學生賬戶只可顯示自己的課程 (學生依所屬分校與班別過濾；家長依所關聯之多個子女帳號過濾)
  const visibleCourses = React.useMemo(() => {
    if (!currentUser || !isStudentOrParent) {
      return courses;
    }

    let targetBranches: string[] = [];
    let targetClasses: string[] = [];

    if (currentUser.role === 'parent') {
      const linkedUsernames = (currentUser.childrenUsernames || []).map((u) => u.trim().toLowerCase());
      const matchedChildren = usersList.filter((u) =>
        linkedUsernames.includes((u.username || '').toLowerCase()) ||
        (currentUser.childName && u.name === currentUser.childName)
      );

      matchedChildren.forEach((child) => {
        if (child.branch && child.branch.trim()) targetBranches.push(child.branch.trim().toLowerCase());
        if (child.className && child.className.trim()) targetClasses.push(child.className.trim().toLowerCase());
      });

      if (targetBranches.length === 0 && currentUser.branch) targetBranches.push(currentUser.branch.trim().toLowerCase());
      if (targetClasses.length === 0 && currentUser.className) targetClasses.push(currentUser.className.trim().toLowerCase());
    } else {
      if (currentUser.branch) targetBranches.push(currentUser.branch.trim().toLowerCase());
      if (currentUser.className) targetClasses.push(currentUser.className.trim().toLowerCase());
    }

    return courses.filter((c) => {
      const cItem: CourseItem | null = typeof c === 'object' && c !== null ? (c as CourseItem) : null;
      const cBranch = (cItem ? cItem.branch || '' : '').trim().toLowerCase();
      
      const branchMatch = !cBranch || cBranch === '全部分校' || targetBranches.length === 0 || targetBranches.some((tb) => cBranch.includes(tb) || tb.includes(cBranch));
      if (!branchMatch) return false;

      if (cItem && cItem.targetClasses && cItem.targetClasses.length > 0) {
        const hasValidTarget = targetClasses.some((tc) => tc !== '全體' && tc !== '全校');
        if (hasValidTarget) {
          return cItem.targetClasses.some((tc) => targetClasses.includes(tc.trim().toLowerCase()));
        }
      }
      return true;
    });
  }, [courses, currentUser, usersList, isStudentOrParent]);

  // ⭐ 輔助取得純字串課程名稱清單供全域選單使用：格式為「課程名稱 + (課程時間)」，並嚴格去重防 key 衝突
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

  // ⭐ 從 Appwrite homework_settings 表動態讀取雲端學校、課程、班別設定 (具備本地快取保護防消失機制)
  const loadSharedSettings = async () => {
    try {
      let loadedCourses: any[] = [];
      let loadedClasses: string[] = [];
      let loadedBranches: string[] = [];
      let cloudCoursesFound = false;
      let cloudClassesFound = false;
      let cloudBranchesFound = false;

      // 讀取 Appwrite 雲端 homework_settings 表
      try {
        const settingsRes = await databases.listDocuments(
          DATABASE_ID,
          'homework_settings',
          [Query.limit(100)]
        );

        settingsRes.documents.forEach((doc: any) => {
          try {
            if (doc.setting_key === 'courses' && doc.setting_value) {
              const parsed = JSON.parse(doc.setting_value);
              if (Array.isArray(parsed)) {
                loadedCourses = parsed;
                cloudCoursesFound = true;
              }
            } else if (doc.setting_key === 'classes' && doc.setting_value) {
              const parsed = JSON.parse(doc.setting_value);
              if (Array.isArray(parsed)) {
                loadedClasses = parsed;
                cloudClassesFound = true;
              }
            } else if (doc.setting_key === 'branches' && doc.setting_value) {
              const parsed = JSON.parse(doc.setting_value);
              if (Array.isArray(parsed)) {
                loadedBranches = parsed;
                cloudBranchesFound = true;
              }
            } else if (doc.setting_key === 'user_accounts' && doc.setting_value) {
              const parsed = JSON.parse(doc.setting_value);
              if (Array.isArray(parsed)) {
                const cleaned = parsed.filter((u: any) => !['teacher_chen', 'ta_wong', 'student_lok', 'parent_lok'].includes((u.username || '').toLowerCase()));
                setUsersList(cleaned);
                try { localStorage.setItem('oc_users_list', JSON.stringify(cleaned)); } catch (e) {}
              }
            }
          } catch (pe) {}
        });
      } catch (err: any) {
        console.warn('讀取 homework_settings 略過或表尚未建立:', err.message);
      }

      // ⭐ 關鍵防丟保護：讀取本地 localStorage 資料
      let localCourses: any[] = [];
      try {
        const saved = localStorage.getItem('oc_settings_courses');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) localCourses = parsed;
        }
      } catch (e) {}

      let localBranches: string[] = [];
      try {
        const saved = localStorage.getItem('oc_settings_branches');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) localBranches = parsed;
        }
      } catch (e) {}

      let localClasses: string[] = [];
      try {
        const saved = localStorage.getItem('oc_settings_classes');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) localClasses = parsed;
        }
      } catch (e) {}

      // ⭐ 整合課程：若雲端有課程則合併本地；若雲端無課程但本地有則保留本地並補同步
      let rawCourses: any[] = [];
      if (cloudCoursesFound && loadedCourses.length > 0) {
        rawCourses = [...loadedCourses];
        localCourses.forEach((lc) => {
          const lcName = (typeof lc === 'string' ? lc : lc.name || '').trim();
          const lcBranch = (typeof lc === 'object' ? lc.branch || '' : '').trim();
          const lcTime = (typeof lc === 'object' ? lc.timeSlot || '' : '').trim();
          const exists = rawCourses.some((fc) => {
            const fcName = (typeof fc === 'string' ? fc : fc.name || '').trim();
            const fcBranch = (typeof fc === 'object' ? fc.branch || '' : '').trim();
            const fcTime = (typeof fc === 'object' ? fc.timeSlot || '' : '').trim();
            return (
              fcName.toLowerCase() === lcName.toLowerCase() &&
              fcBranch.toLowerCase() === lcBranch.toLowerCase() &&
              fcTime === lcTime
            );
          });
          if (!exists && lcName) rawCourses.push(lc);
        });
      } else if (localCourses.length > 0) {
        rawCourses = localCourses;
        saveSettingToCloud('courses', rawCourses);
      } else {
        rawCourses = loadedCourses;
      }

      // 精準去重：依「學校 + 時段 + 課程名稱」進行唯一判定，允許同名但在不同分校或不同時段的課程並存
      const uniqueCourses: any[] = [];
      const seenCourseKeys = new Set<string>();
      rawCourses.forEach((c) => {
        const name = (typeof c === 'string' ? c : c.name || '').trim();
        const branch = (typeof c === 'object' ? c.branch || '' : '').trim();
        const timeSlot = (typeof c === 'object' ? c.timeSlot || '' : '').trim();
        const key = `${branch.toLowerCase()}:::${timeSlot}:::${name.toLowerCase()}`;
        if (name && !seenCourseKeys.has(key)) {
          seenCourseKeys.add(key);
          uniqueCourses.push(c);
        }
      });

      // 整合學校/分校與班別
      let finalBranches: string[] = [];
      if (cloudBranchesFound && loadedBranches.length > 0) {
        finalBranches = Array.from(new Set([...loadedBranches, ...localBranches].map((b) => (typeof b === 'string' ? b.trim() : b)).filter(Boolean)));
      } else if (localBranches.length > 0) {
        finalBranches = localBranches;
        saveSettingToCloud('branches', finalBranches);
      } else {
        finalBranches = loadedBranches;
      }

      let finalClasses: string[] = [];
      if (cloudClassesFound && loadedClasses.length > 0) {
        finalClasses = Array.from(new Set([...loadedClasses, ...localClasses].map((c) => (typeof c === 'string' ? c.trim() : c)).filter(Boolean)));
      } else if (localClasses.length > 0) {
        finalClasses = localClasses;
        saveSettingToCloud('classes', finalClasses);
      } else {
        finalClasses = loadedClasses;
      }

      // 更新全域狀態與本地快取
      setBranches(finalBranches);
      try { localStorage.setItem('oc_settings_branches', JSON.stringify(finalBranches)); } catch (e) {}

      setClasses(finalClasses);
      try { localStorage.setItem('oc_settings_classes', JSON.stringify(finalClasses)); } catch (e) {}

      setCourses(uniqueCourses);
      try { localStorage.setItem('oc_settings_courses', JSON.stringify(uniqueCourses)); } catch (e) {}
    } catch (err: any) {
      console.warn('同步全域設定中:', err.message);
    }
  };

  // 將設定即時同步保存至 Appwrite homework_settings 表與本地快取
  const saveSettingToCloud = async (key: string, value: any) => {
    const jsonStr = JSON.stringify(value);
    try {
      localStorage.setItem(`oc_settings_${key}`, jsonStr);
      // ⭐ 關鍵修復：改用 limit(100) 獲取全部設定，避免 Query.equal('setting_key', ...) 因 Appwrite 索引未建立而報錯中斷
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
    // 1. 先讀取本地快取防白屏
    try {
      const savedBranches = localStorage.getItem('oc_settings_branches');
      if (savedBranches) setBranches(JSON.parse(savedBranches));

      const savedCourses = localStorage.getItem('oc_settings_courses');
      if (savedCourses) setCourses(JSON.parse(savedCourses));

      const savedClasses = localStorage.getItem('oc_settings_classes');
      if (savedClasses) setClasses(JSON.parse(savedClasses));

      const savedUser = localStorage.getItem('oc_current_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (['teacher_chen', 'ta_wong', 'student_lok', 'parent_lok'].includes((u.username || '').toLowerCase())) {
          localStorage.removeItem('oc_current_user');
        } else {
          setCurrentUser(u);
        }
      }

      const savedUsersList = localStorage.getItem('oc_users_list');
      if (savedUsersList) {
        const parsed = JSON.parse(savedUsersList);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((u: any) => !['teacher_chen', 'ta_wong', 'student_lok', 'parent_lok'].includes((u.username || '').toLowerCase()));
          setUsersList(cleaned);
        }
      }

      localStorage.removeItem('oc_settings_presets');
    } catch (e) {}

    // 2. 立即從 Appwrite 雲端載入最新學校、課程、班別與通告
    loadSharedSettings();
    loadNotices();
  }, []);

  const handleUpdateBranches = (newBranches: string[]) => {
    setBranches(newBranches);
    saveSettingToCloud('branches', newBranches);
  };

  const handleUpdateCourses = (newCourses: (string | CourseItem)[]) => {
    setCourses(newCourses);
    saveSettingToCloud('courses', newCourses);
  };

  const handleUpdateClasses = (newClasses: string[]) => {
    setClasses(newClasses);
    saveSettingToCloud('classes', newClasses);
  };

  // --- 帳戶驗證與登入/登出處理 ---
  const handleOpenAuth = (defaultTab: 'login' | 'register' = 'login') => {
    setAuthDefaultTab(defaultTab);
    setShowAuthModal(true);
  };

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('oc_current_user', JSON.stringify(user));
    } catch (e) {}
  };

  const handleRegisterSuccess = (user: UserProfile) => {
    const updated = [...usersList, user];
    setUsersList(updated);
    setCurrentUser(user);
    try {
      localStorage.setItem('oc_users_list', JSON.stringify(updated));
      localStorage.setItem('oc_current_user', JSON.stringify(user));
    } catch (e) {}
    saveSettingToCloud('user_accounts', updated);
  };

  // ⭐ 需求 6：帳戶登出後跳回首頁
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
      case 'msg': return '即時訊息';
      case 'members': return '會員目錄';
      case 'courses': return '課程管理';
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
        />

        {/* ⭐ 首頁視窗：登入介紹、開始使用入口、5大身分說明與快捷工作區 */}
        {activeTab === 'home' && (
          <HomeView
            currentUser={currentUser}
            onOpenAuth={() => handleOpenAuth('login')}
            onLogout={handleLogout}
            onNavigateTab={setActiveTab}
            onOpenNotices={() => setShowNoticeModal(true)}
            onOpenSetup={() => setShowSetupModal(true)}
            onOpenAccountMgmt={() => setShowAccountMgmtModal(true)}
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
            onOpenSetup={() => setShowSetupModal(true)}
            onOpenAccountMgmt={() => setShowAccountMgmtModal(true)}
            currentUser={currentUser}
            onOpenAuth={handleOpenAuth}
            onLogout={handleLogout}
          />
        )}

        {/* ⭐ 課程目錄：滿板顯示 (學生/家長唯讀且只顯示自己的課程，顯示已參加學生人數) */}
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
              onUpdateUsersList={(newUsers) => {
                setUsersList(newUsers);
                try { localStorage.setItem('oc_users_list', JSON.stringify(newUsers)); } catch (e) {}
                saveSettingToCloud('user_accounts', newUsers);
              }}
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


        {activeTab === 'msg' && <div className="p-5 text-center text-gray-400">即時訊息模組開發中</div>}

        {currentUser && <BottomNav activeTab={activeTab} onTabChange={setActiveTab} userRole={currentUser?.role} />}

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
        <AttendanceModal
          isOpen={showAttendanceModal}
          onClose={() => setShowAttendanceModal(false)}
          branches={branches}
          classes={classes}
          courses={courseNames}
          courseItems={courses}
        />

        {/* 5. 會員目錄 (班級學生名冊) */}
        <ClassManagementModal
          isOpen={showClassModal}
          onClose={() => setShowClassModal(false)}
          branches={branches}
          classes={classes}
          courses={courseNames}
          courseItems={courses}
        />

        {/* 6. ⭐ 設定按鍵彈窗 (從「更多」設定開啟：只保留學校/分校及班別設定) */}
        <HomeworkSetupModal
          isOpen={showSetupModal}
          mode="settings_only"
          onClose={() => setShowSetupModal(false)}
          branches={branches}
          classes={classes}
          courses={courses}
          onUpdateBranches={handleUpdateBranches}
          onUpdateClasses={handleUpdateClasses}
          onUpdateCourses={handleUpdateCourses}
        />

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
        />

        {/* 8. 👑 系統管理員專屬：帳戶管理與派發中心 (統一派發5大身分帳號) */}
        <AccountManagementModal
          isOpen={showAccountMgmtModal}
          onClose={() => setShowAccountMgmtModal(false)}
          branches={branches}
          classes={classes}
          courses={courses}
          courseNames={courseNames}
          currentUser={currentUser}
          usersList={usersList}
          onUpdateUsersList={(newUsers) => {
            setUsersList(newUsers);
            try { localStorage.setItem('oc_users_list', JSON.stringify(newUsers)); } catch (e) {}
            saveSettingToCloud('user_accounts', newUsers);
          }}
        />
      </div>
    </div>
  );
}
