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

  // 從本地快取或 Appwrite 載入設定（主動偵測並清除舊版殘留之 dummy 假資料）
  useEffect(() => {
    try {
      const dummyBranches = ['馬耀山靈糧幼稚園', '沙田分校', '九龍灣分校', '總校'];
      const dummyCourses = ['合唱團 (12:50-13:30)', '小結他班', '幼兒常規班', '奧數思維班'];
      const dummyClasses = ['上高乙', '3A', '3B', '4A', '4B'];

      const savedBranches = localStorage.getItem('oc_settings_branches');
      if (savedBranches) {
        const parsed = JSON.parse(savedBranches);
        if (JSON.stringify(parsed) === JSON.stringify(dummyBranches)) {
          localStorage.removeItem('oc_settings_branches');
          setBranches([]);
        } else {
          setBranches(parsed);
        }
      }
      const savedCourses = localStorage.getItem('oc_settings_courses');
      if (savedCourses) {
        const parsed = JSON.parse(savedCourses);
        if (JSON.stringify(parsed) === JSON.stringify(dummyCourses)) {
          localStorage.removeItem('oc_settings_courses');
          setCourses([]);
        } else {
          setCourses(parsed);
        }
      }
      const savedClasses = localStorage.getItem('oc_settings_classes');
      if (savedClasses) {
        const parsed = JSON.parse(savedClasses);
        if (JSON.stringify(parsed) === JSON.stringify(dummyClasses)) {
          localStorage.removeItem('oc_settings_classes');
          setClasses([]);
        } else {
          setClasses(parsed);
        }
      }
localStorage.removeItem('oc_settings_presets');
    } catch (e) {}

    loadNotices();
  }, []);

  const handleUpdateBranches = (newBranches: string[]) => {
    setBranches(newBranches);
    try {
      localStorage.setItem('oc_settings_branches', JSON.stringify(newBranches));
    } catch (e) {}
  };

  const handleUpdateCourses = (newCourses: (string | CourseItem)[]) => {
    setCourses(newCourses);
    try {
      localStorage.setItem('oc_settings_courses', JSON.stringify(newCourses));
    } catch (e) {}
  };

  const handleUpdateClasses = (newClasses: string[]) => {
    setClasses(newClasses);
    try {
      localStorage.setItem('oc_settings_classes', JSON.stringify(newClasses));
    } catch (e) {}
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
