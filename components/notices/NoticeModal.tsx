'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Bell,
  FileText,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  Pin,
  AlertTriangle,
  Calendar,
  Building2,
  Users,
  Search,
  CheckCircle2,
  Loader2,
  Sparkles
} from 'lucide-react';
import type { UserProfile } from '@/components/auth/AuthModal';
import type { NewsItem, NewsCategory } from '@/types/news';
import { NEWS_CATEGORIES } from '@/types/news';

interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  notices: NewsItem[];
  currentUser: UserProfile | null;
  branches?: string[];
  onSaveNews?: (newsData: Partial<NewsItem>, existingId?: string) => Promise<void>;
  onDeleteNews?: (newsId: string) => Promise<void>;
  loading?: boolean;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({
  isOpen,
  onClose,
  notices = [],
  currentUser,
  branches = ['全部分校', '沙田分校', '九龍灣分校', '總校'],
  onSaveNews,
  onDeleteNews,
  loading = false,
}) => {
  if (!isOpen) return null;

  // 1. 發布與管理權限：系統管理員、導師及助教 (B 選項)
  const canManage = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.role === 'teacher' || currentUser.role === 'assistant';
  }, [currentUser]);

  // 2. 檢視與篩選狀態
  const [selectedNotice, setSelectedNotice] = useState<NewsItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 3. 表單彈窗狀態 (發布 / 編輯)
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 表單內部欄位
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<string>('校務通知');
  const [formBranch, setFormBranch] = useState<string>('全部分校');
  const [formTargetRoles, setFormTargetRoles] = useState<string>('all');
  const [formIsPinned, setFormIsPinned] = useState<boolean>(false);
  const [formIsImportant, setFormIsImportant] = useState<boolean>(false);
  const [formPublishDate, setFormPublishDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [formExpiryDate, setFormExpiryDate] = useState<string>('');
  const [formContent, setFormContent] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 開啟新增表單
  const handleOpenCreateForm = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormCategory('校務通知');
    setFormBranch(currentUser?.branch && currentUser.branch !== '全部分校' ? currentUser.branch : '全部分校');
    setFormTargetRoles('all');
    setFormIsPinned(false);
    setFormIsImportant(false);
    setFormPublishDate(new Date().toISOString().substring(0, 10));
    setFormExpiryDate('');
    setFormContent('');
    setShowFormModal(true);
  };

  // 開啟編輯表單
  const handleOpenEditForm = (item: NewsItem) => {
    setEditingItem(item);
    setFormTitle(item.title || '');
    setFormCategory(item.category || '校務通知');
    setFormBranch(item.branch || '全部分校');
    let target = 'all';
    try {
      if (item.target_roles) {
        const parsed = JSON.parse(item.target_roles);
        if (Array.isArray(parsed) && parsed[0]) target = parsed[0];
      }
    } catch (e) {}
    setFormTargetRoles(target);
    setFormIsPinned(!!item.is_pinned);
    setFormIsImportant(!!item.is_important);
    setFormPublishDate((item.publish_date || '').substring(0, 10) || new Date().toISOString().substring(0, 10));
    setFormExpiryDate((item.expiry_date || '').substring(0, 10) || '');
    setFormContent(item.content || '');
    setShowFormModal(true);
  };

  // 提交儲存表單
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast('請填寫消息標題');
      return;
    }
    if (!formContent.trim()) {
      showToast('請填寫消息內容');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload: Partial<NewsItem> = {
        title: formTitle.trim(),
        content: formContent.trim(),
        category: formCategory,
        branch: formBranch,
        target_roles: JSON.stringify(formTargetRoles === 'all' ? ['all'] : [formTargetRoles]),
        is_pinned: formIsPinned,
        is_important: formIsImportant,
        publish_date: formPublishDate ? new Date(formPublishDate).toISOString() : new Date().toISOString(),
        expiry_date: formExpiryDate ? new Date(formExpiryDate).toISOString() : undefined,
        author_name: currentUser?.name || currentUser?.username || '校務處',
        author_id: currentUser?.username || '',
      };

      if (onSaveNews) {
        await onSaveNews(payload, editingItem?.$id || editingItem?.id);
      }
      setShowFormModal(false);
      showToast(editingItem ? '最新消息已成功更新！' : '最新消息已成功發布！');
    } catch (err: any) {
      showToast('儲存失敗：' + (err.message || '未知錯誤'));
    } finally {
      setFormSubmitting(false);
    }
  };

  // 刪除消息
  const handleDelete = async (item: NewsItem) => {
    const id = item.$id || item.id;
    if (!id) return;
    if (!window.confirm(`確定要刪除消息「${item.title}」嗎？此操作無法復原。`)) return;

    try {
      if (onDeleteNews) {
        await onDeleteNews(id);
      }
      if (selectedNotice && (selectedNotice.$id === id || selectedNotice.id === id)) {
        setSelectedNotice(null);
      }
      showToast('消息已成功刪除');
    } catch (err: any) {
      showToast('刪除失敗：' + (err.message || '未知錯誤'));
    }
  };

  // 4. 篩選與排序邏輯
  const filteredNotices = useMemo(() => {
    return notices
      .filter((n) => {
        // 分類過濾
        if (selectedCategory !== '全部' && n.category !== selectedCategory) {
          return false;
        }
        // 關鍵字搜尋
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const t = (n.title || '').toLowerCase();
          const c = (n.content || '').toLowerCase();
          if (!t.includes(q) && !c.includes(q)) return false;
        }
        // 分校過濾 (學生及家長只看本校或全部分校)
        const studentSchool = (currentUser?.branch || '').trim();
        if ((currentUser?.role === 'student' || currentUser?.role === 'parent') && studentSchool && studentSchool !== '全部分校') {
          if (n.branch && n.branch !== '全部分校' && n.branch !== studentSchool) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        // 置頂優先
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        // 重要優先
        if (a.is_important && !b.is_important) return -1;
        if (!a.is_important && b.is_important) return 1;
        // 日期降冪
        const dateA = a.publish_date || a.createdAt || '';
        const dateB = b.publish_date || b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
  }, [notices, selectedCategory, searchQuery, currentUser]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl h-[92vh] max-h-[760px] flex flex-col overflow-hidden relative border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* 頂部 Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white px-5 py-3.5 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Bell size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-wide">最新消息</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-bold">
                  {filteredNotices.length} 則
                </span>
              </div>
              <p className="text-[11px] text-white/80">校務訊息、重要活動與即時公告</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <button
                type="button"
                onClick={handleOpenCreateForm}
                className="px-3 py-1.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-black shadow-xs flex items-center gap-1 transition-all active:scale-95"
              >
                <Plus size={14} />
                <span>發布消息</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/20 transition-colors text-white"
              title="關閉"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toast 提示條 */}
        {toastMessage && (
          <div className="bg-gray-900 text-white text-xs font-bold px-4 py-2 text-center animate-in fade-in z-20">
            {toastMessage}
          </div>
        )}

        {/* 搜尋與分類標籤列 (僅在列表模式顯示) */}
        {!selectedNotice && (
          <div className="bg-white border-b border-gray-150 p-3 space-y-2 shrink-0">
            {/* 搜尋框 */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜尋消息標題或內容關鍵字..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white transition-colors"
              />
            </div>

            {/* 分類標籤滑動列 */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('全部')}
                className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all ${
                  selectedCategory === '全部'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              {NEWS_CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => setSelectedCategory(cat.label)}
                  className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all border ${
                    selectedCategory === cat.label
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : `${cat.bg} ${cat.color} ${cat.border} hover:opacity-80`
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 核心內容區 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#F8F9FA]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-2">
              <Loader2 size={24} className="animate-spin text-emerald-600" />
              <p className="text-xs font-bold">載入最新消息中...</p>
            </div>
          ) : selectedNotice ? (
            /* ============================================================ */
            /* 詳情檢視視圖 (Detail View) */
            /* ============================================================ */
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-xs space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-gray-150 pb-3">
                <button
                  type="button"
                  onClick={() => setSelectedNotice(null)}
                  className="text-xs font-extrabold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  ← 返回消息列表
                </button>
                {canManage && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditForm(selectedNotice)}
                      className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                    >
                      <Edit2 size={13} /> 編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedNotice)}
                      className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                    >
                      <Trash2 size={13} /> 刪除
                    </button>
                  </div>
                )}
              </div>

              {/* 詳情標籤列 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedNotice.is_pinned && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-black flex items-center gap-1">
                      <Pin size={11} /> 置頂
                    </span>
                  )}
                  {selectedNotice.is_important && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-black flex items-center gap-1">
                      <AlertTriangle size={11} /> 重要
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold">
                    {selectedNotice.category || '最新消息'}
                  </span>
                  {selectedNotice.branch && selectedNotice.branch !== '全部分校' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                      {selectedNotice.branch}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-black text-gray-900 leading-snug">
                  {selectedNotice.title}
                </h3>

                <div className="flex items-center gap-4 text-xs text-gray-400 pt-1">
                  <span>發布時間：{(selectedNotice.publish_date || selectedNotice.createdAt || '').substring(0, 10)}</span>
                  {selectedNotice.author_name && <span>發布者：{selectedNotice.author_name}</span>}
                </div>
              </div>

              {/* 正文內容 */}
              <div className="text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-wrap py-3 border-t border-gray-100">
                {selectedNotice.content}
              </div>
            </div>
          ) : filteredNotices.length === 0 ? (
            /* 空狀態 */
            <div className="bg-white rounded-3xl p-12 border border-gray-200 text-center text-gray-400 space-y-2">
              <Bell size={32} className="mx-auto text-gray-300" />
              <p className="text-xs font-bold">目前暫無符合條件之最新消息</p>
              {canManage && (
                <button
                  type="button"
                  onClick={handleOpenCreateForm}
                  className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                >
                  立即發布第一則消息
                </button>
              )}
            </div>
          ) : (
            /* ============================================================ */
            /* 消息清單視圖 (List View) */
            /* ============================================================ */
            filteredNotices.map((notice) => (
              <div
                key={notice.$id || notice.id}
                className="bg-white p-4 rounded-2xl border border-gray-200 hover:border-emerald-500/50 hover:shadow-xs transition-all flex flex-col gap-2 group relative"
              >
                {/* 頂部標籤與管理按鈕 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {notice.is_pinned && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-black flex items-center gap-0.5">
                        <Pin size={10} /> 置頂
                      </span>
                    )}
                    {notice.is_important && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-black flex items-center gap-0.5">
                        <AlertTriangle size={10} /> 重要
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold">
                      {notice.category || '最新消息'}
                    </span>
                    {notice.branch && notice.branch !== '全部分校' && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-bold">
                        {notice.branch}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400">
                      {(notice.publish_date || notice.createdAt || '').substring(0, 10)}
                    </span>
                    {canManage && (
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditForm(notice);
                          }}
                          className="p-1 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                          title="編輯"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notice);
                          }}
                          className="p-1 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="刪除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 點擊展開詳情之主體 */}
                <div
                  onClick={() => setSelectedNotice(notice)}
                  className="cursor-pointer space-y-1"
                >
                  <h4 className="text-xs sm:text-sm font-black text-gray-900 group-hover:text-emerald-700 transition-colors leading-snug">
                    {notice.title}
                  </h4>
                  <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                    {notice.content}
                  </p>
                </div>

                <div
                  onClick={() => setSelectedNotice(notice)}
                  className="cursor-pointer pt-1 flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100"
                >
                  <span>發布者：{notice.author_name || '校務處'}</span>
                  <span className="text-emerald-700 font-bold group-hover:underline flex items-center gap-0.5">
                    查閱全文 <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部按鈕 */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-xs transition-colors"
          >
            完成並關閉
          </button>
        </div>

        {/* ============================================================ */}
        {/* 發布 / 編輯最新消息表單彈窗 */}
        {/* ============================================================ */}
        {showFormModal && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 z-30 animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90%] flex flex-col shadow-2xl overflow-hidden border border-gray-200 animate-in zoom-in-95">
              <div className="bg-emerald-700 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Bell size={16} />
                  <h3 className="font-extrabold text-sm">
                    {editingItem ? '編輯最新消息' : '發布最新消息'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="text-white/80 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
                {/* 消息標題 */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    消息標題 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="請輸入消息標題..."
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-600 focus:bg-white font-bold text-gray-900"
                  />
                </div>

                {/* 分類與分校 */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">消息分類</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-600 font-bold text-gray-800"
                    >
                      {NEWS_CATEGORIES.map((c) => (
                        <option key={c.label} value={c.label}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">適用分校</label>
                    <select
                      value={formBranch}
                      onChange={(e) => setFormBranch(e.target.value)}
                      className="w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-600 font-bold text-gray-800"
                    >
                      {branches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 發布日期 (DateTime) 與 下架日期 */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">發布日期</label>
                    <input
                      type="date"
                      required
                      value={formPublishDate}
                      onChange={(e) => setFormPublishDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-600 font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">下架日期 (選填)</label>
                    <input
                      type="date"
                      value={formExpiryDate}
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-600 font-bold text-gray-800"
                    />
                  </div>
                </div>

                {/* 置頂與重要勾選開關 */}
                <div className="flex items-center gap-5 pt-1 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                    <input
                      type="checkbox"
                      checked={formIsPinned}
                      onChange={(e) => setFormIsPinned(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                    />
                    <span>📌 置頂消息</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                    <input
                      type="checkbox"
                      checked={formIsImportant}
                      onChange={(e) => setFormIsImportant(e.target.checked)}
                      className="w-4 h-4 text-rose-600 rounded border-gray-300 focus:ring-rose-500"
                    />
                    <span>🚨 重要公告</span>
                  </label>
                </div>

                {/* 正文內容 */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    消息完整正文 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={6}
                    placeholder="請輸入消息詳細內容、活動說明或注意事項..."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-600 focus:bg-white text-xs text-gray-900 leading-relaxed resize-none"
                  ></textarea>
                </div>

                {/* 表單操作按鈕 */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-150">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-xl font-bold transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {formSubmitting && <Loader2 size={13} className="animate-spin" />}
                    <span>{editingItem ? '儲存變更' : '立即發布'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
