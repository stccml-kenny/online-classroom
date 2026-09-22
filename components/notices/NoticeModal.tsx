import React from 'react';

interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  notices: any[];
  loading: boolean;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({ isOpen, onClose, notices, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-30 flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-2xl p-5 max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center border-b pb-3 mb-3">
          <h3 className="font-bold text-lg text-gray-800">電子通告 (Appwrite 連線)</h3>
          <button onClick={onClose} className="text-gray-500 text-sm hover:text-gray-700">關閉</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {loading && <p className="text-center text-gray-400 py-4">載入中...</p>}
          {!loading && notices.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p>目前資料庫還沒有通告。</p>
              <p className="text-xs mt-1">可在 Appwrite 控制台的 notices 表新增一筆測試資料！</p>
            </div>
          )}
          {notices.map((n) => (
            <div key={n.$id} className="p-3 border rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{n.notice_number}</span>
                <span>截止: {new Date(n.deadline).toLocaleDateString()}</span>
              </div>
              <div className="font-semibold text-gray-800">{n.title}</div>
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">{n.body}</div>
              <div className="text-xs text-[#FF6B57] mt-2 font-medium">發布者: {n.author_name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
