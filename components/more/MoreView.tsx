import React from 'react';
import {
  Users, Radio, Calendar, FileText, BookOpen,
  UserCheck, MessageSquare, Lock, Mail, Shield,
  FileCheck, LogOut, GraduationCap, Settings
} from 'lucide-react';
import { MenuItem } from './MenuItem';

interface MoreViewProps {
  noticeCount?: number;
  onOpenNotices: () => void;
  onOpenHomework?: () => void;
  onOpenAttendance: () => void;
  onOpenClasses: () => void;
  onOpenCourseContent: () => void;
  onOpenSetup?: () => void; // ⭐ 設定入口
}

export const MoreView: React.FC<MoreViewProps> = ({
  noticeCount,
  onOpenNotices,
  onOpenHomework,
  onOpenAttendance,
  onOpenClasses,
  onOpenCourseContent,
  onOpenSetup,
}) => {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* 導師資訊卡片 */}
      <div className="px-5 py-4 flex items-center gap-4 bg-white border-b border-gray-100">
        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-400">
          <Users size={30} />
        </div>
        <div>
          <div className="text-xl font-bold text-gray-800">導師</div>
          <div className="text-xs text-gray-400">ONLINE CLASSROOM 導師端</div>
        </div>
      </div>

      {/* 第一組模組功能 */}
      <div className="bg-white">
        <MenuItem icon={<Radio className="text-[#FF6B57]" size={20} />} title="最新消息" />
        <MenuItem icon={<Calendar className="text-[#FF6B57]" size={20} />} title="行事曆" />
        <MenuItem
          icon={<FileText className="text-[#FF6B57]" size={20} />}
          title="電子通告"
          badge={noticeCount && noticeCount > 0 ? `${noticeCount}` : undefined}
          onClick={onOpenNotices}
        />
        {/* 第一層目錄：課程內容 */}
        <MenuItem
          icon={<GraduationCap className="text-indigo-600" size={20} />}
          title="課程內容"
          badge="新"
          onClick={onOpenCourseContent}
        />
        {/* ⭐ 設定按鍵：只保留學校/分校及班別設定 */}
        <MenuItem
          icon={<Settings className="text-[#FF6B57]" size={20} />}
          title="設定 (學校與班別)"
          onClick={onOpenSetup}
        />
        <MenuItem
          icon={<UserCheck className="text-[#FF6B57]" size={20} />}
          title="活動 / 課程點名"
          onClick={onOpenAttendance}
        />
        <MenuItem
          icon={<Users className="text-[#FF6B57]" size={20} />}
          title="會員目錄"
          onClick={onOpenClasses}
        />
        <MenuItem icon={<MessageSquare className="text-[#FF6B57]" size={20} />} title="小組訊息" />
      </div>

      <div className="h-3 bg-gray-100 border-t border-b border-gray-200"></div>

      {/* 第二組系統與帳號設定 */}
      <div className="bg-white">
        <MenuItem icon={<Lock className="text-gray-600" size={20} />} title="更改密碼" />
        <MenuItem icon={<Mail className="text-gray-600" size={20} />} title="變更電郵地址" />
        <MenuItem icon={<Shield className="text-gray-600" size={20} />} title="私隱政策" hasRedDot />
        <MenuItem icon={<FileCheck className="text-gray-600" size={20} />} title="使用條款" hasRedDot />
        <MenuItem icon={<LogOut className="text-gray-600" size={20} />} title="登出" />
      </div>
    </div>
  );
};
