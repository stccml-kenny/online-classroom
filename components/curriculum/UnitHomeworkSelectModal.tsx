import React, { useState, useMemo } from 'react';
import {
  X, Check, BookOpen, Search, Plus, Calendar, CheckSquare, Square, Filter
} from 'lucide-react';
import { CourseUnit } from './CourseUnitFormModal';
import { HomeworkItem, getHomeworkPublishStatus } from '../homework/HomeworkCard';

interface UnitHomeworkSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: CourseUnit | null;
  savedHomeworkList: HomeworkItem[];
  onSaveSelection: (unitId: string, unitTitle: string, selectedHwIds: string[]) => Promise<void>;
  onCreateNewHomework: (unit: CourseUnit) => void;
}

export const UnitHomeworkSelectModal: React.FC<UnitHomeworkSelectModalProps> = ({
  isOpen,
  onClose,
  unit,
  savedHomeworkList,
  onSaveSelection,
  onCreateNewHomework,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleResetAndClose = () => {
    setSearchTerm('');
    setShowAllCourses(false);
    setSelectedIds([]);
    setSaving(false);
    onClose();
  };

  const prevOpenRef = React.useRef(isOpen);
  React.useEffect(() => {
    if (prevOpenRef.current && !isOpen) {
      setSearchTerm('');
      setShowAllCourses(false);
      setSelectedIds([]);
      setSaving(false);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);


  // 當打開彈窗時，初始化已關聯至此單元的家課 ID
  React.useEffect(() => {
    if (isOpen && unit) {
      const currentLinkedIds = savedHomeworkList
        .filter((h) => h.unit_id === unit.$id || (h.unit_title && h.unit_title === unit.unit_title))
        .map((h) => h.$id!)
        .filter(Boolean);
      setSelectedIds(currentLinkedIds);
      setSearchTerm('');
    }
  }, [isOpen, unit, savedHomeworkList]);

  if (!isOpen || !unit) return null;

  // 篩選可供揀選的已儲存家課庫
  const filteredList = savedHomeworkList.filter((h) => {
    // 依課程篩選 (預設篩選當前單元之課程，亦可勾選查看全部庫存)
    if (!showAllCourses && unit.course_name && h.course_name && h.course_name !== unit.course_name) {
      return false;
    }
    // 關鍵字搜尋
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchTitle = h.title?.toLowerCase().includes(term);
      const matchDesc = h.description?.toLowerCase().includes(term);
      const matchCourse = h.course_name?.toLowerCase().includes(term);
      return matchTitle || matchDesc || matchCourse;
    }
    return true;
  });

  const handleToggleSelect = (hwId: string) => {
    if (!hwId) return;
    setSelectedIds((prev) =>
      prev.includes(hwId) ? prev.filter((id) => id !== hwId) : [...prev, hwId]
    );
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredList.map((h) => h.$id!).filter(Boolean);
    const allSelected = allFilteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleConfirm = async () => {
    if (!unit.$id) return;
    setSaving(true);
    try {
      await onSaveSelection(unit.$id, unit.unit_title, selectedIds);
      onClose();
    } catch (err: any) {
      console.warn('儲存單元家課關聯完成:', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 頂部 Header */}
        <div className="bg-gradient-to-r from-[#FF6B57] to-orange-500 text-white px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen size={18} />
            <div>
              <h4 className="font-bold text-base leading-tight">發布此單元家課</h4>
              <p className="text-[11px] text-white/90 truncate max-w-[260px]">
                {unit.unit_title} ({unit.course_name || '全課程'})
              </p>
            </div>
          </div>
          <button onClick={handleResetAndClose} className="text-white/80 hover:text-white p-1" title="關閉">
            <X size={20} />
          </button>
        </div>

        {/* 搜尋與庫存篩選列 */}
        <div className="p-3.5 bg-gray-50/80 border-b border-gray-100 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋已儲存的家課標題或內容..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-[#FF6B57]"
            />
          </div>

          <div className="flex items-center justify-between text-xs px-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 font-medium text-[11px]">
              <input
                type="checkbox"
                checked={showAllCourses}
                onChange={(e) => setShowAllCourses(e.target.checked)}
                className="rounded text-[#FF6B57] focus:ring-0"
              />
              <span>顯示所有課程的家課範本庫</span>
            </label>

            {filteredList.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-[#FF6B57] font-semibold hover:underline"
              >
                {filteredList.every((h) => selectedIds.includes(h.$id!)) ? '取消全選' : '本頁全選'}
              </button>
            )}
          </div>
        </div>

        {/* 家課列表展示區 */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5 text-xs">
          {savedHomeworkList.length === 0 ? (
            <div className="text-center py-10 text-gray-400 space-y-2">
              <BookOpen size={32} className="mx-auto text-gray-300" />
              <p className="font-semibold text-gray-600">目前尚無已儲存的家課記錄</p>
              <p className="text-[11px] text-gray-400">您可以直接點擊下方「建立全新家課」發布新作業</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-10 text-gray-400 space-y-2">
              <Search size={30} className="mx-auto text-gray-300" />
              <p className="font-semibold text-gray-600">無符合條件的家課項目</p>
              <p className="text-[11px] text-gray-400">可嘗試勾選「顯示所有課程」或調整搜尋關鍵字</p>
            </div>
          ) : (
            filteredList.map((hw) => {
              const isSelected = hw.$id ? selectedIds.includes(hw.$id) : false;
              const isCurrentlyLinked =
                hw.unit_id === unit.$id || (hw.unit_title && hw.unit_title === unit.unit_title);
              const pubStatus = getHomeworkPublishStatus(hw.publish_date, hw.unpublish_date);

              return (
                <div
                  key={hw.$id}
                  onClick={() => hw.$id && handleToggleSelect(hw.$id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-orange-50/70 border-[#FF6B57] shadow-xs'
                      : 'bg-white border-gray-200 hover:border-orange-200'
                  }`}
                >
                  <div className="pt-0.5 text-[#FF6B57] shrink-0">
                    {isSelected ? (
                      <CheckSquare size={17} className="text-[#FF6B57]" />
                    ) : (
                      <Square size={17} className="text-gray-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${pubStatus.badgeClass}`}>
                        {pubStatus.label}
                      </span>
                      {hw.course_name && (
                        <span className="text-[9px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded">
                          {hw.course_name}
                        </span>
                      )}
                      {isCurrentlyLinked && (
                        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded">
                          ✓ 本單元現有家課
                        </span>
                      )}
                    </div>

                    <h5 className="font-bold text-gray-900 text-xs leading-snug">
                      {hw.title}
                    </h5>

                    {hw.description && (
                      <p className="text-[11px] text-gray-500 line-clamp-2 mt-1">
                        {hw.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1.5">
                      <span className="flex items-center gap-1 text-orange-600 font-semibold">
                        <Calendar size={11} />
                        <span>截止: {hw.due_date ? hw.due_date.split('T')[0] : '未設定'}</span>
                      </span>
                      {hw.publish_date && (
                        <span>上架: {hw.publish_date}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 底部功能與操作按鈕 */}
        <div className="p-3.5 bg-white border-t border-gray-100 space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateNewHomework(unit);
              }}
              className="py-2.5 px-3 border border-orange-200 text-[#FF6B57] bg-orange-50/50 hover:bg-orange-100/60 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1 shrink-0"
              title="針對此單元建立全新的家課項目"
            >
              <Plus size={14} />
              <span>建立全新家課</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleConfirm}
              className="flex-1 py-2.5 bg-[#FF6B57] hover:bg-[#e05a48] text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <Check size={16} />
              <span>
                {saving ? '正在儲存關聯...' : `確認關聯至此單元 (${selectedIds.length} 項)`}
              </span>
            </button>
          </div>

          <p className="text-[10px] text-gray-400 text-center">
            提示：被勾選的家課將關聯於此單元教材內，學生可於單元頁面直接查看與完成作業
          </p>
        </div>
      </div>
    </div>
  );
};
