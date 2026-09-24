import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Plus, GraduationCap, BookOpen, Calendar, Edit2, Trash2, Download, FileText, Music, Video, Play, Pause, ExternalLink, CheckCircle2, Clock, Eye, Layers, Unlink, ChevronDown, ChevronUp, CheckSquare, Square, Edit3
} from 'lucide-react';
import { CourseUnit, CourseUnitFormModal } from './CourseUnitFormModal';
import { HomeworkCard, HomeworkItem, HomeworkAttachment, extractYoutubeId, getGoogleLinkMeta, YoutubeIcon, getHomeworkPublishStatus } from '../homework/HomeworkCard';
import { HomeworkFormModal } from '../homework/HomeworkFormModal';
import { UnitHomeworkSelectModal } from './UnitHomeworkSelectModal';
import { BatchEditModal } from './BatchEditModal';
import { CourseItem, getCourseDisplayName } from '../homework/HomeworkSetupModal';
import { databases, DATABASE_ID } from '@/lib/appwrite';
import { ID, Query } from 'appwrite';
import { getLocalFile } from '@/utils/indexedDB';

interface CourseContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: string[];
  courses: string[];
  classes?: string[];
  courseItems?: (string | CourseItem)[];
  initialCourse?: string; // ⭐ 預選課程
  initialBranch?: string; // ⭐ 預選分校
}

export type PublishStatusType = 'published' | 'scheduled' | 'pending' | 'unpublished';

// 輔助函式：判斷單元或家課之「上架/預排/待安排/下架」狀態
export const checkPublishStatus = (
  publishDate?: string,
  unpublishDate?: string
): { status: PublishStatusType; label: string; badgeClass: string } => {
  const today = new Date().toISOString().split('T')[0];

  if (!publishDate || !publishDate.trim()) {
    return {
      status: 'pending',
      label: '有待安排 (待排程)',
      badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200',
    };
  }

  if (unpublishDate && unpublishDate.trim() && today > unpublishDate) {
    return {
      status: 'unpublished',
      label: `已下架 (${unpublishDate})`,
      badgeClass: 'bg-gray-100 text-gray-500 border border-gray-200',
    };
  }

  if (today < publishDate) {
    return {
      status: 'scheduled',
      label: `預排上架 (${publishDate})`,
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    };
  }

  return {
    status: 'published',
    label: '已上架',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  };
};

// 輔助函式：完整解析單元資源 (多 YouTube 影片、多 Google 連結、實體附件檔案)
export interface ParsedUnitResources {
  youtubeUrls: string[];
  googleUrls: string[];
  fileAttachments: HomeworkAttachment[];
}

export const parseUnitResources = (unit: CourseUnit): ParsedUnitResources => {
  const ytSet = new Set<string>();
  const ggSet = new Set<string>();
  const files: HomeworkAttachment[] = [];

  if (unit.youtube_urls && Array.isArray(unit.youtube_urls)) {
    unit.youtube_urls.forEach((url) => url && ytSet.add(url.trim()));
  }
  if (unit.google_urls && Array.isArray(unit.google_urls)) {
    unit.google_urls.forEach((url) => url && ggSet.add(url.trim()));
  }

  let raw: string | HomeworkAttachment[] | null | undefined = unit.attachments;
  if (!raw && unit.$id && typeof window !== 'undefined') {
    raw = localStorage.getItem(`oc_cu_att_${unit.$id}`) || '';
  }

  let parsed: any[] = [];
  if (raw) {
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        parsed = [];
      }
    } else if (Array.isArray(raw)) {
      parsed = raw;
    }
  }

  if (Array.isArray(parsed)) {
    parsed.forEach((att) => {
      if (!att) return;
      if (att.type === 'link/youtube' || att.url?.includes('youtube.com') || att.url?.includes('youtu.be')) {
        if (att.url) ytSet.add(att.url.trim());
      } else if (att.type === 'link/google' || att.url?.includes('google.com') || att.url?.includes('forms.gle')) {
        if (att.url) ggSet.add(att.url.trim());
      } else {
        files.push(att);
      }
    });
  }

  return {
    youtubeUrls: Array.from(ytSet),
    googleUrls: Array.from(ggSet),
    fileAttachments: files,
  };
};

export const CourseContentModal: React.FC<CourseContentModalProps> = ({
  isOpen,
  onClose,
  branches,
  courses,
  classes = [],
  courseItems = [],
  initialCourse = '',
  initialBranch = '',
}) => {
  const [activeTab, setActiveTab] = useState<'units' | 'homework'>('units');

  // ⭐ 需求 2：課程內容與單元進度「預設全部分校及全部課程」
  const [selectedBranch, setSelectedBranch] = useState('全部分校');
  const [selectedCourse, setSelectedCourse] = useState('全部課程');
  const [statusFilter, setStatusFilter] = useState<'all' | PublishStatusType>('all');

  // ⭐ 需求 6：課程內容中，課程選擇會因揀選的學校而變更 (嚴格遵循 React Rules of Hooks，置於 early return 之前)
  const filteredCourses = useMemo(() => {
    let list: string[] = [];
    if (selectedBranch === '全部分校') {
      list = courses;
    } else if (courseItems && courseItems.length > 0) {
      const matchedItems = courseItems.filter((c) => {
        if (typeof c === 'string') return true;
        return !c.branch || c.branch === '全部分校' || c.branch === selectedBranch;
      });
      list = matchedItems.map((c) => getCourseDisplayName(c));
    } else {
      list = courses;
    }
    return Array.from(new Set(list)).filter(Boolean);
  }, [selectedBranch, courses, courseItems]);

  // 當分校變更時，若目前選中課程不在該分校課程中，自動重置為「全部課程」
  useEffect(() => {
    if (selectedCourse !== '全部課程' && !filteredCourses.includes(selectedCourse)) {
      setSelectedCourse('全部課程');
    }
  }, [selectedBranch, filteredCourses, selectedCourse]);

  const [units, setUnits] = useState<CourseUnit[]>([]);
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 點擊展開/收合狀態 (預設精簡只顯示單元/項目名稱)
  const [expandedUnitIds, setExpandedUnitIds] = useState<string[]>([]);

  // 多選狀態
  const [isUnitSelectMode, setIsUnitSelectMode] = useState(false);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);

  const [isHwSelectMode, setIsHwSelectMode] = useState(false);
  const [selectedHwIds, setSelectedHwIds] = useState<string[]>([]);

  // 批量編輯彈窗狀態
  const [batchEditOpen, setBatchEditOpen] = useState(false);

  // 課程單元建立 / 編輯表單狀態
  const [unitFormOpen, setUnitFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<CourseUnit | null>(null);

  // 家課表單狀態
  const [hwFormOpen, setHwFormOpen] = useState(false);
  const [editingHw, setEditingHw] = useState<HomeworkItem | null>(null);
  const [targetUnitForNewHw, setTargetUnitForNewHw] = useState<CourseUnit | null>(null);

  // 從已儲存家課揀選彈窗狀態
  const [hwSelectModalOpen, setHwSelectModalOpen] = useState(false);
  const [targetUnitForHwSelect, setTargetUnitForHwSelect] = useState<CourseUnit | null>(null);

  // 本機 Blob 即時播放與下載快取
  const [resolvedBlobUrls, setResolvedBlobUrls] = useState<Record<string, string>>({});
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const handleResetAndClose = () => {
    setSelectedBranch('全部分校');
    setSelectedCourse('全部課程');
    setStatusFilter('all');
    setExpandedUnitIds([]);
    setIsUnitSelectMode(false);
    setSelectedUnitIds([]);
    setIsHwSelectMode(false);
    setSelectedHwIds([]);
    setBatchEditOpen(false);
    setUnitFormOpen(false);
    setEditingUnit(null);
    setHwFormOpen(false);
    setEditingHw(null);
    setTargetUnitForNewHw(null);
    setHwSelectModalOpen(false);
    setTargetUnitForHwSelect(null);
    setPlayingAudioId(null);
    onClose();
  };

  const prevOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (prevOpenRef.current && !isOpen) {
      setSelectedBranch('全部分校');
      setSelectedCourse('全部課程');
      setStatusFilter('all');
      setExpandedUnitIds([]);
      setIsUnitSelectMode(false);
      setSelectedUnitIds([]);
      setIsHwSelectMode(false);
      setSelectedHwIds([]);
      setBatchEditOpen(false);
      setUnitFormOpen(false);
      setEditingUnit(null);
      setHwFormOpen(false);
      setEditingHw(null);
      setTargetUnitForNewHw(null);
      setHwSelectModalOpen(false);
      setTargetUnitForHwSelect(null);
      setPlayingAudioId(null);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);


  // 讀取課程單元
  const fetchUnits = async () => {
    try {
      const res = await databases.listDocuments(DATABASE_ID, 'course_units', [
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ]);
      setUnits(res.documents as unknown as CourseUnit[]);
    } catch (err: any) {
      try {
        const saved = localStorage.getItem('oc_local_course_units');
        if (saved) setUnits(JSON.parse(saved));
      } catch (e) {}
    }
  };

  // 讀取家課清單
  const fetchHomework = async () => {
    try {
      const res = await databases.listDocuments(DATABASE_ID, 'homework', [
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ]);
      setHomeworkList(res.documents as unknown as HomeworkItem[]);
    } catch (err: any) {
      try {
        const saved = localStorage.getItem('oc_local_homework');
        if (saved) setHomeworkList(JSON.parse(saved));
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      // 打開時若有傳入指定課程或分校則預設套用，否則為全部分校及全部課程
      setSelectedBranch(initialBranch || '全部分校');
      setSelectedCourse(initialCourse || '全部課程');
      Promise.all([fetchUnits(), fetchHomework()]).finally(() => setLoading(false));
    }
  }, [isOpen, initialCourse, initialBranch]);

  // 解析單元附件中的本機 Blob 網址
  useEffect(() => {
    let active = true;
    const resolveUnitFiles = async () => {
      const urls: Record<string, string> = {};
      for (const u of units) {
        const res = parseUnitResources(u);
        for (const att of res.fileAttachments) {
          if (att.url && att.url.startsWith('http')) {
            urls[att.id] = att.url;
          } else {
            try {
              const blob = await getLocalFile(att.id);
              if (blob && active) {
                urls[att.id] = URL.createObjectURL(blob);
              }
            } catch (e) {}
          }
        }
      }
      if (active) {
        setResolvedBlobUrls((prev) => ({ ...prev, ...urls }));
      }
    };
    if (units.length > 0) {
      resolveUnitFiles();
    }
    return () => {
      active = false;
    };
  }, [units]);

  if (!isOpen) return null;

  const toggleUnitExpand = (unitId: string) => {
    setExpandedUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  };

  // 檔案下載處理
  const handleDownload = async (att: HomeworkAttachment) => {
    try {
      let downloadUrl = att.downloadUrl || att.url;
      if (downloadUrl && downloadUrl.startsWith('http')) {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = att.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      let blobUrl = resolvedBlobUrls[att.id];
      if (!blobUrl) {
        const blob = await getLocalFile(att.id);
        if (blob) {
          blobUrl = URL.createObjectURL(blob);
        }
      }

      if (blobUrl) {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = att.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert('抱歉，此檔案暫無法於本機或雲端提取！');
      }
    } catch (e: any) {
      console.error('下載失敗:', e);
      alert('下載過程中發生錯誤：' + e.message);
    }
  };

  const handleToggleAudio = (attId: string) => {
    const audioEl = document.getElementById(`audio-cu-player-${attId}`) as HTMLAudioElement | null;
    if (!audioEl) return;

    if (playingAudioId === attId) {
      audioEl.pause();
      setPlayingAudioId(null);
    } else {
      if (playingAudioId) {
        const prevEl = document.getElementById(`audio-cu-player-${playingAudioId}`) as HTMLAudioElement | null;
        if (prevEl) prevEl.pause();
      }
      audioEl.play().catch((e) => console.warn('自動播放被阻止:', e));
      setPlayingAudioId(attId);
    }
  };

  // 1. 提交儲存單元 (Create / Update)
  const handleUnitSubmit = async (data: Omit<CourseUnit, '$id'>, id?: string) => {
    const targetId = id || 'unit_' + Date.now();
    const finalUnit: CourseUnit = {
      $id: targetId,
      ...data,
    };

    try {
      const saved = localStorage.getItem('oc_local_course_units') || '[]';
      const list: CourseUnit[] = JSON.parse(saved);
      const filtered = list.filter((u) => u.$id !== finalUnit.$id);
      localStorage.setItem('oc_local_course_units', JSON.stringify([finalUnit, ...filtered]));
      localStorage.setItem(
        `oc_cu_att_${finalUnit.$id}`,
        typeof finalUnit.attachments === 'string' ? finalUnit.attachments : JSON.stringify(finalUnit.attachments || [])
      );
    } catch (e) {}

    setUnits((prev) => {
      const filtered = prev.filter((u) => u.$id !== finalUnit.$id);
      return [finalUnit, ...filtered];
    });

    try {
      const payload: any = {
        branch: data.branch,
        course_name: data.course_name,
        unit_title: data.unit_title,
        description: data.description || '',
        publish_date: data.publish_date || '',
        unpublish_date: data.unpublish_date || '',
        attachments: typeof data.attachments === 'string' ? data.attachments : JSON.stringify(data.attachments || []),
      };

      if (id) {
        await databases.updateDocument(DATABASE_ID, 'course_units', id, payload);
      } else {
        await databases.createDocument(DATABASE_ID, 'course_units', ID.unique(), payload);
      }
    } catch (cloudErr: any) {
      console.warn('雲端 course_units 寫入略過 (已由本地完整保存):', cloudErr.message);
    }
  };

  // 2. 刪除單元 (單筆)
  const handleDeleteUnit = async (unitId: string) => {
    if (!window.confirm('確定要刪除此課程單元嗎？')) return;
    try {
      await databases.deleteDocument(DATABASE_ID, 'course_units', unitId);
    } catch (e) {}

    try {
      const saved = localStorage.getItem('oc_local_course_units') || '[]';
      const list: CourseUnit[] = JSON.parse(saved);
      localStorage.setItem('oc_local_course_units', JSON.stringify(list.filter((u) => u.$id !== unitId)));
    } catch (e) {}

    setUnits((prev) => prev.filter((u) => u.$id !== unitId));
    setSelectedUnitIds((prev) => prev.filter((id) => id !== unitId));
  };

  // 3. 批量刪除單元
  const handleBatchDeleteUnits = async () => {
    if (selectedUnitIds.length === 0) return;
    if (!window.confirm(`確定要批量刪除已勾選的 ${selectedUnitIds.length} 個課程單元嗎？此動作無法還原。`)) {
      return;
    }

    const remaining = units.filter((u) => !selectedUnitIds.includes(u.$id!));
    setUnits(remaining);
    try {
      localStorage.setItem('oc_local_course_units', JSON.stringify(remaining));
    } catch (e) {}

    for (const id of selectedUnitIds) {
      try {
        await databases.deleteDocument(DATABASE_ID, 'course_units', id);
      } catch (e) {}
    }

    setSelectedUnitIds([]);
    setIsUnitSelectMode(false);
  };

  // 4. 提交家課 (單筆)
  const handleHomeworkSubmit = async (data: Omit<HomeworkItem, '$id'>, id?: string) => {
    const targetId = id || 'hw_' + Date.now();
    const finalItem: HomeworkItem = {
      $id: targetId,
      ...data,
    };

    try {
      const saved = localStorage.getItem('oc_local_homework') || '[]';
      const list: HomeworkItem[] = JSON.parse(saved);
      const filtered = list.filter((item) => item.$id !== finalItem.$id);
      localStorage.setItem('oc_local_homework', JSON.stringify([finalItem, ...filtered]));
    } catch (e) {}

    setHomeworkList((prev) => {
      const filtered = prev.filter((item) => item.$id !== finalItem.$id);
      return [finalItem, ...filtered];
    });

    try {
      const payload: any = {
        branch: data.branch || '',
        course_name: data.course_name || '',
        title: data.title,
        description: data.description || '',
        due_date: data.due_date,
      };
      if (data.attachments) payload.attachments = data.attachments;
      if (id) {
        await databases.updateDocument(DATABASE_ID, 'homework', id, payload);
      } else {
        await databases.createDocument(DATABASE_ID, 'homework', ID.unique(), payload);
      }
    } catch (err) {}
  };

  // 5. 刪除家課 (單筆)
  const handleDeleteHomework = async (hwId: string) => {
    if (!window.confirm('確定要刪除此項家課記錄嗎？')) return;
    try {
      await databases.deleteDocument(DATABASE_ID, 'homework', hwId);
    } catch (e) {}

    try {
      const saved = localStorage.getItem('oc_local_homework') || '[]';
      const list: HomeworkItem[] = JSON.parse(saved);
      localStorage.setItem('oc_local_homework', JSON.stringify(list.filter((item) => item.$id !== hwId)));
    } catch (e) {}

    setHomeworkList((prev) => prev.filter((item) => item.$id !== hwId));
    setSelectedHwIds((prev) => prev.filter((id) => id !== hwId));
  };

  // 6. 批量刪除家課
  const handleBatchDeleteHomework = async () => {
    if (selectedHwIds.length === 0) return;
    if (!window.confirm(`確定要批量刪除已勾選的 ${selectedHwIds.length} 份家課項目嗎？此動作無法還原。`)) {
      return;
    }

    const remaining = homeworkList.filter((h) => !selectedHwIds.includes(h.$id!));
    setHomeworkList(remaining);
    try {
      localStorage.setItem('oc_local_homework', JSON.stringify(remaining));
    } catch (e) {}

    for (const id of selectedHwIds) {
      try {
        await databases.deleteDocument(DATABASE_ID, 'homework', id);
      } catch (e) {}
    }

    setSelectedHwIds([]);
    setIsHwSelectMode(false);
  };

  // 7. 批量編輯套用
  const handleApplyBatchEdit = async (updates: any) => {
    const today = new Date().toISOString().split('T')[0];

    if (activeTab === 'units') {
      const updatedUnits = units.map((u) => {
        if (u.$id && selectedUnitIds.includes(u.$id)) {
          const next = { ...u };
          if (updates.publishDateAction === 'today') next.publish_date = today;
          else if (updates.publishDateAction === 'clear') next.publish_date = '';
          else if (updates.publishDateAction === 'set' && updates.publishDateValue) next.publish_date = updates.publishDateValue;

          if (updates.unpublishDateAction === 'clear') next.unpublish_date = '';
          else if (updates.unpublishDateAction === 'set' && updates.unpublishDateValue) next.unpublish_date = updates.unpublishDateValue;

          if (updates.branchAction === 'set' && updates.branchValue) next.branch = updates.branchValue;
          if (updates.courseAction === 'set' && updates.courseValue) next.course_name = updates.courseValue;

          return next;
        }
        return u;
      });

      setUnits(updatedUnits);
      try {
        localStorage.setItem('oc_local_course_units', JSON.stringify(updatedUnits));
      } catch (e) {}

      for (const id of selectedUnitIds) {
        const item = updatedUnits.find((u) => u.$id === id);
        if (item) {
          try {
            await databases.updateDocument(DATABASE_ID, 'course_units', id, {
              publish_date: item.publish_date || '',
              unpublish_date: item.unpublish_date || '',
              branch: item.branch,
              course_name: item.course_name,
            });
          } catch (e) {}
        }
      }
      setSelectedUnitIds([]);
      setIsUnitSelectMode(false);
    } else {
      const updatedHomework = homeworkList.map((hw) => {
        if (hw.$id && selectedHwIds.includes(hw.$id)) {
          const next = { ...hw };
          if (updates.publishDateAction === 'today') next.publish_date = today;
          else if (updates.publishDateAction === 'clear') next.publish_date = '';
          else if (updates.publishDateAction === 'set' && updates.publishDateValue) next.publish_date = updates.publishDateValue;

          if (updates.unpublishDateAction === 'clear') next.unpublish_date = '';
          else if (updates.unpublishDateAction === 'set' && updates.unpublishDateValue) next.unpublish_date = updates.unpublishDateValue;

          if (updates.dueDateAction === 'set' && updates.dueDateValue) next.due_date = new Date(updates.dueDateValue).toISOString();
          if (updates.branchAction === 'set' && updates.branchValue) next.branch = updates.branchValue;
          if (updates.courseAction === 'set' && updates.courseValue) next.course_name = updates.courseValue;

          return next;
        }
        return hw;
      });

      setHomeworkList(updatedHomework);
      try {
        localStorage.setItem('oc_local_homework', JSON.stringify(updatedHomework));
      } catch (e) {}

      for (const id of selectedHwIds) {
        const item = updatedHomework.find((h) => h.$id === id);
        if (item) {
          try {
            await databases.updateDocument(DATABASE_ID, 'homework', id, {
              due_date: item.due_date,
              branch: item.branch,
              course_name: item.course_name,
            });
          } catch (e) {}
        }
      }
      setSelectedHwIds([]);
      setIsHwSelectMode(false);
    }
  };

  // 8. 處理「從已儲存家課揀選」儲存關聯
  const handleSaveHomeworkSelection = async (
    unitId: string,
    unitTitle: string,
    selectedHwIdsToLink: string[]
  ) => {
    const updatedList = homeworkList.map((hw) => {
      if (hw.$id && selectedHwIdsToLink.includes(hw.$id)) {
        return { ...hw, unit_id: unitId, unit_title: unitTitle };
      } else if (hw.unit_id === unitId || (hw.unit_title && hw.unit_title === unitTitle)) {
        const { unit_id, unit_title, ...rest } = hw;
        return rest as HomeworkItem;
      }
      return hw;
    });

    setHomeworkList(updatedList);
    try {
      localStorage.setItem('oc_local_homework', JSON.stringify(updatedList));
    } catch (e) {}

    for (const id of selectedHwIdsToLink) {
      try {
        await databases.updateDocument(DATABASE_ID, 'homework', id, {
          unit_id: unitId,
          unit_title: unitTitle,
        });
      } catch (e) {}
    }
  };

  // 9. 解除單一家課與單元的關聯
  const handleUnlinkHomework = async (hwId: string) => {
    if (!window.confirm('確定要解除此項家課與單元的關聯嗎？')) return;
    const updatedList = homeworkList.map((hw) => {
      if (hw.$id === hwId) {
        const { unit_id, unit_title, ...rest } = hw;
        return rest as HomeworkItem;
      }
      return hw;
    });

    setHomeworkList(updatedList);
    try {
      localStorage.setItem('oc_local_homework', JSON.stringify(updatedList));
    } catch (e) {}

    try {
      await databases.updateDocument(DATABASE_ID, 'homework', hwId, {
        unit_id: '',
        unit_title: '',
      });
    } catch (e) {}
  };

    // 篩選單元清單
  const filteredUnits = units.filter((u) => {
    const matchBranch = selectedBranch === '全部分校' || !u.branch || u.branch === selectedBranch;
    const matchCourse =
      selectedCourse === '全部課程' ||
      !u.course_name ||
      u.course_name === selectedCourse ||
      selectedCourse.startsWith(u.course_name) ||
      u.course_name.startsWith(selectedCourse);
    const { status } = checkPublishStatus(u.publish_date, u.unpublish_date);
    const matchStatus = statusFilter === 'all' || status === statusFilter;
    return matchBranch && matchCourse && matchStatus;
  });

  // 篩選家課清單
  const filteredHomework = homeworkList.filter((hw) => {
    const matchBranch = selectedBranch === '全部分校' || !hw.branch || hw.branch === selectedBranch;
    const matchCourse =
      selectedCourse === '全部課程' ||
      !hw.course_name ||
      hw.course_name === selectedCourse ||
      selectedCourse.startsWith(hw.course_name) ||
      hw.course_name.startsWith(selectedCourse);
    const { status } = checkPublishStatus(hw.publish_date, hw.unpublish_date);
    const matchStatus = statusFilter === 'all' || status === statusFilter;
    return matchBranch && matchCourse && matchStatus;
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-30 flex items-end justify-center">
      <div className="bg-[#F8F9FA] w-full max-w-md rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl relative">
        {/* 頂部導航列 (⭐ 需求 3：已移除設定齒輪，純粹專注課程單元與進度) */}
        <div className="bg-white px-5 py-3.5 rounded-t-2xl border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <GraduationCap size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-base">課程內容與單元進度</h3>
              <p className="text-[11px] text-gray-400">點擊項目展開查看內容，支援多選編輯與刪除</p>
            </div>
          </div>

          <button onClick={handleResetAndClose} className="p-1 text-gray-400 hover:text-gray-600" title="關閉">
            <X size={20} />
          </button>
        </div>

        {/* 分頁標籤：課程單元 (Units) VS 家課作業 (Homework) */}
        <div className="bg-white px-4 border-b border-gray-100 flex text-xs font-bold justify-between items-center">
          <div className="flex flex-1">
            <button
              onClick={() => setActiveTab('units')}
              className={`py-2.5 px-3 border-b-2 text-center transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'units'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <GraduationCap size={15} />
              <span>課程單元 ({filteredUnits.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('homework')}
              className={`py-2.5 px-3 border-b-2 text-center transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'homework'
                  ? 'border-[#FF6B57] text-[#FF6B57]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <BookOpen size={15} />
              <span>單元家課 ({filteredHomework.length})</span>
            </button>
          </div>

          {/* 多選管理模式切換按鈕 */}
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'units') {
                setIsUnitSelectMode(!isUnitSelectMode);
                setSelectedUnitIds([]);
              } else {
                setIsHwSelectMode(!isHwSelectMode);
                setSelectedHwIds([]);
              }
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-2xs ${
              (activeTab === 'units' ? isUnitSelectMode : isHwSelectMode)
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <CheckSquare size={13} />
            <span>{(activeTab === 'units' ? isUnitSelectMode : isHwSelectMode) ? '退出多選' : '多選管理'}</span>
          </button>
        </div>

        {/* 篩選工具列：預設全部分校及全部課程 (課程因學校變更，獨立一行完整顯示全名) */}
        <div className="bg-white px-4 py-2 border-b border-gray-100 space-y-1.5">
          <div className="grid grid-cols-1 gap-1.5">
            {/* 學校選擇 */}
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full bg-purple-50 text-purple-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg border-none outline-none"
            >
              <option value="全部分校">全部分校 (All Schools)</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* ⭐ 課程選擇因學校變更，獨立行滿寬顯示 */}
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-indigo-100 outline-none"
            >
              <option value="全部課程">全部課程 (All Courses)</option>
              {filteredCourses.map((c, idx) => (
                <option key={`${c}_${idx}`} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 狀態快捷按鈕 (全部 / 🟢 已上架 / 🟡 預排上架 / 🟣 待安排 / ⚪ 已下架) */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px]">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded-full font-bold transition-all shrink-0 ${
                statusFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              全部狀態
            </button>
            <button
              onClick={() => setStatusFilter('published')}
              className={`px-2 py-0.5 rounded-full font-bold transition-all flex items-center gap-1 shrink-0 ${
                statusFilter === 'published' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <span>🟢 已上架</span>
            </button>
            <button
              onClick={() => setStatusFilter('scheduled')}
              className={`px-2 py-0.5 rounded-full font-bold transition-all flex items-center gap-1 shrink-0 ${
                statusFilter === 'scheduled' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700'
              }`}
            >
              <span>🟡 預排中</span>
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2 py-0.5 rounded-full font-bold transition-all flex items-center gap-1 shrink-0 ${
                statusFilter === 'pending' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'
              }`}
            >
              <span>🟣 待安排</span>
            </button>
            <button
              onClick={() => setStatusFilter('unpublished')}
              className={`px-2 py-0.5 rounded-full font-bold transition-all flex items-center gap-1 shrink-0 ${
                statusFilter === 'unpublished' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span>⚪ 已下架</span>
            </button>
          </div>
        </div>

        {/* 內容展示列表 */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 pb-24">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-xs">載入課程內容中...</div>
          ) : activeTab === 'units' ? (
            /* TAB 1: 課程單元列表 */
            filteredUnits.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs flex flex-col items-center gap-2">
                <GraduationCap size={32} className="text-gray-300" />
                <p className="font-semibold text-gray-500">暫無相關課程單元</p>
                <p className="text-[10px] text-gray-400">點擊下方「+ 新增課程單元」為學生規劃教材與進度</p>
              </div>
            ) : (
              filteredUnits.map((u, idx) => {
                const pubStatus = checkPublishStatus(u.publish_date, u.unpublish_date);
                const isExpanded = u.$id ? expandedUnitIds.includes(u.$id) : false;
                const isSelected = u.$id ? selectedUnitIds.includes(u.$id) : false;

                // ⭐ 核心修復：完整解析單元多媒體、多連結與檔案附件
                const res = parseUnitResources(u);
                const ytList = res.youtubeUrls;
                const ggList = res.googleUrls;
                const fileList = res.fileAttachments;

                const linkedHws = homeworkList.filter(
                  (h) => h.unit_id === u.$id || (h.unit_title && h.unit_title === u.unit_title)
                );

                return (
                  <div
                    key={u.$id || idx}
                    className={`bg-white rounded-2xl border transition-all text-xs relative ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-600/20 shadow-md'
                        : 'border-gray-200/90 hover:border-gray-300 shadow-xs'
                    }`}
                  >
                    {/* 頂部單元精簡標題列 (預設只顯示單元名稱，點擊展開/收合) */}
                    <div className="p-3.5 flex items-start gap-2.5">
                      {isUnitSelectMode && u.$id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUnitIds((prev) =>
                              prev.includes(u.$id!)
                                ? prev.filter((id) => id !== u.$id)
                                : [...prev, u.$id!]
                            );
                          }}
                          className="pt-0.5 text-indigo-600 shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-indigo-600" />
                          ) : (
                            <Square size={18} className="text-gray-300 hover:text-gray-500" />
                          )}
                        </button>
                      )}

                      <div
                        onClick={() => u.$id && toggleUnitExpand(u.$id)}
                        className="flex-1 min-w-0 cursor-pointer select-none"
                      >
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pubStatus.badgeClass}`}>
                            {pubStatus.label}
                          </span>
                          {u.course_name && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {u.course_name}
                            </span>
                          )}
                          {u.branch && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                              {u.branch}
                            </span>
                          )}
                        </div>

                        {/* ⭐ 單元名稱 */}
                        <h4 className="font-bold text-gray-900 text-sm leading-snug truncate">
                          {u.unit_title}
                        </h4>

                        {/* ⭐ 需求 1：教材數量縮影 (📹 X 部影片 | 📄 Y 個講義 | 📎 Z 個附件 | 📝 W 項家課) */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] font-semibold text-gray-600">
                          <span
                            className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors ${
                              ytList.length > 0
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-gray-50 text-gray-400 border border-gray-100'
                            }`}
                          >
                            <span>📹</span>
                            <span>{ytList.length} 部影片</span>
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors ${
                              ggList.length > 0
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-gray-50 text-gray-400 border border-gray-100'
                            }`}
                          >
                            <span>📄</span>
                            <span>{ggList.length} 個講義</span>
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors ${
                              fileList.length > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-gray-50 text-gray-400 border border-gray-100'
                            }`}
                          >
                            <span>📎</span>
                            <span>{fileList.length} 個附件</span>
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors ${
                              linkedHws.length > 0
                                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                : 'bg-gray-50 text-gray-400 border border-gray-100'
                            }`}
                          >
                            <span>📝</span>
                            <span>{linkedHws.length} 項家課</span>
                          </span>

                          <span className="text-indigo-600 font-bold text-[10px] ml-auto flex items-center gap-0.5">
                            <span>{isExpanded ? '收合詳情' : '點擊展開'}</span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-gray-400 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingUnit(u);
                            setUnitFormOpen(true);
                          }}
                          className="p-1 hover:text-indigo-600 transition-colors"
                          title="編輯單元"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            u.$id && handleDeleteUnit(u.$id);
                          }}
                          className="p-1 hover:text-red-600 transition-colors"
                          title="刪除單元"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* ⭐ 需求 1 & 2：展開後的完整內容、YouTube 影片、Google 文件與實體附件 */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-2 border-t border-gray-100 space-y-3">
                        {/* 開放時間提示 */}
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                          <Clock size={11} className={u.publish_date ? "text-indigo-500" : "text-purple-500"} />
                          <span>
                            {u.publish_date
                              ? `開放期：${u.publish_date} ~ ${u.unpublish_date || '無限制'}`
                              : '開放期：有待安排 (未設定上架日)'}
                          </span>
                        </div>

                        {/* 教學目標與說明 */}
                        {u.description && (
                          <div className="text-gray-700 text-xs bg-gray-50 p-2.5 rounded-xl whitespace-pre-wrap leading-relaxed border border-gray-100">
                            {u.description}
                          </div>
                        )}

                        {/* 🔴 1. YouTube 示範影片區塊 */}
                        {ytList.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-red-600">
                              <YoutubeIcon size={14} />
                              <span>YouTube 示範影片 ({ytList.length} 部)：</span>
                            </div>
                            {ytList.map((ytUrl, i) => {
                              const ytId = extractYoutubeId(ytUrl);
                              return (
                                <div key={i} className="bg-red-50/40 border border-red-100 rounded-xl p-2.5">
                                  <div className="flex items-center justify-between mb-1.5 px-0.5">
                                    <span className="text-[11px] font-bold text-red-600 flex items-center gap-1">
                                      <YoutubeIcon size={14} />
                                      <span>示範影片 #{i + 1}</span>
                                    </span>
                                    <a
                                      href={ytUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-0.5"
                                    >
                                      <span>在 YouTube 觀看</span>
                                      <ExternalLink size={10} />
                                    </a>
                                  </div>
                                  {ytId ? (
                                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black shadow-inner">
                                      <iframe
                                        src={`https://www.youtube.com/embed/${ytId}`}
                                        title={`YouTube Video #${i + 1}`}
                                        className="w-full h-full border-0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                      />
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-red-600 truncate">{ytUrl}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 🔵 2. Google 雲端文件 / 講義區塊 */}
                        {ggList.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-bold text-blue-700">
                              Google 雲端講義與文件連結 ({ggList.length} 個)：
                            </div>
                            {ggList.map((ggUrl, i) => {
                              const meta = getGoogleLinkMeta(ggUrl);
                              return (
                                <a
                                  key={i}
                                  href={ggUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between p-2.5 bg-blue-50/60 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all group"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-7 h-7 rounded-lg ${meta.iconColor} text-white font-black text-xs flex items-center justify-center shrink-0`}>
                                      G
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-bold text-blue-950 truncate">{meta.title}</p>
                                        <span className="text-[9px] bg-white text-blue-700 px-1.5 py-0.2 rounded border border-blue-200 font-semibold shrink-0">
                                          {meta.tag}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-blue-500 truncate max-w-[200px]">{ggUrl}</p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-blue-600 font-bold flex items-center gap-0.5 bg-white px-2 py-1 rounded-lg border border-blue-200">
                                    <span>開啟</span>
                                    <ExternalLink size={10} />
                                  </span>
                                </a>
                              );
                            })}
                          </div>
                        )}

                        {/* 📁 3. 實體附件檔案 (MP4視訊、MP3音訊、工作紙、圖片等) */}
                        {fileList.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <div className="text-[11px] font-bold text-emerald-800">
                              教學多媒體與附件檔案 ({fileList.length} 個檔案)：
                            </div>
                            {fileList.map((att, idx) => {
                              const fileUrl = resolvedBlobUrls[att.id] || att.url;
                              const isVideo =
                                att.type?.startsWith('video/') ||
                                att.name.toLowerCase().endsWith('.mp4') ||
                                att.name.toLowerCase().endsWith('.mov') ||
                                att.name.toLowerCase().endsWith('.webm');

                              const isAudio =
                                !isVideo &&
                                (att.type?.startsWith('audio/') ||
                                  att.name.toLowerCase().endsWith('.mp3') ||
                                  att.name.toLowerCase().endsWith('.wav'));

                              const isImage = !isVideo && !isAudio && att.type?.startsWith('image/');

                              return (
                                <div
                                  key={att.id || idx}
                                  className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 flex flex-col gap-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {isVideo ? (
                                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                          <Video size={15} />
                                        </div>
                                      ) : isAudio ? (
                                        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                                          <Music size={15} />
                                        </div>
                                      ) : isImage && fileUrl ? (
                                        <img
                                          src={fileUrl}
                                          alt={att.name}
                                          className="w-7 h-7 object-cover rounded shrink-0 border border-gray-200"
                                        />
                                      ) : (
                                        <FileText size={16} className="text-blue-500 shrink-0" />
                                      )}

                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-800 truncate max-w-[190px]">
                                          {att.name}
                                        </p>
                                        <p className="text-[10px] text-gray-400">
                                          {(att.size / 1024 / 1024) >= 1
                                            ? `${(att.size / 1024 / 1024).toFixed(1)} MB`
                                            : `${(att.size / 1024).toFixed(1)} KB`}
                                        </p>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleDownload(att)}
                                      className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg border border-gray-200 shadow-2xs transition-colors shrink-0"
                                      title="下載檔案"
                                    >
                                      <Download size={11} />
                                      <span>下載</span>
                                    </button>
                                  </div>

                                  {/* 內嵌視訊播放 */}
                                  {isVideo && fileUrl && (
                                    <div className="mt-1 w-full rounded-lg overflow-hidden bg-black shadow-inner">
                                      <video
                                        src={fileUrl}
                                        controls
                                        playsInline
                                        preload="metadata"
                                        className="w-full max-h-52 object-contain"
                                      >
                                        您的瀏覽器不支援播放此視訊。
                                      </video>
                                    </div>
                                  )}

                                  {/* 內嵌音訊播放 */}
                                  {isAudio && fileUrl && (
                                    <div className="flex items-center gap-2 mt-1 bg-white p-1.5 rounded-lg border border-gray-200">
                                      <audio
                                        id={`audio-cu-player-${att.id}`}
                                        src={fileUrl}
                                        preload="metadata"
                                        onEnded={() => setPlayingAudioId(null)}
                                        className="hidden"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleToggleAudio(att.id)}
                                        className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 transition-colors shadow-2xs shrink-0"
                                        title={playingAudioId === att.id ? '暫停' : '播放'}
                                      >
                                        {playingAudioId === att.id ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center text-[10px] text-gray-500 font-medium">
                                          <span>{playingAudioId === att.id ? '正在播放單元示範音訊...' : '點擊播放音訊'}</span>
                                          <span className="text-amber-600 font-semibold">MP3 伴奏/音訊</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 📝 4. 單元關聯家課區塊 */}
                        <div className="pt-2 border-t border-gray-100 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
                              <BookOpen size={13} className="text-[#FF6B57]" />
                              <span>單元關聯家課 ({linkedHws.length} 項)</span>
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setTargetUnitForHwSelect(u);
                                setHwSelectModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-[#FF6B57] border border-orange-200 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 shadow-2xs"
                              title="於已儲存家課庫中勾選，或建立新家課"
                            >
                              <Layers size={12} />
                              <span>揀選 / 發布單元家課</span>
                            </button>
                          </div>

                          {linkedHws.length > 0 && (
                            <div className="space-y-1.5 pl-1">
                              {linkedHws.map((lh) => {
                                const lhPubStatus = getHomeworkPublishStatus(lh.publish_date, lh.unpublish_date);
                                return (
                                  <div
                                    key={lh.$id}
                                    className="flex items-center justify-between p-2 bg-orange-50/30 border border-orange-100 rounded-lg text-xs"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${lhPubStatus.badgeClass}`}>
                                        {lhPubStatus.label}
                                      </span>
                                      <span className="font-bold text-gray-800 truncate text-[11px] max-w-[190px]">
                                        {lh.title}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 text-[10px] text-gray-400">
                                      <span>截止: {lh.due_date ? lh.due_date.split('T')[0] : '未設'}</span>
                                      <button
                                        type="button"
                                        onClick={() => lh.$id && handleUnlinkHomework(lh.$id)}
                                        className="text-gray-300 hover:text-red-500 p-0.5 transition-colors"
                                        title="解除與此單元的關聯"
                                      >
                                        <Unlink size={13} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            /* TAB 2: 家課列表 */
            filteredHomework.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs flex flex-col items-center gap-2">
                <BookOpen size={32} className="text-gray-300" />
                <p className="font-semibold text-gray-500">暫無相關家課作業記錄</p>
                <p className="text-[10px] text-gray-400">點擊下方「+ 發布新家課」指派功課</p>
              </div>
            ) : (
              filteredHomework.map((item, idx) => (
                <HomeworkCard
                  key={item.$id || idx}
                  item={item}
                  selectable={isHwSelectMode}
                  isSelected={item.$id ? selectedHwIds.includes(item.$id) : false}
                  onToggleSelect={(id) => {
                    setSelectedHwIds((prev) =>
                      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                    );
                  }}
                  onEdit={(hw) => {
                    setEditingHw(hw);
                    setTargetUnitForNewHw(null);
                    setHwFormOpen(true);
                  }}
                  onDelete={handleDeleteHomework}
                />
              ))
            )
          )}
        </div>

        {/* 多選操作懸浮列 */}
        {((activeTab === 'units' && selectedUnitIds.length > 0) ||
          (activeTab === 'homework' && selectedHwIds.length > 0)) && (
          <div className="absolute bottom-16 left-3 right-3 bg-gray-900/95 backdrop-blur text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between text-xs z-20 animate-in fade-in slide-in-from-bottom-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-400">
                已選 {activeTab === 'units' ? selectedUnitIds.length : selectedHwIds.length} 項
              </span>
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'units') {
                    const allIds = filteredUnits.map((u) => u.$id!).filter(Boolean);
                    setSelectedUnitIds(selectedUnitIds.length === allIds.length ? [] : allIds);
                  } else {
                    const allIds = filteredHomework.map((h) => h.$id!).filter(Boolean);
                    setSelectedHwIds(selectedHwIds.length === allIds.length ? [] : allIds);
                  }
                }}
                className="text-gray-300 hover:text-white underline text-[11px]"
              >
                {(activeTab === 'units'
                  ? selectedUnitIds.length === filteredUnits.length
                  : selectedHwIds.length === filteredHomework.length)
                  ? '取消全選'
                  : '全選'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBatchEditOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1 transition-colors shadow-xs"
              >
                <Edit3 size={13} />
                <span>批量編輯</span>
              </button>

              <button
                type="button"
                onClick={activeTab === 'units' ? handleBatchDeleteUnits : handleBatchDeleteHomework}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center gap-1 transition-colors shadow-xs"
              >
                <Trash2 size={13} />
                <span>批量刪除</span>
              </button>
            </div>
          </div>
        )}

        {/* 底部功能按鈕列 */}
        <div className="p-3.5 bg-white border-t border-gray-100 flex gap-2">
          <button
            onClick={() => {
              setEditingUnit(null);
              setUnitFormOpen(true);
            }}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus size={15} />
            <span>新增課程單元</span>
          </button>

          <button
            onClick={() => {
              setEditingHw(null);
              setTargetUnitForNewHw(null);
              setHwFormOpen(true);
            }}
            className="flex-1 py-2.5 bg-[#FF6B57] hover:bg-[#e05a48] text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus size={15} />
            <span>發布新家課</span>
          </button>
        </div>
      </div>

      {/* 課程單元建立 / 編輯彈窗 (⭐ 根據所選學校顯示相對應課程) */}
      <CourseUnitFormModal
        isOpen={unitFormOpen}
        onClose={() => {
          setUnitFormOpen(false);
          setEditingUnit(null);
        }}
        onSubmit={handleUnitSubmit}
        initialData={editingUnit}
        branches={branches}
        courses={courses}
        courseItems={courseItems}
        defaultBranch={selectedBranch !== '全部分校' ? selectedBranch : undefined}
        defaultCourse={selectedCourse !== '全部課程' ? selectedCourse : undefined}
      />

      {/* 家課建立 / 編輯彈窗 (⭐ 根據所選學校顯示相對應課程) */}
      <HomeworkFormModal
        isOpen={hwFormOpen}
        onClose={() => {
          setHwFormOpen(false);
          setEditingHw(null);
          setTargetUnitForNewHw(null);
        }}
        onSubmit={handleHomeworkSubmit}
        initialData={editingHw}
        branches={branches}
        courses={courses}
        courseItems={courseItems}
        defaultBranch={selectedBranch !== '全部分校' ? selectedBranch : undefined}
        defaultCourse={selectedCourse !== '全部課程' ? selectedCourse : undefined}
        targetUnitId={targetUnitForNewHw?.$id}
        targetUnitTitle={targetUnitForNewHw?.unit_title}
      />

      {/* 從已儲存家課庫中揀選彈窗 */}
      <UnitHomeworkSelectModal
        isOpen={hwSelectModalOpen}
        onClose={() => {
          setHwSelectModalOpen(false);
          setTargetUnitForHwSelect(null);
        }}
        unit={targetUnitForHwSelect}
        savedHomeworkList={homeworkList}
        onSaveSelection={handleSaveHomeworkSelection}
        onCreateNewHomework={(u) => {
          setTargetUnitForNewHw(u);
          setEditingHw(null);
          setHwFormOpen(true);
        }}
      />

      {/* 批量編輯彈窗 */}
      <BatchEditModal
        isOpen={batchEditOpen}
        onClose={() => setBatchEditOpen(false)}
        targetType={activeTab}
        selectedCount={activeTab === 'units' ? selectedUnitIds.length : selectedHwIds.length}
        branches={branches}
        courses={courses}
        onApplyBatchEdit={handleApplyBatchEdit}
      />
    </div>
  );
};
