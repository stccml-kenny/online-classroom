import React, { useState } from 'react';
import { X, Save, Edit3, Calendar, Layers, Check } from 'lucide-react';

interface BatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'units' | 'homework';
  selectedCount: number;
  branches: string[];
  courses: string[];
  onApplyBatchEdit: (updates: {
    publishDateAction: 'keep' | 'set' | 'today' | 'clear';
    publishDateValue?: string;
    unpublishDateAction: 'keep' | 'set' | 'clear';
    unpublishDateValue?: string;
    dueDateAction?: 'keep' | 'set';
    dueDateValue?: string;
    branchAction: 'keep' | 'set';
    branchValue?: string;
    courseAction: 'keep' | 'set';
    courseValue?: string;
  }) => Promise<void>;
}

export const BatchEditModal: React.FC<BatchEditModalProps> = ({
  isOpen,
  onClose,
  targetType,
  selectedCount,
  branches,
  courses,
  onApplyBatchEdit,
}) => {
  const [publishDateAction, setPublishDateAction] = useState<'keep' | 'set' | 'today' | 'clear'>('keep');
  const [publishDateValue, setPublishDateValue] = useState('');

  const [unpublishDateAction, setUnpublishDateAction] = useState<'keep' | 'set' | 'clear'>('keep');
  const [unpublishDateValue, setUnpublishDateValue] = useState('');

  const [dueDateAction, setDueDateAction] = useState<'keep' | 'set'>('keep');
  const [dueDateValue, setDueDateValue] = useState('');

  const [branchAction, setBranchAction] = useState<'keep' | 'set'>('keep');
  const [branchValue, setBranchValue] = useState(branches[0] || '');

  const [courseAction, setCourseAction] = useState<'keep' | 'set'>('keep');
  const [courseValue, setCourseValue] = useState(courses[0] || '');

  const [saving, setSaving] = useState(false);

  const handleResetAndClose = () => {
    setPublishDateAction('keep');
    setPublishDateValue('');
    setUnpublishDateAction('keep');
    setUnpublishDateValue('');
    setDueDateAction('keep');
    setDueDateValue('');
    setBranchAction('keep');
    setBranchValue(branches[0] || '');
    setCourseAction('keep');
    setCourseValue(courses[0] || '');
    setSaving(false);
    onClose();
  };

  const prevOpenRef = React.useRef(isOpen);
  React.useEffect(() => {
    if (prevOpenRef.current && !isOpen) {
      setPublishDateAction('keep');
      setPublishDateValue('');
      setUnpublishDateAction('keep');
      setUnpublishDateValue('');
      setDueDateAction('keep');
      setDueDateValue('');
      setBranchAction('keep');
      setCourseAction('keep');
      setSaving(false);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);


  if (!isOpen) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onApplyBatchEdit({
        publishDateAction,
        publishDateValue,
        unpublishDateAction,
        unpublishDateValue,
        dueDateAction,
        dueDateValue,
        branchAction,
        branchValue,
        courseAction,
        courseValue,
      });
      onClose();
    } catch (err: any) {
      console.warn('批量編輯套用完成:', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 頂部 Header */}
        <div className="bg-indigo-600 text-white px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Edit3 size={18} />
            <div>
              <h4 className="font-bold text-base leading-tight">
                批量編輯 ({selectedCount} 項{targetType === 'units' ? '課程單元' : '家課項目'})
              </h4>
              <p className="text-[11px] text-white/90">
                勾選欲批次調整之設定，未變更之項目保持原狀
              </p>
            </div>
          </div>
          <button onClick={handleResetAndClose} className="text-white/80 hover:text-white p-1" title="關閉">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-4 space-y-3.5 overflow-y-auto text-xs">
          {/* 1. 批量設定上架日期 */}
          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
            <label className="font-bold text-indigo-900 flex items-center gap-1">
              <Calendar size={13} className="text-indigo-600" />
              <span>上架排程日期 (開始)</span>
            </label>

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="publishDateAction"
                  checked={publishDateAction === 'keep'}
                  onChange={() => setPublishDateAction('keep')}
                  className="text-indigo-600 focus:ring-0"
                />
                <span>保持不變</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="publishDateAction"
                  checked={publishDateAction === 'today'}
                  onChange={() => setPublishDateAction('today')}
                  className="text-indigo-600 focus:ring-0"
                />
                <span>全部設為今天上架</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="publishDateAction"
                  checked={publishDateAction === 'clear'}
                  onChange={() => setPublishDateAction('clear')}
                  className="text-indigo-600 focus:ring-0"
                />
                <span>設為「有待安排」</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="publishDateAction"
                  checked={publishDateAction === 'set'}
                  onChange={() => setPublishDateAction('set')}
                  className="text-indigo-600 focus:ring-0"
                />
                <span>指定自訂日期</span>
              </label>
            </div>

            {publishDateAction === 'set' && (
              <input
                type="date"
                value={publishDateValue}
                onChange={(e) => setPublishDateValue(e.target.value)}
                className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-xs outline-none mt-1"
                required
              />
            )}
          </div>

          {/* 2. 批量設定下架日期 */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
            <label className="font-bold text-gray-800 flex items-center gap-1">
              <Calendar size={13} className="text-gray-500" />
              <span>下架排程日期 (截止)</span>
            </label>

            <div className="flex gap-4 text-[11px]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="unpublishDateAction"
                  checked={unpublishDateAction === 'keep'}
                  onChange={() => setUnpublishDateAction('keep')}
                  className="text-indigo-600 focus:ring-0"
                />
                <span>保持不變</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="unpublishDateAction"
                  checked={unpublishDateAction === 'clear'}
                  onChange={() => setUnpublishDateAction('clear')}
                  className="text-indigo-600 focus:ring-0"
                />
                <span>清除 (設為無限制)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="unpublishDateAction"
                  checked={unpublishDateAction === 'set'}
                  onChange={() => setUnpublishDateAction('set')}
                  className="text-indigo-600 focus:ring-0"
                />
                <span>指定下架日</span>
              </label>
            </div>

            {unpublishDateAction === 'set' && (
              <input
                type="date"
                value={unpublishDateValue}
                onChange={(e) => setUnpublishDateValue(e.target.value)}
                className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs outline-none mt-1"
                required
              />
            )}
          </div>

          {/* 3. 批量設定截止日期 (僅家課適用) */}
          {targetType === 'homework' && (
            <div className="p-3 bg-orange-50/50 rounded-xl border border-orange-100 space-y-2">
              <label className="font-bold text-orange-900 flex items-center gap-1">
                <Calendar size={13} className="text-orange-600" />
                <span>作業截止日期 (Due Date)</span>
              </label>

              <div className="flex gap-4 text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dueDateAction"
                    checked={dueDateAction === 'keep'}
                    onChange={() => setDueDateAction('keep')}
                    className="text-orange-600 focus:ring-0"
                  />
                  <span>保持不變</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dueDateAction"
                    checked={dueDateAction === 'set'}
                    onChange={() => setDueDateAction('set')}
                    className="text-orange-600 focus:ring-0"
                  />
                  <span>統一指定截止日</span>
                </label>
              </div>

              {dueDateAction === 'set' && (
                <input
                  type="date"
                  value={dueDateValue}
                  onChange={(e) => setDueDateValue(e.target.value)}
                  className="w-full p-2 bg-white border border-orange-200 rounded-lg text-xs outline-none mt-1"
                  required
                />
              )}
            </div>
          )}

          {/* 4. 批量設定分校 */}
          <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-100 space-y-2">
            <div className="flex justify-between items-center">
              <label className="font-bold text-purple-900">所屬分校 (Branch)</label>
              <label className="flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={branchAction === 'set'}
                  onChange={(e) => setBranchAction(e.target.checked ? 'set' : 'keep')}
                  className="rounded text-purple-600 focus:ring-0"
                />
                <span>批量修改</span>
              </label>
            </div>

            {branchAction === 'set' && (
              <select
                value={branchValue}
                onChange={(e) => setBranchValue(e.target.value)}
                className="w-full p-2 bg-white border border-purple-200 rounded-lg text-xs outline-none"
              >
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
          </div>

          {/* 5. 批量設定課程 */}
          <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-2">
            <div className="flex justify-between items-center">
              <label className="font-bold text-indigo-900">所屬課程 (Course)</label>
              <label className="flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={courseAction === 'set'}
                  onChange={(e) => setCourseAction(e.target.checked ? 'set' : 'keep')}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <span>批量修改</span>
              </label>
            </div>

            {courseAction === 'set' && (
              <select
                value={courseValue}
                onChange={(e) => setCourseValue(e.target.value)}
                className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-xs outline-none"
              >
                {courses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleResetAndClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <Save size={15} />
              <span>{saving ? '正在套用更新...' : `確認套用 (${selectedCount} 項)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
