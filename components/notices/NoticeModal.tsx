'use client';

import React, { useState } from 'react';
import { X, Bell, FileText, ChevronRight, Sparkles } from 'lucide-react';

export interface NoticeItem {
  $id?: string;
  id?: string;
  title: string;
  content?: string;
  description?: string;
  date?: string;
  createdAt?: string;
  branch?: string;
  target?: string;
  pinned?: boolean;
}

interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  notices: NoticeItem[];
  loading?: boolean;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({
  isOpen,
  onClose,
  notices = [],
  loading = false,
}) => {
  if (!isOpen) return null;

  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg h-[90vh] max-h-[720px] flex flex-col overflow-hidden relative border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* 頂部 Header：嚴格純淨顯示「電子通告」 */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Bell size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-wide">最新消息</h2>
              <p className="text-[11px] text-white/80">校務訊息、活動與重要公告</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors text-white"
            title="關閉"
          >
            <X size={20} />
          </button>
        </div>

        {/* 內容區 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#F8F9FA]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-2">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold">載入最新消息中...</p>
            </div>
          ) : selectedNotice ? (
            /* 單則通告詳細視圖 */
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-3 animate-in fade-in">
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 mb-1"
              >
                ← 返回消息列表
              </button>
              <div className="border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-200">
                    最新消息
                  </span>
                  {selectedNotice.date && (
                    <span className="text-[11px] text-gray-400">
                      發布日期：{selectedNotice.date.substring(0, 10)}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-black text-gray-900 leading-snug">
                  {selectedNotice.title}
                </h3>
              </div>
              <div className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-wrap py-2">
                {selectedNotice.content || selectedNotice.description || '無詳細內容'}
              </div>
            </div>
          ) : notices.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center text-gray-400 text-xs">
              目前暫無新發布之最新消息
            </div>
          ) : (
            /* 通告清單視圖 */
            notices.map((notice, idx) => (
              <div
                key={notice.$id || notice.id || idx}
                onClick={() => setSelectedNotice(notice)}
                className="bg-white p-4 rounded-2xl border border-gray-200 hover:border-emerald-500/50 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FileText size={18} />
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700">
                        最新消息
                      </span>
                      {notice.date && (
                        <span className="text-[10px] text-gray-400">
                          {notice.date.substring(0, 10)}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                      {notice.title}
                    </h4>
                    <p className="text-[11px] text-gray-500 line-clamp-1">
                      {notice.content || notice.description || '點擊查閱通告詳細內容...'}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-400 group-hover:text-emerald-600 transition-colors shrink-0" />
              </div>
            ))
          )}
        </div>

        {/* 底部關閉按鈕 */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-xs transition-colors"
          >
            關閉
          </button>
        </div>

      </div>
    </div>
  );
};
