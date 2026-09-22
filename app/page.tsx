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
import { databases, DATABASE_ID } from '@/lib/appwrite';
import { ID, Query } from 'appwrite';

export default function OnlineClassroomApp() {
  const [activeTab, setActiveTab] = useState<TabType>('more');
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showHomeworkModal, setShowHomeworkModal] = useState(false);
  const [showCourseContentModal, setShowCourseContentModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);

  // ⭐ 全域共享之學校/分校、課程、班別及功課範本資料（已移除所有 dummy 假資料，初始為乾淨空白）
  const [branches, setBranches] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [courses, setCourses] = useState<(string | CourseItem)[]>([]);

  // ⭐ 需求 2：輔助取得純字串課程名稱清單供全域選單使用：格式為「課程名稱 + (課程時間)」
  const courseNames = courses.map((c) => {
    if (typeof c === 'string') return c;
    if (c.timeSlot && c.timeSlot.trim()) {
      const slot = c.timeSlot.trim();
      if (c.name.includes(slot)) return c.name;
      return `${c.name} (${slot})`;
    }
    return c.name;
  });

  // ⭐ 從 Appwrite homework_settings 與 students 表動態讀取雲端學校、課程、班別設定
  const loadSharedSettings = async () => {
    try {
      let loadedCourses: any[] = [];
      let loadedClasses: string[] = [];
      let loadedBranches: string[] = [];

      // 1. 讀取 Appwrite 雲端 homework_settings 表
      try {
        const settingsRes = await databases.listDocuments(
          DATABASE_ID,
          'homework_settings',
          [Query.limit(50)]
        );

        settingsRes.documents.forEach((doc: any) => {
          try {
            if (doc.setting_key === 'courses' && doc.setting_value) {
              const parsed = JSON.parse(doc.setting_value);
              if (Array.isArray(parsed)) loadedCourses = parsed;
            } else if (doc.setting_key === 'classes' && doc.setting_value) {
              const parsed = JSON.parse(doc.setting_value);
              if (Array.isArray(parsed)) loadedClasses = parsed;
            } else if (doc.setting_key === 'branches' && doc.setting_value) {
              const parsed = JSON.parse(doc.setting_value);
              if (Array.isArray(parsed)) loadedBranches = parsed;
            }
          } catch (pe) {}
        });
      } catch (err: any) {
        console.warn('讀取 homework_settings 略過或表尚未建立:', err.message);
      }

      // 2. 亦同步整合 students 表已登記之分校、班別與課程 (保證 100% 完整)
      try {
        const studentsRes = await databases.listDocuments(
          DATABASE_ID,
          'students',
          [Query.limit(500)]
        );

        const studentBranches = studentsRes.documents.map((d: any) => d.branch).filter(Boolean);
        const studentClasses = studentsRes.documents.map((d: any) => d.class_name).filter(Boolean);
        const studentCourses = studentsRes.documents.map((d: any) => d.course_name).filter(Boolean);

        if (studentBranches.length > 0) {
          loadedBranches = Array.from(new Set([...loadedBranches, ...studentBranches]));
        }
        if (studentClasses.length > 0) {
          loadedClasses = Array.from(new Set([...loadedClasses, ...studentClasses]));
        }
        if (studentCourses.length > 0) {
          const existingNames = loadedCourses.map((c) => (typeof c === 'string' ? c : c.name));
          studentCourses.forEach((sc) => {
            if (!existingNames.includes(sc)) {
              loadedCourses.push(sc);
            }
          });
        }
      } catch (e) {}

      // 更新全域狀態與本地快取
      if (loadedBranches.length > 0) {
        setBranches(loadedBranches);
        try { localStorage.setItem('oc_settings_branches', JSON.stringify(loadedBranches)); } catch (e) {}
      }
      if (loadedClasses.length > 0) {
        setClasses(loadedClasses);
        try { localStorage.setItem('oc_settings_classes', JSON.stringify(loadedClasses)); } catch (e) {}
      }
      if (loadedCourses.length > 0) {
        setCourses(loadedCourses);
        try { localStorage.setItem('oc_settings_courses', JSON.stringify(loadedCourses)); } catch (e) {}
      }
    } catch (err: any) {
      console.warn('同步全域設定中:', err.message);
    }
  };

  // 將設定即時同步保存至 Appwrite homework_settings 表與本地快取
  const saveSettingToCloud = async (key: string, value: any) => {
    const jsonStr = JSON.stringify(value);
    try {
      localStorage.setItem(`oc_settings_${key}`, jsonStr);
      const res = await databases.listDocuments(
        DATABASE_ID,
        'homework_settings',
        [Query.equal('setting_key', key)]
      );
      if (res.documents.length > 0) {
        await databases.updateDocument(
          DATABASE_ID,
          'homework_settings',
          res.documents[0].$id,
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
      case 'home': return '首頁';
      case 'msg': return '即時訊息';
      case 'staff': return '職員通告';
      case 'email': return '電郵';
      case 'more': return '更多';
      default: return 'ONLINE CLASSROOM';
    }
  };

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-2xl relative pb-20">
        <Header title={getHeaderTitle()} />

        {activeTab === 'more' && (
          <MoreView
            noticeCount={notices.length}
            onOpenNotices={() => setShowNoticeModal(true)}
            onOpenHomework={() => setShowCourseContentModal(true)}
            onOpenCourseContent={() => setShowCourseContentModal(true)}
            onOpenSetup={() => setShowSetupModal(true)} // ⭐ 補回第一層設定入口
            onOpenAttendance={() => setShowAttendanceModal(true)}
            onOpenClasses={() => setShowClassModal(true)}
          />
        )}

        {activeTab === 'home' && <div className="p-5 text-center text-gray-400">首頁模組開發中</div>}
        {activeTab === 'msg' && <div className="p-5 text-center text-gray-400">即時訊息模組開發中</div>}
        {activeTab === 'staff' && <div className="p-5 text-center text-gray-400">職員通告模組開發中</div>}
        {activeTab === 'email' && <div className="p-5 text-center text-gray-400">電郵模組開發中</div>}

        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

        {/* 1. 電子通告彈窗 */}
        <NoticeModal
          isOpen={showNoticeModal}
          onClose={() => setShowNoticeModal(false)}
          notices={notices}
          loading={loading}
        />

        {/* 2. 第一層目錄：課程內容彈窗 (整合單元教材、單元家課與右上角設定齒輪) */}
        <CourseContentModal
          isOpen={showCourseContentModal}
          onClose={() => setShowCourseContentModal(false)}
          branches={branches}
          courses={courseNames}
          classes={classes}
          courseItems={courses}
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
        />

        {/* 6. ⭐ 課程、學校及班別設定彈窗 (可從 More 目錄或課程內容右上角齒輪開啟) */}
        <HomeworkSetupModal
          isOpen={showSetupModal}
          onClose={() => setShowSetupModal(false)}
          branches={branches}
          classes={classes}
          courses={courses}
          onUpdateBranches={handleUpdateBranches}
          onUpdateClasses={handleUpdateClasses}
          onUpdateCourses={handleUpdateCourses}
        />
      </div>
    </div>
  );
}
