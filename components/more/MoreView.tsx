import React from 'react';
import {
  Radio, Calendar, FileText,
  MessageSquare, Lock, Mail, Shield,
  FileCheck, LogOut, Settings, User
} from 'lucide-react';
import { MenuItem } from './MenuItem';
import { UserProfile, ROLE_CONFIGS } from '@/components/auth/AuthModal';

interface MoreViewProps {
  noticeCount?: number;
  onOpenNotices: () => void;
  onOpenHomework?: () => void;
  onOpenAttendance?: () => void;
  onOpenClasses?: () => void;
  onOpenCourseContent?: () => void;
  onOpenSetup?: () => void; // ⭐ 設定入口
  currentUser?: UserProfile | null;
  onOpenAuth?: (tab?: 'login' | 'register') => void;
  onLogout?: () => void;
}

export const MoreView: React.FC<MoreViewProps> = ({
  noticeCount,
  onOpenNotices,
  onOpenSetup,
  currentUser,
  onOpenAuth,
  onLogout
}) => {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* 使用者資訊卡片 (支援5大角色) */}
      <div className="px-5 py-4 flex items-center justify-between bg-white border-b border-gray-100">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-xl shadow-xs">
            {currentUser ? ROLE_CONFIGS[currentUser.role]?.emoji || '👤' : '👤'}
          </div>
          <div>
            <div className="text-base font-extrabold text-gray-800 flex items-center gap-1.5">
              <span>{currentUser ? currentUser.name : '訪客模式 (未登入)'}</span>
              {currentUser && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-[#FF6B57]">
                  {ROLE_CONFIGS[currentUser.role]?.label}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400">
              {currentUser
                ? `帳號：${currentUser.username} · ${currentUser.branch || '總校'}`
                : '登入可同步各項教學與學習記錄'}
            </div>
          </div>
        </div>

        <div>
          {currentUser ? (
            <button
              onClick={() => onOpenAuth?.('login')}
              className="text-xs font-bold text-[#FF6B57] hover:underline"
            >
              切換身分
            </button>
          ) : (
            <button
              onClick={() => onOpenAuth?.('login')}
              className="px-3 py-1.5 bg-[#FF6B57] text-white rounded-xl text-xs font-bold shadow-xs hover:opacity-95"
            >
              登入帳戶
            </button>
          )}
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
        {/* ⭐ 設定按鍵：只保留學校/分校及班別設定 */}
        <MenuItem
          icon={<Settings className="text-[#FF6B57]" size={20} />}
          title="設定 (學校與班別)"
          onClick={onOpenSetup}
        />
        <MenuItem icon={<MessageSquare className="text-[#FF6B57]" size={20} />} title="小組訊息" />
      </div>

      <div className="h-3 bg-gray-100 border-t border-b border-gray-200"></div>

      {/* 第二組系統與帳號設定 */}
      <div className="bg-white">
        <MenuItem
          icon={<Lock className="text-gray-600" size={20} />}
          title="更改密碼 (必需為8位數字)"
          onClick={() => onOpenAuth?.('login')}
        />
        <MenuItem icon={<Mail className="text-gray-600" size={20} />} title="變更電郵地址" />
        <MenuItem icon={<Shield className="text-gray-600" size={20} />} title="私隱政策" hasRedDot />
        <MenuItem icon={<FileCheck className="text-gray-600" size={20} />} title="使用條款" hasRedDot />
        {currentUser ? (
          <MenuItem
            icon={<LogOut className="text-red-500" size={20} />}
            title="登出帳戶"
            onClick={() => {
              if (window.confirm('確定要登出目前帳戶嗎？')) {
                onLogout?.();
              }
            }}
          />
        ) : (
          <MenuItem
            icon={<User className="text-[#FF6B57]" size={20} />}
            title="登入 / 登記帳戶"
            onClick={() => onOpenAuth?.('login')}
          />
        )}
      </div>
    </div>
  );
};
