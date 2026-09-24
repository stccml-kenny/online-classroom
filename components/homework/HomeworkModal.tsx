import React, { useState, useEffect } from 'react';
import { X, Plus, BookOpen, Settings } from 'lucide-react';
import { HomeworkCard, HomeworkItem } from './HomeworkCard';
import { HomeworkFormModal } from './HomeworkFormModal';
import { CourseItem } from './HomeworkSetupModal';
import { databases, DATABASE_ID } from '@/lib/appwrite';
import { ID, Query } from 'appwrite';

interface HomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: string[];
  courses: string[];
  courseItems?: (string | CourseItem)[]; // ⭐ 支援課程物件結構
  onDataChanged?: () => void;
  onOpenSetup?: () => void;
}

export const HomeworkModal: React.FC<HomeworkModalProps> = ({
  isOpen,
  onClose,
  branches,
  courses,
  courseItems = [],
  onDataChanged,
  onOpenSetup,
}) => {
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('全部分校');
  const [selectedCourse, setSelectedCourse] = useState<string>('全部課程');
  const [loading, setLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HomeworkItem | null>(null);

  const handleResetAndClose = () => {
    setSelectedBranch('全部');
    setSelectedCourse('全部');
    setFormOpen(false);
    setEditingItem(null);
    onClose();
  };

  const prevOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (prevOpenRef.current && !isOpen) {
      setSelectedBranch('全部');
      setSelectedCourse('全部');
      setFormOpen(false);
      setEditingItem(null);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);


  const fetchHomework = async () => {
    setLoading(true);
    try {
      const res = await databases.listDocuments(
        DATABASE_ID,
        'homework',
        [Query.orderDesc('$createdAt'), Query.limit(100)]
      );
      const docs = res.documents.map((doc: any) => {
        let att = doc.attachments;
        if (!att && typeof window !== 'undefined') {
          att = localStorage.getItem(`oc_hw_att_${doc.$id}`) || '';
        }

        const ytSet = new Set<string>();
        const ggSet = new Set<string>();

        if (doc.youtube_urls && Array.isArray(doc.youtube_urls)) {
          doc.youtube_urls.forEach((u: string) => u && ytSet.add(u.trim()));
        }
        if (doc.youtube_url) ytSet.add(doc.youtube_url.trim());

        if (doc.google_urls && Array.isArray(doc.google_urls)) {
          doc.google_urls.forEach((u: string) => u && ggSet.add(u.trim()));
        }
        if (doc.google_url) ggSet.add(doc.google_url.trim());

        // 從本地快取補齊多個連結
        if (typeof window !== 'undefined') {
          try {
            const savedLinks = localStorage.getItem(`oc_hw_links_${doc.$id}`);
            if (savedLinks) {
              const parsed = JSON.parse(savedLinks);
              if (parsed.youtube_urls && Array.isArray(parsed.youtube_urls)) {
                parsed.youtube_urls.forEach((u: string) => u && ytSet.add(u.trim()));
              } else if (parsed.youtube_url) {
                ytSet.add(parsed.youtube_url.trim());
              }

              if (parsed.google_urls && Array.isArray(parsed.google_urls)) {
                parsed.google_urls.forEach((u: string) => u && ggSet.add(u.trim()));
              } else if (parsed.google_url) {
                ggSet.add(parsed.google_url.trim());
              }
            }
          } catch (e) {}
        }

        // 從附件中提取
        if (att) {
          try {
            const parsedAtt = typeof att === 'string' ? JSON.parse(att) : att;
            if (Array.isArray(parsedAtt)) {
              parsedAtt.forEach((a: any) => {
                if (a.type === 'link/youtube' || a.url?.includes('youtube.com') || a.url?.includes('youtu.be')) {
                  if (a.url) ytSet.add(a.url.trim());
                }
                if (a.type === 'link/google' || a.url?.includes('google.com') || a.url?.includes('forms.gle')) {
                  if (a.url) ggSet.add(a.url.trim());
                }
              });
            }
          } catch (e) {}
        }

        const finalYt = Array.from(ytSet);
        const finalGg = Array.from(ggSet);

        return {
          ...doc,
          attachments: att,
          youtube_url: finalYt[0] || '',
          youtube_urls: finalYt,
          google_url: finalGg[0] || '',
          google_urls: finalGg,
        };
      });
      setHomeworkList(docs as unknown as HomeworkItem[]);
    } catch (err: any) {
      console.log('讀取雲端家課表略過或離線中:', err.message);
      try {
        const saved = localStorage.getItem('oc_local_homework');
        if (saved) {
          setHomeworkList(JSON.parse(saved));
        }
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHomework();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFormSubmit = async (data: Omit<HomeworkItem, '$id'>, id?: string) => {
    const targetId = id || 'hw_' + Date.now();

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          `oc_hw_links_${targetId}`,
          JSON.stringify({
            youtube_url: data.youtube_url || '',
            youtube_urls: data.youtube_urls || (data.youtube_url ? [data.youtube_url] : []),
            google_url: data.google_url || '',
            google_urls: data.google_urls || (data.google_url ? [data.google_url] : []),
          })
        );
        if (data.attachments) {
          localStorage.setItem(
            `oc_hw_att_${targetId}`,
            typeof data.attachments === 'string' ? data.attachments : JSON.stringify(data.attachments)
          );
        }
      } catch (e) {
        console.warn('LocalStorage quota limit reached:', e);
      }
    }

    const payload: any = {
      branch: data.branch || '',
      course_name: data.course_name || '',
      title: data.title,
      description: data.description || '',
      due_date: data.due_date,
    };

    if (data.youtube_url) payload.youtube_url = data.youtube_url;
    if (data.google_url) payload.google_url = data.google_url;

    if (data.attachments && typeof data.attachments === 'string' && data.attachments.length > 2 && data.attachments.length < 40000) {
      payload.attachments = data.attachments;
    }

    let successInCloud = false;
    let createdDocId = id || '';

    try {
      if (id) {
        await databases.updateDocument(DATABASE_ID, 'homework', id, payload);
      } else {
        const doc = await databases.createDocument(DATABASE_ID, 'homework', ID.unique(), payload);
        createdDocId = doc.$id;
      }
      successInCloud = true;
    } catch (firstErr: any) {
      console.warn('第一階段提交失敗 (嘗試移除新增欄位後安全重試):', firstErr.message);
      delete payload.youtube_url;
      delete payload.google_url;

      try {
        if (id) {
          await databases.updateDocument(DATABASE_ID, 'homework', id, payload);
        } else {
          const doc = await databases.createDocument(DATABASE_ID, 'homework', ID.unique(), payload);
          createdDocId = doc.$id;
        }
        successInCloud = true;
      } catch (secondErr: any) {
        console.warn('第二階段提交失敗 (移除 attachments 後最後重試):', secondErr.message);
        if (payload.attachments) {
          delete payload.attachments;
          try {
            if (id) {
              await databases.updateDocument(DATABASE_ID, 'homework', id, payload);
            } else {
              const doc = await databases.createDocument(DATABASE_ID, 'homework', ID.unique(), payload);
              createdDocId = doc.$id;
            }
            successInCloud = true;
          } catch (thirdErr: any) {
            console.warn('第三階段雲端寫入略過 (已由本地完整接管):', thirdErr.message);
          }
        }
      }
    }

    const finalItem: HomeworkItem = {
      $id: createdDocId || targetId,
      branch: data.branch,
      course_name: data.course_name,
      title: data.title,
      description: data.description,
      due_date: data.due_date,
      attachments: data.attachments,
      youtube_url: data.youtube_url,
      youtube_urls: data.youtube_urls,
      google_url: data.google_url,
      google_urls: data.google_urls,
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

    if (onDataChanged) onDataChanged();
    if (successInCloud) {
      fetchHomework();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除此項家課記錄嗎？')) return;
    try {
      await databases.deleteDocument(DATABASE_ID, 'homework', id);
    } catch (err: any) {
      console.log('雲端刪除略過:', err.message);
    }
    try {
      localStorage.removeItem(`oc_hw_att_${id}`);
      localStorage.removeItem(`oc_hw_links_${id}`);
      const saved = localStorage.getItem('oc_local_homework');
      if (saved) {
        const list: HomeworkItem[] = JSON.parse(saved);
        localStorage.setItem('oc_local_homework', JSON.stringify(list.filter((item) => item.$id !== id)));
      }
    } catch (e) {}

    setHomeworkList((prev) => prev.filter((item) => item.$id !== id));
    if (onDataChanged) onDataChanged();
  };

  const handleEdit = (item: HomeworkItem) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const filteredList = homeworkList.filter((item) => {
    const matchBranch = selectedBranch === '全部分校' || !item.branch || item.branch === selectedBranch;
    const matchCourse = selectedCourse === '全部課程' || !item.course_name || item.course_name === selectedCourse;
    return matchBranch && matchCourse;
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-30 flex items-end justify-center">
      <div className="bg-[#F8F9FA] w-full max-w-md rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl">
        <div className="bg-white px-5 py-3.5 rounded-t-2xl border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#FF6B57]/10 text-[#FF6B57] rounded-xl">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-base">家課總表 (Homework)</h3>
              <p className="text-[11px] text-gray-400">分校與課程每日功課總覽</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenSetup && (
              <button
                onClick={onOpenSetup}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                title="基礎設定 (Setup)"
              >
                <Settings size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="bg-white px-4 py-2.5 border-b border-gray-100 flex gap-2">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="flex-1 bg-purple-50 text-purple-700 text-xs font-semibold px-2 py-1.5 rounded-lg border-none outline-none"
          >
            <option value="全部分校">全部分校</option>
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="flex-1 bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-1.5 rounded-lg border-none outline-none"
          >
            <option value="全部課程">全部課程</option>
            {courses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-xs">讀取中...</div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              暫無相關家課記錄
            </div>
          ) : (
            filteredList.map((item, idx) => (
              <HomeworkCard
                key={item.$id || idx}
                item={item}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>

        <div className="p-3.5 bg-white border-t border-gray-100">
          <button
            onClick={() => {
              setEditingItem(null);
              setFormOpen(true);
            }}
            className="w-full py-2.5 bg-[#FF6B57] text-white font-bold rounded-xl text-xs hover:bg-[#e05a48] transition-colors flex items-center justify-center gap-1.5 shadow-md"
          >
            <Plus size={16} />
            <span>發布新家課</span>
          </button>
        </div>
      </div>

      <HomeworkFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={editingItem}
        branches={branches}
        courses={courses}
        courseItems={courseItems}
        defaultBranch={selectedBranch !== '全部分校' ? selectedBranch : undefined}
        defaultCourse={selectedCourse !== '全部課程' ? selectedCourse : undefined}
      />
    </div>
  );
};
