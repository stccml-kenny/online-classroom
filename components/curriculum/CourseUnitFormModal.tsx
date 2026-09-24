import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Save, GraduationCap, UploadCloud, FileText, Music, Video, Loader2, ExternalLink, Globe, Plus, Calendar, MapPin, Lock
} from 'lucide-react';
import { HomeworkAttachment, extractYoutubeId, getGoogleLinkMeta, YoutubeIcon } from '../homework/HomeworkCard';
import { CourseItem, getCourseDisplayName } from '../homework/HomeworkSetupModal';
import { storage, BUCKET_ID } from '@/lib/appwrite';
import { storeLocalFile } from '@/utils/indexedDB';
import { ID } from 'appwrite';

export interface CourseUnit {
  $id?: string;
  branch: string;
  course_name: string;
  unit_title: string;
  description?: string;
  publish_date?: string;   // 上架日期 (YYYY-MM-DD，選填，可待後續安排)
  unpublish_date?: string; // 下架日期 (YYYY-MM-DD，選填)
  youtube_urls?: string[]; // 多個 YouTube 連結
  google_urls?: string[];  // 多個 Google 連結
  attachments?: string | HomeworkAttachment[]; // 附件
  order_index?: number;
}

interface CourseUnitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<CourseUnit, '$id'>, id?: string) => Promise<void>;
  initialData?: CourseUnit | null;
  branches: string[];
  courses: string[];
  courseItems?: (string | CourseItem)[]; // ⭐ 支援課程物件結構以取得所屬學校/分校
  defaultBranch?: string; // ⭐ 預選分校
  defaultCourse?: string; // ⭐ 預選課程
  isLocked?: boolean;     // ⭐ 鎖上學校及課程選項
}

export const CourseUnitFormModal: React.FC<CourseUnitFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  branches,
  courses,
  courseItems = [],
  defaultBranch,
  defaultCourse,
  isLocked = false,
}) => {
  const [branch, setBranch] = useState(defaultBranch || branches[0] || '');
  // ⭐ 需求：新增課程單元中不要預選課程 (除非已鎖定指定課程)
  const [courseName, setCourseName] = useState(isLocked && defaultCourse ? defaultCourse : '');

  // ⭐ 需求：新增課程單元時，課程要根據所選學校/分校 (branch) 動態顯示相對應的課程
  // ⭐ 需求：如果該學校沒有課程，顯示沒有課程 (嚴格不 fallback 回其他學校課程)
  const availableCourses = useMemo(() => {
    let list: string[] = [];
    if (!branch || branch === '全部分校') {
      if (courseItems && courseItems.length > 0) {
        list = courseItems.map((c) => getCourseDisplayName(c));
      } else {
        list = courses;
      }
    } else if (courseItems && courseItems.length > 0) {
      const matched = courseItems.filter((c) => {
        if (typeof c === 'string') return true;
        return !c.branch || c.branch === '全部分校' || c.branch === branch;
      });
      list = matched.map((c) => getCourseDisplayName(c));
    } else {
      list = [];
    }
    return Array.from(new Set(list)).filter(Boolean);
  }, [branch, courses, courseItems]);

  const handleBranchChange = (newBranch: string) => {
    if (isLocked) return;
    setBranch(newBranch);
    // ⭐ 當分校變更時，若目前選中課程不在新分校課程中，重置為未選擇 (不預選)
    let nextCourses: string[] = [];
    if (courseItems && courseItems.length > 0 && newBranch && newBranch !== '全部分校') {
      const matched = courseItems.filter((c) => {
        if (typeof c === 'string') return true;
        return !c.branch || c.branch === '全部分校' || c.branch === newBranch;
      });
      nextCourses = matched.map((c) => getCourseDisplayName(c));
    } else if (courseItems && courseItems.length > 0) {
      nextCourses = courseItems.map((c) => getCourseDisplayName(c));
    } else {
      nextCourses = [];
    }
    const unique = Array.from(new Set(nextCourses)).filter(Boolean);
    const isValid = unique.some(
      (c) => c === courseName || c.startsWith(courseName) || courseName.startsWith(c)
    );
    if (!isValid) {
      setCourseName(''); // ⭐ 需求：不要預選課程
    }
  };
  const [unitTitle, setUnitTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // 上下架日期 (上架日期為選填，無須強制立即填寫，可留空待後續安排)
  const [publishDate, setPublishDate] = useState('');
  const [unpublishDate, setUnpublishDate] = useState('');

  // 支援多個 YouTube 影片連結
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([]);
  const [currentYtInput, setCurrentYtInput] = useState('');

  // 支援多個 Google 雲端 / 文件連結
  const [googleUrls, setGoogleUrls] = useState<string[]>([]);
  const [currentGoogleInput, setCurrentGoogleInput] = useState('');

  // 附件
  const [attachments, setAttachments] = useState<HomeworkAttachment[]>([]);
  const [sessionPreviewUrls, setSessionPreviewUrls] = useState<Record<string, string>>({});
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleResetAndClose = () => {
    setUnitTitle('');
    setDescription('');
    setPublishDate('');
    setUnpublishDate('');
    setYoutubeUrls([]);
    setCurrentYtInput('');
    setGoogleUrls([]);
    setCurrentGoogleInput('');
    setAttachments([]);
    setUploadingFiles(false);
    setSubmitting(false);
    setBranch(branches[0] || '');
    setCourseName(courses[0] || '');
    onClose();
  };

  const prevOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (prevOpenRef.current && !isOpen) {
      setUnitTitle('');
      setDescription('');
      setPublishDate('');
      setUnpublishDate('');
      setYoutubeUrls([]);
      setCurrentYtInput('');
      setGoogleUrls([]);
      setCurrentGoogleInput('');
      setAttachments([]);
      setUploadingFiles(false);
      setSubmitting(false);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);


  useEffect(() => {
    if (initialData) {
      const targetBranch = initialData.branch || defaultBranch || branches[0] || '';
      setBranch(targetBranch);
      setCourseName(initialData.course_name || defaultCourse || courses[0] || '');
      setUnitTitle(initialData.unit_title || '');
      setDescription(initialData.description || '');
      setPublishDate(initialData.publish_date ? initialData.publish_date.split('T')[0] : '');
      setUnpublishDate(initialData.unpublish_date ? initialData.unpublish_date.split('T')[0] : '');

      const ytList: string[] = [];
      if (initialData.youtube_urls && Array.isArray(initialData.youtube_urls)) {
        initialData.youtube_urls.forEach((u) => u && ytList.push(u.trim()));
      }

      const ggList: string[] = [];
      if (initialData.google_urls && Array.isArray(initialData.google_urls)) {
        initialData.google_urls.forEach((u) => u && ggList.push(u.trim()));
      }

      // 解析附件
      let rawAtt = initialData.attachments;
      let parsedAtts: HomeworkAttachment[] = [];
      if (rawAtt) {
        if (typeof rawAtt === 'string') {
          try {
            parsedAtts = JSON.parse(rawAtt);
          } catch (e) {
            parsedAtts = [];
          }
        } else if (Array.isArray(rawAtt)) {
          parsedAtts = rawAtt;
        }
      }

      const physicalAtts: HomeworkAttachment[] = [];
      parsedAtts.forEach((att) => {
        if (att.type === 'link/youtube' || att.url?.includes('youtube.com') || att.url?.includes('youtu.be')) {
          if (att.url && !ytList.includes(att.url.trim())) ytList.push(att.url.trim());
        } else if (att.type === 'link/google' || att.url?.includes('google.com') || att.url?.includes('forms.gle')) {
          if (att.url && !ggList.includes(att.url.trim())) ggList.push(att.url.trim());
        } else {
          physicalAtts.push(att);
        }
      });

      setYoutubeUrls(ytList);
      setGoogleUrls(ggList);
      setAttachments(physicalAtts);
      setCurrentYtInput('');
      setCurrentGoogleInput('');
    } else {
      // ⭐ 新增課程單元：帶入外層所選分校
      const targetBranch = defaultBranch && defaultBranch !== '全部分校' ? defaultBranch : (branches[0] || '');
      setBranch(targetBranch);

      // ⭐ 需求：如果已鎖定課程則帶入該課程；否則新增單元不要預選課程 (留空讓老師選擇)
      if (isLocked && defaultCourse) {
        setCourseName(defaultCourse);
      } else {
        setCourseName('');
      }

      setUnitTitle('');
      setDescription('');
      // 新增時上架日期預設留空，方便老師先規劃單元內容，有待之後再安排
      setPublishDate('');
      setUnpublishDate('');
      setYoutubeUrls([]);
      setGoogleUrls([]);
      setAttachments([]);
      setCurrentYtInput('');
      setCurrentGoogleInput('');
    }
  }, [initialData, isOpen, branches, courses, courseItems, defaultBranch, defaultCourse, isLocked]);

  if (!isOpen) return null;

  const handleAddYoutube = () => {
    const url = currentYtInput.trim();
    if (!url) return;
    if (!youtubeUrls.includes(url)) {
      setYoutubeUrls((prev) => [...prev, url]);
    }
    setCurrentYtInput('');
  };

  const handleRemoveYoutube = (index: number) => {
    if (!window.confirm('確定要移除此 YouTube 影片連結嗎？')) return;
    setYoutubeUrls((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddGoogle = () => {
    const url = currentGoogleInput.trim();
    if (!url) return;
    if (!googleUrls.includes(url)) {
      setGoogleUrls((prev) => [...prev, url]);
    }
    setCurrentGoogleInput('');
  };

  const handleRemoveGoogle = (index: number) => {
    if (!window.confirm('確定要移除此 Google 連結嗎？')) return;
    setGoogleUrls((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    const newAttachments: HomeworkAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = 'file_cu_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      try {
        await storeLocalFile(fileId, file);
        const tempBlobUrl = URL.createObjectURL(file);
        setSessionPreviewUrls((prev) => ({ ...prev, [fileId]: tempBlobUrl }));

        let cloudUrl = '';
        let cloudDownloadUrl = '';

        try {
          if (storage && BUCKET_ID) {
            const uploaded = await storage.createFile(BUCKET_ID, ID.unique(), file);
            cloudUrl = storage.getFileView(BUCKET_ID, uploaded.$id).toString();
            cloudDownloadUrl = storage.getFileDownload(BUCKET_ID, uploaded.$id).toString();
          }
        } catch (storageErr: any) {
          console.warn('Appwrite Storage 未建立 (已安全保存於本地 IndexedDB):', storageErr.message);
        }

        newAttachments.push({
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url: cloudUrl,
          downloadUrl: cloudDownloadUrl,
        });
      } catch (err) {
        console.error('處理檔案失敗:', file.name, err);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    setUploadingFiles(false);
    e.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    if (!window.confirm('確定要移除此附件檔案嗎？')) return;
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!branch.trim()) {
      alert('請選擇學校/分校！');
      return;
    }

    if (!courseName.trim()) {
      alert('請選擇課程！');
      return;
    }

    if (!unitTitle.trim()) {
      alert('請填寫單元名稱！');
      return;
    }

    const finalYtUrls = [...youtubeUrls];
    if (currentYtInput.trim() && !finalYtUrls.includes(currentYtInput.trim())) {
      finalYtUrls.push(currentYtInput.trim());
    }

    const finalGoogleUrls = [...googleUrls];
    if (currentGoogleInput.trim() && !finalGoogleUrls.includes(currentGoogleInput.trim())) {
      finalGoogleUrls.push(currentGoogleInput.trim());
    }

    setSubmitting(true);
    try {
      const cleanAttachments: HomeworkAttachment[] = attachments.map((att) => ({
        ...att,
        url: att.url && att.url.startsWith('http') ? att.url : '',
        downloadUrl: att.downloadUrl && att.downloadUrl.startsWith('http') ? att.downloadUrl : '',
      }));

      finalYtUrls.forEach((u, i) => {
        cleanAttachments.push({
          id: `link_cu_yt_${Date.now()}_${i}`,
          name: `YouTube 示範影片 #${i + 1}`,
          size: 0,
          type: 'link/youtube',
          url: u,
        });
      });

      finalGoogleUrls.forEach((u, i) => {
        cleanAttachments.push({
          id: `link_cu_gg_${Date.now()}_${i}`,
          name: getGoogleLinkMeta(u).title,
          size: 0,
          type: 'link/google',
          url: u,
        });
      });

      const unitData: Omit<CourseUnit, '$id'> = {
        branch,
        course_name: courseName,
        unit_title: unitTitle.trim(),
        description: description.trim(),
        publish_date: publishDate ? publishDate.trim() : '',
        unpublish_date: unpublishDate ? unpublishDate.trim() : '',
        youtube_urls: finalYtUrls,
        google_urls: finalGoogleUrls,
        attachments: cleanAttachments.length > 0 ? JSON.stringify(cleanAttachments) : '',
      };

      await onSubmit(unitData, initialData?.$id);
      onClose();
    } catch (err: any) {
      console.warn('提交單元表單完成:', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* 頂部 Header */}
        <div className="bg-indigo-600 text-white px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <GraduationCap size={18} />
            <h4 className="font-bold text-base">
              {initialData ? '編輯課程單元 (Edit Unit)' : '新增課程單元 (Add Unit)'}
            </h4>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto text-sm">
          {/* ⭐ 需求：如果於該課程新增課程單元，鎖上該頁的學校及課程選項 */}
          {isLocked ? (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200/90 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-indigo-900 font-bold">
                <span className="flex items-center gap-1.5">
                  <Lock size={13} className="text-indigo-600" />
                  <span>已鎖定指定學校與課程</span>
                </span>
                <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold shadow-2xs">
                  專屬此課程
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                  <span className="text-[10px] text-gray-400 block mb-0.5">學校 / 分校</span>
                  <span className="font-bold text-gray-800">{branch || '全部分校'}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs min-w-0">
                  <span className="text-[10px] text-gray-400 block mb-0.5">所屬課程</span>
                  <span className="font-bold text-indigo-700 truncate block">{courseName}</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 1. 分校 (Branch) */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <MapPin size={12} className="text-purple-600" />
                  <span>學校 / 分校 (School / Branch)</span>
                </label>
                {branches.length > 0 ? (
                  <select
                    value={branch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="w-full p-2.5 border border-purple-200 rounded-lg bg-purple-50/50 text-xs font-medium text-gray-800 outline-none focus:bg-white focus:border-indigo-600"
                  >
                    {branches.length > 1 && (
                      <option value="全部分校">全部分校 (全部學校適用)</option>
                    )}
                    {branches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="例: 分校或校舍名稱"
                    value={branch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 text-xs outline-none focus:border-indigo-600"
                  />
                )}
              </div>

              {/* 2. 課程 (Course) - ⭐ 需求：不要預選課程；如果該學校沒有課程，顯示沒有課程 */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-600 flex items-center gap-1">
                    <GraduationCap size={12} className="text-indigo-600" />
                    <span>課程 (Course)</span> <span className="text-indigo-600">*</span>
                  </label>
                  {branch && branch !== '全部分校' ? (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      availableCourses.length > 0
                        ? 'text-purple-600 bg-purple-50 border-purple-200'
                        : 'text-red-600 bg-red-50 border-red-200'
                    }`}>
                      {availableCourses.length > 0
                        ? `${branch} 專屬課程 (${availableCourses.length})`
                        : `${branch} 暫無課程`}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-500 font-medium bg-gray-100 px-1.5 py-0.5 rounded">
                      可用課程 ({availableCourses.length})
                    </span>
                  )}
                </div>

                {availableCourses.length > 0 ? (
                  <select
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    className="w-full p-2.5 border border-indigo-200 rounded-lg bg-indigo-50/50 text-xs font-medium text-gray-800 outline-none focus:bg-white focus:border-indigo-600"
                    required
                  >
                    <option value="">-- 請選擇課程 (Select Course) --</option>
                    {availableCourses.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full p-2.5 border border-red-200 rounded-lg bg-red-50 text-xs text-red-600 font-medium flex items-center justify-between">
                    <span>⚠️ 此學校暫無相關課程 (沒有課程)</span>
                    <span className="text-[10px] text-red-400">請先於課程設定建立</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 3. 單元名稱 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              單元名稱 (Unit Title) <span className="text-indigo-600">*</span>
            </label>
            <input
              type="text"
              placeholder="例: 單元一：教學主題名稱"
              value={unitTitle}
              onChange={(e) => setUnitTitle(e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 text-xs outline-none focus:border-indigo-600 focus:bg-white font-medium"
              required
            />
          </div>

          {/* 4. 上下架排程日期 (選填，無須強制填寫，方便之後安排) */}
          <div className="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                <Calendar size={12} className="text-indigo-600" />
                <span>課程進度排程 (選填)</span>
              </span>
              <span className="text-[10px] text-gray-400">
                可留空，待後續配合進度安排
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold text-gray-600">
                    上架日期 (開始)
                  </label>
                  {publishDate ? (
                    <button
                      type="button"
                      onClick={() => setPublishDate('')}
                      className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                      title="清除上架日期"
                    >
                      清空
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPublishDate(new Date().toISOString().split('T')[0])}
                      className="text-[10px] text-indigo-600 hover:underline font-semibold"
                    >
                      設為今天
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="w-full p-1.5 border border-indigo-200 rounded-lg bg-white text-xs outline-none focus:border-indigo-600"
                />
                {!publishDate && (
                  <p className="text-[9px] text-purple-600 mt-0.5">※ 未填寫：將標記為「有待安排」</p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold text-gray-600">
                    下架日期 (選填)
                  </label>
                  {unpublishDate && (
                    <button
                      type="button"
                      onClick={() => setUnpublishDate('')}
                      className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                      title="清除下架日期"
                    >
                      清空
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={unpublishDate}
                  onChange={(e) => setUnpublishDate(e.target.value)}
                  className="w-full p-1.5 border border-gray-200 rounded-lg bg-white text-xs outline-none focus:border-indigo-600"
                />
                {!unpublishDate && (
                  <p className="text-[9px] text-gray-400 mt-0.5">※ 留空代表長期開放</p>
                )}
              </div>
            </div>
          </div>

          {/* 5. 單元目標與教學內容說明 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">教學內容與單元目標 (Summary)</label>
            <textarea
              rows={3}
              placeholder="例：本單元重點教學內容與學習目標說明..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:border-indigo-600 outline-none resize-none"
            />
          </div>

          {/* 6. 線上資源 (多 YouTube 影片 與 多 Google 雲端文件連結) */}
          <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200/80 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                <Globe size={15} className="text-indigo-600" />
                <span>線上連結資源 (可新增多個連結)</span>
              </div>
              <span className="text-[10px] text-gray-400">
                YouTube: {youtubeUrls.length} | Google: {googleUrls.length}
              </span>
            </div>

            {/* YouTube 影片連結 */}
            <div>
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-1">
                <YoutubeIcon size={15} className="text-red-600" />
                <span>YouTube 示範影片連結 (可多選)</span>
              </label>

              {youtubeUrls.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {youtubeUrls.map((u, idx) => {
                    const ytId = extractYoutubeId(u);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-1.5 px-2 bg-red-50/70 border border-red-200 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <YoutubeIcon size={14} className="text-red-600 shrink-0" />
                          <span className="truncate text-red-900 text-[11px] font-medium max-w-[200px]">
                            {u}
                          </span>
                          {ytId && (
                            <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.2 rounded font-bold shrink-0">
                              ID: {ytId}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveYoutube(idx)}
                          className="text-red-400 hover:text-red-600 p-0.5"
                          title="移除此影片"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-1.5">
                <input
                  type="url"
                  placeholder="例: https://youtu.be/... (按加入)"
                  value={currentYtInput}
                  onChange={(e) => setCurrentYtInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddYoutube();
                    }
                  }}
                  className="flex-1 p-2 border border-gray-200 rounded-lg bg-white text-xs outline-none focus:border-red-500 text-gray-800"
                />
                <button
                  type="button"
                  onClick={handleAddYoutube}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <Plus size={13} />
                  <span>加入</span>
                </button>
              </div>
            </div>

            {/* Google 雲端 / 文件連結 */}
            <div>
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-1">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-black text-[9px] flex items-center justify-center">
                  G
                </span>
                <span>Google 雲端 / 文件連結 (可多選)</span>
              </label>

              {googleUrls.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {googleUrls.map((u, idx) => {
                    const meta = getGoogleLinkMeta(u);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-1.5 px-2 bg-blue-50/70 border border-blue-200 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-3.5 h-3.5 rounded ${meta.iconColor} text-white font-black text-[8px] flex items-center justify-center shrink-0`}>
                            G
                          </span>
                          <span className="text-[10px] bg-white text-blue-700 px-1 py-0.2 rounded border border-blue-200 font-semibold shrink-0">
                            {meta.tag}
                          </span>
                          <span className="truncate text-blue-900 text-[11px] font-medium max-w-[170px]">
                            {u}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveGoogle(idx)}
                          className="text-blue-400 hover:text-red-500 p-0.5"
                          title="移除此連結"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-1.5">
                <input
                  type="url"
                  placeholder="例: https://docs.google.com/presentation/... (按加入)"
                  value={currentGoogleInput}
                  onChange={(e) => setCurrentGoogleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddGoogle();
                    }
                  }}
                  className="flex-1 p-2 border border-gray-200 rounded-lg bg-white text-xs outline-none focus:border-blue-500 text-gray-800"
                />
                <button
                  type="button"
                  onClick={handleAddGoogle}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <Plus size={13} />
                  <span>加入</span>
                </button>
              </div>
            </div>
          </div>

          {/* 7. 上載多個檔案 / 影片 (Video) / 圖片 / 音訊 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-gray-600">
                單元教學多媒體附件 (Videos, Audio & Files) <span className="text-gray-400 font-normal">可多選</span>
              </label>
              {attachments.length > 0 && (
                <span className="text-[11px] text-indigo-600 font-medium">
                  已選 {attachments.length} 個檔案
                </span>
              )}
            </div>

            <label className="border-2 border-dashed border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 bg-gray-50 hover:bg-indigo-50/40 hover:border-indigo-400 cursor-pointer transition-colors">
              {uploadingFiles ? (
                <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs py-1">
                  <Loader2 size={18} className="animate-spin" />
                  <span>正在安全保存檔案...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-gray-600 font-semibold text-xs">
                    <UploadCloud size={18} className="text-indigo-600" />
                    <span>點擊或拖曳上載教學 MP4 影片、伴奏 MP3、簡報或教材</span>
                  </div>
                  <span className="text-[10px] text-gray-400 text-center">
                    完整支援 MP4 視訊、MP3 音訊、PDF 工作紙，原貌無損保存
                  </span>
                </>
              )}
              <input
                type="file"
                multiple
                accept="video/*,.mp4,.mov,.webm,.avi,.mkv,audio/*,.mp3,.wav,.m4a,image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                onChange={handleFileUpload}
                disabled={uploadingFiles}
                className="hidden"
              />
            </label>

            {attachments.length > 0 && (
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {attachments.map((att, idx) => {
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
                  const previewUrl = sessionPreviewUrls[att.id] || (att.url && att.url.startsWith('http') ? att.url : '');

                  return (
                    <div
                      key={att.id || idx}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isVideo ? (
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                            <Video size={16} />
                          </div>
                        ) : isAudio ? (
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                            <Music size={16} />
                          </div>
                        ) : isImage && previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={att.name}
                            className="w-8 h-8 object-cover rounded shrink-0 border border-gray-200"
                          />
                        ) : (
                          <FileText size={20} className="text-blue-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate text-[11px] max-w-[180px]">
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
                        onClick={() => handleRemoveAttachment(idx)}
                        className="text-gray-400 hover:text-red-500 p-1"
                        title="移除附件"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleResetAndClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingFiles}
              className="flex-2 py-3 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 shadow-md"
            >
              <Save size={16} />
              <span>{submitting ? '儲存中...' : initialData ? '更新課程單元' : '確認發布課程單元'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
