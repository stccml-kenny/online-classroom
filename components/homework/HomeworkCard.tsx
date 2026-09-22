import React, { useState, useEffect } from 'react';
import {
  Calendar, Trash2, Edit2, Download, FileText, Music, Video, Play, Pause, ExternalLink, Clock, ChevronDown, ChevronUp, CheckSquare, Square
} from 'lucide-react';
import { getLocalFile } from '@/utils/indexedDB';

export interface HomeworkAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  downloadUrl?: string;
}

export interface HomeworkItem {
  $id?: string;
  branch?: string;
  course_name?: string;
  unit_id?: string;
  unit_title?: string;
  title: string;
  description?: string;
  due_date: string;
  publish_date?: string;   // 上架排程日期 (選填)
  unpublish_date?: string; // 下架排程日期 (選填)
  attachments?: string | HomeworkAttachment[];
  youtube_url?: string;
  youtube_urls?: string[];
  google_url?: string;
  google_urls?: string[];
}

interface HomeworkCardProps {
  item: HomeworkItem;
  onEdit: (item: HomeworkItem) => void;
  onDelete: (id: string) => void;
  selectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  defaultExpanded?: boolean;
}

// 內建專屬 YouTube SVG 圖示
export const YoutubeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export const extractYoutubeId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
};

export const getGoogleLinkMeta = (url: string) => {
  if (!url) return { title: 'Google 雲端連結', tag: 'Google', iconColor: 'bg-blue-600', textColor: 'text-blue-700' };
  const lower = url.toLowerCase();
  if (lower.includes('drive.google.com')) {
    return { title: 'Google 雲端硬碟 (Drive)', tag: 'Google Drive', iconColor: 'bg-emerald-600', textColor: 'text-emerald-700' };
  }
  if (lower.includes('docs.google.com/document')) {
    return { title: 'Google 文件 (Docs)', tag: 'Google Docs', iconColor: 'bg-blue-600', textColor: 'text-blue-700' };
  }
  if (lower.includes('docs.google.com/spreadsheets')) {
    return { title: 'Google 試算表 (Sheets)', tag: 'Google Sheets', iconColor: 'bg-green-600', textColor: 'text-green-700' };
  }
  if (lower.includes('docs.google.com/presentation')) {
    return { title: 'Google 簡報 (Slides)', tag: 'Google Slides', iconColor: 'bg-amber-600', textColor: 'text-amber-700' };
  }
  if (lower.includes('docs.google.com/forms') || lower.includes('forms.gle')) {
    return { title: 'Google 表單問卷 (Forms)', tag: 'Google Forms', iconColor: 'bg-purple-600', textColor: 'text-purple-700' };
  }
  if (lower.includes('meet.google.com')) {
    return { title: 'Google Meet 視訊會議', tag: 'Google Meet', iconColor: 'bg-teal-600', textColor: 'text-teal-700' };
  }
  return { title: 'Google 雲端資源連結', tag: 'Google 資源', iconColor: 'bg-blue-600', textColor: 'text-blue-700' };
};

// 輔助函式：判斷家課上架狀態 (支援「有待安排」)
export const getHomeworkPublishStatus = (publishDate?: string, unpublishDate?: string) => {
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

export const HomeworkCard: React.FC<HomeworkCardProps> = ({
  item,
  onEdit,
  onDelete,
  selectable = false,
  isSelected = false,
  onToggleSelect,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  let attachments: HomeworkAttachment[] = [];
  let rawAtt: string | HomeworkAttachment[] | null | undefined = item.attachments;

  if (!rawAtt && item.$id && typeof window !== 'undefined') {
    rawAtt = localStorage.getItem(`oc_hw_att_${item.$id}`) || '';
  }

  if (rawAtt) {
    if (typeof rawAtt === 'string') {
      try {
        attachments = JSON.parse(rawAtt);
      } catch (e) {
        attachments = [];
      }
    } else if (Array.isArray(rawAtt)) {
      attachments = rawAtt;
    }
  }

  // 匯總多個 YouTube 連結
  const youtubeUrlSet = new Set<string>();
  if (item.youtube_urls && Array.isArray(item.youtube_urls)) {
    item.youtube_urls.forEach((u) => u && youtubeUrlSet.add(u.trim()));
  }
  if (item.youtube_url) {
    youtubeUrlSet.add(item.youtube_url.trim());
  }

  // 匯總多個 Google 連結
  const googleUrlSet = new Set<string>();
  if (item.google_urls && Array.isArray(item.google_urls)) {
    item.google_urls.forEach((u) => u && googleUrlSet.add(u.trim()));
  }
  if (item.google_url) {
    googleUrlSet.add(item.google_url.trim());
  }

  if (typeof window !== 'undefined' && item.$id) {
    try {
      const savedLinks = localStorage.getItem(`oc_hw_links_${item.$id}`);
      if (savedLinks) {
        const parsed = JSON.parse(savedLinks);
        if (parsed.youtube_urls && Array.isArray(parsed.youtube_urls)) {
          parsed.youtube_urls.forEach((u: string) => u && youtubeUrlSet.add(u.trim()));
        } else if (parsed.youtube_url) {
          youtubeUrlSet.add(parsed.youtube_url.trim());
        }

        if (parsed.google_urls && Array.isArray(parsed.google_urls)) {
          parsed.google_urls.forEach((u: string) => u && googleUrlSet.add(u.trim()));
        } else if (parsed.google_url) {
          googleUrlSet.add(parsed.google_url.trim());
        }
      }
    } catch (e) {}
  }

  attachments.forEach((att) => {
    if (att.type === 'link/youtube' || att.url?.includes('youtube.com') || att.url?.includes('youtu.be')) {
      if (att.url) youtubeUrlSet.add(att.url.trim());
    }
    if (att.type === 'link/google' || att.url?.includes('google.com') || att.url?.includes('forms.gle')) {
      if (att.url) googleUrlSet.add(att.url.trim());
    }
  });

  const allYoutubeUrls = Array.from(youtubeUrlSet);
  const allGoogleUrls = Array.from(googleUrlSet);

  const fileAttachments = attachments.filter(
    (att) =>
      att.type !== 'link/youtube' &&
      att.type !== 'link/google' &&
      !att.url?.includes('youtube.com') &&
      !att.url?.includes('youtu.be') &&
      !att.url?.includes('google.com') &&
      !att.url?.includes('forms.gle')
  );

  const [resolvedBlobUrls, setResolvedBlobUrls] = useState<Record<string, string>>({});
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const resolveFiles = async () => {
      const urls: Record<string, string> = {};
      for (const att of fileAttachments) {
        if (att.url && att.url.startsWith('http')) {
          urls[att.id] = att.url;
        } else {
          try {
            const blob = await getLocalFile(att.id);
            if (blob && active) {
              urls[att.id] = URL.createObjectURL(blob);
            }
          } catch (err) {
            console.warn('無法從本機提取檔案 Blob:', att.name);
          }
        }
      }
      if (active) {
        setResolvedBlobUrls(urls);
      }
    };

    if (fileAttachments.length > 0 && isExpanded) {
      resolveFiles();
    }

    return () => {
      active = false;
    };
  }, [item.$id, rawAtt, isExpanded]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('zh-HK', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

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
    const audioEl = document.getElementById(`audio-player-${attId}`) as HTMLAudioElement | null;
    if (!audioEl) return;

    if (playingAudioId === attId) {
      audioEl.pause();
      setPlayingAudioId(null);
    } else {
      if (playingAudioId) {
        const prevEl = document.getElementById(`audio-player-${playingAudioId}`) as HTMLAudioElement | null;
        if (prevEl) prevEl.pause();
      }
      audioEl.play().catch((e) => console.warn('自動播放被阻止:', e));
      setPlayingAudioId(attId);
    }
  };

  const pubStatus = getHomeworkPublishStatus(item.publish_date, item.unpublish_date);

  return (
    <div
      className={`bg-white rounded-2xl border transition-all text-sm relative ${
        isSelected
          ? 'border-[#FF6B57] ring-2 ring-[#FF6B57]/20 shadow-md'
          : 'border-gray-200/90 hover:border-gray-300 shadow-xs'
      }`}
    >
      {/* 頂部標題列 (預設精簡顯示項目名稱，點擊展開/收合所有內容) */}
      <div className="p-3.5 flex items-start gap-2.5">
        {/* 多選 Checkbox */}
        {selectable && item.$id && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect && onToggleSelect(item.$id!);
            }}
            className="pt-0.5 text-[#FF6B57] shrink-0"
          >
            {isSelected ? (
              <CheckSquare size={18} className="text-[#FF6B57]" />
            ) : (
              <Square size={18} className="text-gray-300 hover:text-gray-500" />
            )}
          </button>
        )}

        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 min-w-0 cursor-pointer select-none"
        >
          {/* 標籤徽章列 */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pubStatus.badgeClass}`}>
              {pubStatus.label}
            </span>
            {item.course_name && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {item.course_name}
              </span>
            )}
            {item.branch && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                {item.branch}
              </span>
            )}
            {item.unit_title && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {item.unit_title}
              </span>
            )}
          </div>

          {/* ⭐ 項目名稱 (預設突出顯示) */}
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-bold text-gray-900 text-sm leading-snug truncate">
              {item.title}
            </h4>
            <div className="flex items-center gap-1 text-orange-600 font-semibold text-xs whitespace-nowrap shrink-0">
              <Calendar size={13} />
              <span>{formatDate(item.due_date)} 截止</span>
            </div>
          </div>

          {/* 收合狀態下之精簡提示 */}
          {!isExpanded && (
            <div className="flex items-center justify-between mt-1.5 text-[11px] text-gray-400">
              <div className="flex items-center gap-2">
                {allYoutubeUrls.length > 0 && <span>📹 {allYoutubeUrls.length} 部影片</span>}
                {allGoogleUrls.length > 0 && <span>📄 {allGoogleUrls.length} 個雲端文件</span>}
                {fileAttachments.length > 0 && <span>📎 {fileAttachments.length} 個檔案</span>}
                {!allYoutubeUrls.length && !allGoogleUrls.length && !fileAttachments.length && (
                  <span>點擊展開查看作業說明</span>
                )}
              </div>
              <span className="text-indigo-600 font-semibold text-[10px] flex items-center gap-0.5">
                <span>點擊展開</span>
                <ChevronDown size={12} />
              </span>
            </div>
          )}
        </div>

        {/* 編輯 / 刪除與收合箭頭 */}
        <div className="flex items-center gap-1 text-gray-400 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            className="p-1 hover:text-indigo-600 transition-colors"
            title="修改家課"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              item.$id && onDelete(item.$id);
            }}
            className="p-1 hover:text-red-600 transition-colors"
            title="刪除家課"
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-gray-600"
            title={isExpanded ? '收合' : '展開'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* ⭐ 展開後的完整內容與所有連結 (只有用家點擊後才顯示) */}
      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-gray-100 space-y-2.5">
          {/* 上下架排程時間提示 */}
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <Clock size={11} className={item.publish_date ? "text-gray-400" : "text-purple-500"} />
            <span>
              {item.publish_date
                ? `上架排程：${item.publish_date} ~ ${item.unpublish_date || '無限期'}`
                : '上架排程：有待安排 (未設定上架日)'}
            </span>
          </div>

          {/* 細項說明與要求 */}
          {item.description && (
            <div className="text-gray-600 text-xs bg-gray-50/70 p-2.5 rounded-xl whitespace-pre-wrap leading-relaxed border border-gray-100">
              {item.description}
            </div>
          )}

          {/* 🔴 1. YouTube 示範影片區塊 */}
          {allYoutubeUrls.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-[11px] font-bold text-red-600">
                <YoutubeIcon size={14} />
                <span>YouTube 示範影片 ({allYoutubeUrls.length} 部)：</span>
              </div>
              {allYoutubeUrls.map((ytUrl, idx) => {
                const ytId = extractYoutubeId(ytUrl);
                return (
                  <div key={idx} className="bg-red-50/40 border border-red-100 rounded-xl p-2.5">
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                        <YoutubeIcon size={15} />
                        <span>示範影片 {allYoutubeUrls.length > 1 ? `#${idx + 1}` : ''}</span>
                      </div>
                      <a
                        href={ytUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-0.5"
                      >
                        <span>在 YouTube 觀看</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>

                    {ytId ? (
                      <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-inner bg-black">
                        <iframe
                          src={`https://www.youtube.com/embed/${ytId}`}
                          title={`YouTube 示範影片 #${idx + 1}`}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <p className="text-[10px] text-red-500 truncate">{ytUrl}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 🔵 2. Google 雲端 / 文件連結區塊 */}
          {allGoogleUrls.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-blue-700">
                Google 雲端與文件連結 ({allGoogleUrls.length} 個)：
              </div>
              {allGoogleUrls.map((ggUrl, idx) => {
                const googleInfo = getGoogleLinkMeta(ggUrl);
                return (
                  <a
                    key={idx}
                    href={ggUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 bg-blue-50/60 hover:bg-blue-100/80 border border-blue-200 rounded-xl transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg ${googleInfo.iconColor} text-white flex items-center justify-center shrink-0 shadow-xs font-black text-xs`}>
                        G
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-gray-900 truncate">{googleInfo.title}</p>
                          <span className="text-[10px] bg-white text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-semibold shrink-0">
                            {googleInfo.tag}
                          </span>
                        </div>
                        <p className="text-[10px] text-blue-500 truncate max-w-[220px]">{ggUrl}</p>
                      </div>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                      <span>開啟</span>
                      <ExternalLink size={11} />
                    </span>
                  </a>
                );
              })}
            </div>
          )}

          {/* 📁 3. 實體檔案附件區塊 */}
          {fileAttachments.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-semibold text-gray-400">
                檔案與多媒體附件 ({fileAttachments.length} 個檔案)：
              </p>

              <div className="space-y-2">
                {fileAttachments.map((att, idx) => {
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
                      className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-200 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {isVideo ? (
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                              <Video size={16} />
                            </div>
                          ) : isAudio ? (
                            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                              <Music size={16} />
                            </div>
                          ) : isImage && fileUrl ? (
                            <img
                              src={fileUrl}
                              alt={att.name}
                              className="w-8 h-8 object-cover rounded shrink-0 border border-gray-200"
                            />
                          ) : (
                            <FileText size={18} className="text-blue-500 shrink-0" />
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
                          className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg border border-gray-200 shadow-2xs transition-colors shrink-0"
                          title="下載檔案"
                        >
                          <Download size={12} />
                          <span>下載</span>
                        </button>
                      </div>

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

                      {isAudio && fileUrl && (
                        <div className="flex items-center gap-2 mt-1 bg-white p-1.5 rounded-lg border border-gray-200">
                          <audio
                            id={`audio-player-${att.id}`}
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
                            {playingAudioId === att.id ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center text-[10px] text-gray-500 font-medium">
                              <span>{playingAudioId === att.id ? '正在播放音訊...' : '點擊左方按鈕播放'}</span>
                              <span className="text-amber-600 font-semibold">MP3 音訊</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
