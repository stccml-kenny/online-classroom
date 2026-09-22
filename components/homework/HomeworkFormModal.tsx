import React, { useState, useEffect } from 'react';
import {
  X, Save, BookOpen, UploadCloud, FileText, Check, ChevronDown, Music, Video, Loader2, ExternalLink, Globe, Plus, Calendar
} from 'lucide-react';
import { HomeworkItem, HomeworkAttachment, extractYoutubeId, getGoogleLinkMeta, YoutubeIcon } from './HomeworkCard';
import { storage, BUCKET_ID } from '@/lib/appwrite';
import { storeLocalFile } from '@/utils/indexedDB';
import { ID } from 'appwrite';

interface HomeworkFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<HomeworkItem, '$id'>, id?: string) => Promise<void>;
  initialData?: HomeworkItem | null;
  branches: string[];
  courses: string[];
  targetUnitId?: string;
  targetUnitTitle?: string;
}

export const HomeworkFormModal: React.FC<HomeworkFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  branches,
  courses,
  targetUnitId,
  targetUnitTitle,
}) => {
  const [branch, setBranch] = useState(branches[0] || '');
  const [courseName, setCourseName] = useState(courses[0] || '');
  const [unitId, setUnitId] = useState(targetUnitId || '');
  const [unitTitle, setUnitTitle] = useState(targetUnitTitle || '');
  
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');

  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  // 上下架排程日期 (上架日期為選填，無須強制立即填寫，可留空待日後安排)
  const [publishDate, setPublishDate] = useState('');
  const [unpublishDate, setUnpublishDate] = useState('');

  // 支援多個 YouTube 影片連結
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([]);
  const [currentYtInput, setCurrentYtInput] = useState('');

  // 支援多個 Google 雲端 / 文件連結
  const [googleUrls, setGoogleUrls] = useState<string[]>([]);
  const [currentGoogleInput, setCurrentGoogleInput] = useState('');
  
  const [attachments, setAttachments] = useState<HomeworkAttachment[]>([]);
  const [sessionPreviewUrls, setSessionPreviewUrls] = useState<Record<string, string>>({});
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setBranch(initialData.branch || branches[0] || '');
      setCourseName(initialData.course_name || courses[0] || '');
      setUnitId(initialData.unit_id || targetUnitId || '');
      setUnitTitle(initialData.unit_title || targetUnitTitle || '');
      
      if (initialData.title) {
        const split = initialData.title.split(/[、\n]+/).map((t) => t.trim()).filter(Boolean);
        setSelectedTitles(split.length > 0 ? split : [initialData.title]);
      } else {
        setSelectedTitles([]);
      }
      setCurrentInput('');

      setDescription(initialData.description || '');
      setDueDate(initialData.due_date ? initialData.due_date.split('T')[0] : '');
      setPublishDate(initialData.publish_date ? initialData.publish_date.split('T')[0] : '');
      setUnpublishDate(initialData.unpublish_date ? initialData.unpublish_date.split('T')[0] : '');

      const ytList: string[] = [];
      if (initialData.youtube_urls && Array.isArray(initialData.youtube_urls)) {
        initialData.youtube_urls.forEach((u) => u && ytList.push(u.trim()));
      }
      if (initialData.youtube_url && !ytList.includes(initialData.youtube_url.trim())) {
        ytList.push(initialData.youtube_url.trim());
      }

      const ggList: string[] = [];
      if (initialData.google_urls && Array.isArray(initialData.google_urls)) {
        initialData.google_urls.forEach((u) => u && ggList.push(u.trim()));
      }
      if (initialData.google_url && !ggList.includes(initialData.google_url.trim())) {
        ggList.push(initialData.google_url.trim());
      }

      let rawAtt: string | HomeworkAttachment[] | null | undefined = initialData.attachments;
      if (!rawAtt && initialData.$id && typeof window !== 'undefined') {
        rawAtt = localStorage.getItem(`oc_hw_att_${initialData.$id}`) || '';
      }

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
      setCurrentYtInput('');
      setGoogleUrls(ggList);
      setCurrentGoogleInput('');
      setAttachments(physicalAtts);
    } else {
      setBranch(branches[0] || '');
      setCourseName(courses[0] || '');
      setUnitId(targetUnitId || '');
      setUnitTitle(targetUnitTitle || '');
      setSelectedTitles([]);
      setCurrentInput('');
      setDescription('');
      // 新增時上架日期可不用立即填上，預設留空待之後安排
      setPublishDate('');
      setUnpublishDate('');
      setYoutubeUrls([]);
      setCurrentYtInput('');
      setGoogleUrls([]);
      setCurrentGoogleInput('');
      setAttachments([]);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDueDate(tomorrow.toISOString().split('T')[0]);
    }
  }, [initialData, isOpen, branches, courses, targetUnitId, targetUnitTitle]);

  if (!isOpen) return null;

  const handleAddTitle = (titleToAdd: string, defaultDesc?: string) => {
    const val = titleToAdd.trim();
    if (!val) return;
    if (!selectedTitles.includes(val)) {
      setSelectedTitles((prev) => [...prev, val]);
    }
    if (defaultDesc && defaultDesc.trim()) {
      setDescription((prev) => {
        if (!prev.trim()) return defaultDesc.trim();
        if (prev.includes(defaultDesc.trim())) return prev;
        return prev + '\n' + defaultDesc.trim();
      });
    }
    setCurrentInput('');
  };

  const handleRemoveTitle = (index: number) => {
    if (!window.confirm('確定要移除此功課項目嗎？')) return;
    setSelectedTitles((prev) => prev.filter((_, idx) => idx !== index));
  };

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
      const fileId = 'file_hw_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

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
          console.warn('Appwrite Storage 存儲桶未建立 (已安全保存於本地 IndexedDB):', storageErr.message);
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

    let finalTitles = [...selectedTitles];
    if (currentInput.trim() && !finalTitles.includes(currentInput.trim())) {
      finalTitles.push(currentInput.trim());
    }

    if (finalTitles.length === 0) {
      alert('請填寫或選擇至少一項「功課項目」！');
      return;
    }

    if (!dueDate) {
      alert('請填寫截止日期！');
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
          id: `link_yt_${Date.now()}_${i}`,
          name: `YouTube 示範影片 #${i + 1}`,
          size: 0,
          type: 'link/youtube',
          url: u,
        });
      });

      finalGoogleUrls.forEach((u, i) => {
        cleanAttachments.push({
          id: `link_gg_${Date.now()}_${i}`,
          name: getGoogleLinkMeta(u).title,
          size: 0,
          type: 'link/google',
          url: u,
        });
      });

      const homeworkData: Omit<HomeworkItem, '$id'> = {
        branch,
        course_name: courseName,
        unit_id: unitId || undefined,
        unit_title: unitTitle || undefined,
        title: finalTitles.join('、'),
        description: description.trim(),
        due_date: new Date(dueDate).toISOString(),
        publish_date: publishDate ? publishDate.trim() : '',
        unpublish_date: unpublishDate ? unpublishDate.trim() : '',
        attachments: cleanAttachments.length > 0 ? JSON.stringify(cleanAttachments) : '',
        youtube_url: finalYtUrls[0] || '',
        youtube_urls: finalYtUrls,
        google_url: finalGoogleUrls[0] || '',
        google_urls: finalGoogleUrls,
      };

      await onSubmit(homeworkData, initialData?.$id);
      onClose();
    } catch (err: any) {
      console.warn('提交家課表單完成:', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-[#FF6B57] text-white px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen size={18} />
            <div>
              <h4 className="font-bold text-base leading-tight">
                {initialData ? '修改家課項目 (Amend)' : '發布新家課 (Post Homework)'}
              </h4>
              {unitTitle && (
                <p className="text-[11px] text-white/90">
                  關聯單元：{unitTitle}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto text-sm">
          {/* 1. 分校 (Branch) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">分校 (Branch)</label>
            {branches.length > 0 ? (
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 text-xs outline-none focus:bg-white focus:border-[#FF6B57]"
              >
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="例: 分校或校舍名稱"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 text-xs outline-none focus:border-[#FF6B57]"
              />
            )}
          </div>

          {/* 2. 課程 (Course) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">課程 (Course)</label>
            {courses.length > 0 ? (
              <select
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 text-xs outline-none focus:bg-white focus:border-[#FF6B57]"
              >
                {courses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="例: 課程名稱"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 text-xs outline-none focus:border-[#FF6B57]"
                required
              />
            )}
          </div>

          {/* 3. 上下架排程日期 (選填，無須強制立即填寫，可留空待日後安排) */}
          <div className="bg-orange-50/50 p-2.5 rounded-xl border border-orange-100 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-orange-900 flex items-center gap-1">
                <Calendar size={12} className="text-orange-600" />
                <span>家課上架排程 (選填)</span>
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
                      className="text-[10px] text-orange-600 hover:underline font-semibold"
                    >
                      設為今天
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="w-full p-1.5 border border-orange-200 rounded-lg bg-white text-xs outline-none focus:border-[#FF6B57]"
                />
                {!publishDate && (
                  <p className="text-[9px] text-purple-600 mt-0.5">※ 未填寫：標記為「有待安排」</p>
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
                  className="w-full p-1.5 border border-orange-200 rounded-lg bg-white text-xs outline-none focus:border-[#FF6B57]"
                />
                {!unpublishDate && (
                  <p className="text-[9px] text-gray-400 mt-0.5">※ 留空代表長期開放</p>
                )}
              </div>
            </div>
          </div>

          {/* 4. 功課項目 */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-gray-600">
                功課項目 <span className="text-[#FF6B57] font-bold">＊可多選</span>
              </label>
              <span className="text-[11px] text-orange-600 font-medium">
                已選 {selectedTitles.length + (currentInput.trim() ? 1 : 0)} 項
              </span>
            </div>

            {selectedTitles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-orange-50/50 border border-orange-100 rounded-xl">
                {selectedTitles.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-white text-orange-950 border border-orange-200 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTitle(idx)}
                      className="text-orange-400 hover:text-red-500 font-bold text-sm leading-none"
                      title="移除此項"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

                        <div className="relative flex items-center">
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTitle(currentInput);
                  }
                }}
                placeholder={
                  selectedTitles.length === 0
                    ? "輸入功課項目 (例: 習作第 1-3 頁，按加入)..."
                    : "+ 繼續輸入下一項功課..."
                }
                className="w-full p-2.5 pr-16 border border-gray-200 rounded-lg bg-gray-50 text-xs outline-none focus:border-[#FF6B57] focus:bg-white text-gray-800 font-medium"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAddTitle(currentInput)}
                  className="px-3 py-1 bg-[#FF6B57] text-white rounded text-xs font-bold hover:bg-[#e05a48] transition-colors shadow-2xs"
                >
                  加入
                </button>
              </div>
            </div>
          </div>

          {/* 5. 截止日期 (Due Date) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">截止日期 (Due Date)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 text-xs outline-none focus:border-[#FF6B57]"
              required
            />
          </div>

          {/* 6. 細項說明 / 要求 (Items / Details) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">細項說明 / 要求 (Items / Details)</label>
            <textarea
              rows={3}
              placeholder="例：細項說明與作業要求..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:border-[#FF6B57] outline-none resize-none"
            />
          </div>

          {/* 7. 線上資源 (支援多個 YouTube 影片 與 多個 Google 雲端文件連結) */}
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
                  placeholder="例: https://docs.google.com/document/d/... (按加入)"
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

          {/* 8. 上載多個文件 / 影片 (Video) / 圖片 / 音訊 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-gray-600">
                本機附件 (Videos, Audio, Images & Files) <span className="text-gray-400 font-normal">可多選</span>
              </label>
              {attachments.length > 0 && (
                <span className="text-[11px] text-indigo-600 font-medium">
                  已選 {attachments.length} 個檔案
                </span>
              )}
            </div>

            <label className="border-2 border-dashed border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 bg-gray-50 hover:bg-orange-50/40 hover:border-[#FF6B57] cursor-pointer transition-colors">
              {uploadingFiles ? (
                <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs py-1">
                  <Loader2 size={18} className="animate-spin" />
                  <span>正在安全保存檔案...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-gray-600 font-semibold text-xs">
                    <UploadCloud size={18} className="text-[#FF6B57]" />
                    <span>點擊或拖曳上載 MP4 影片、MP3 音訊、圖片或文件</span>
                  </div>
                  <span className="text-[10px] text-gray-400 text-center">
                    完整支援 MP4/MOV 影片、MP3 音訊、PDF 工作紙、圖片，完整保留檔案原貌
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

          <button
            type="submit"
            disabled={submitting || uploadingFiles}
            className="w-full py-3 bg-[#FF6B57] text-white font-bold rounded-xl text-xs hover:bg-[#e05a48] transition-colors flex items-center justify-center gap-1.5 shadow-md"
          >
            <Save size={16} />
            <span>{submitting ? '儲存中...' : initialData ? '更新家課' : '發布家課'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
