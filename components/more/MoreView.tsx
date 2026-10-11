import React, { useState } from 'react';
import {
  Radio, Calendar, FileText,
  Lock, Shield, MessageCircle,
  FileCheck, LogOut, Settings, User, Users, UserPlus
} from 'lucide-react';
import { MenuItem } from './MenuItem';
import { LegalModal } from './LegalModal';
import { UserProfile, ROLE_CONFIGS } from '@/components/auth/AuthModal';

interface MoreViewProps {
  noticeCount?: number;
  onOpenNotices: () => void;
    onOpenHomework?: () => void;
  onOpenAttendance?: () => void;
  onOpenClasses?: () => void;
  onOpenCourseContent?: () => void;
  onOpenSetup?: () => void;
  onOpenAccountMgmt?: (tab?: 'issue' | 'excel' | 'list' | 'chat_settings') => void; // 👑 管理員派發帳戶入口
  currentUser?: UserProfile | null;
  onOpenAuth?: (tab?: 'login') => void;
  onLogout?: () => void;
}

export const MoreView: React.FC<MoreViewProps> = ({
  noticeCount,
  onOpenNotices,
  onOpenSetup,
  onOpenAccountMgmt,
  currentUser,
  onOpenAuth,
  onLogout
}) => {
  const isStudentOrParent = currentUser?.role === 'student' || currentUser?.role === 'parent';
  const isAdmin = currentUser?.role === 'admin';

  // ⭐ 法律條款彈窗狀態 (私隱政策 / 使用條款)
  const [legalModalType, setLegalModalType] = React.useState<'privacy' | 'terms' | null>(null);
  const [showPasswordInfoModal, setShowPasswordInfoModal] = useState<boolean>(false);

  return (
    <div className="flex-1 overflow-y-auto pb-20">
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
                ? `帳號：${currentUser.username} · ${currentUser.branch || '總校'} · ${currentUser.className || '全校'}`
                : '請登入帳戶以查閱您的專屬課程教材與單元家課'}
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
        {/* 👑 系統管理人員專屬：帳戶管理 與 權限管理 */}
        {isAdmin && (
          <>
            <MenuItem
              icon={<Shield className="text-purple-600" size={20} />}
              title="帳戶管理"
              badge="👑 管理員"
              onClick={() => onOpenAccountMgmt?.('issue')}
            />
            <MenuItem
              icon={<MessageCircle className="text-purple-600" size={20} />}
              title="權限管理"
              badge="👑 訊息控制"
              onClick={() => onOpenAccountMgmt?.('chat_settings')}
            />
          </>
        )}

        <MenuItem
          icon={<Radio className="text-[#FF6B57]" size={20} />}
          title="最新消息"
          badge={noticeCount && noticeCount > 0 ? `${noticeCount}` : undefined}
          onClick={onOpenNotices}
        />
        <MenuItem
          icon={<FileText className="text-[#FF6B57]" size={20} />}
          title="電子通告"
        />
        {/* 只有導師或管理員才可進行學校與班別設定 */}
        {!isStudentOrParent && (
          <MenuItem
            icon={<Settings className="text-[#FF6B57]" size={20} />}
            title="學校與班別"
            onClick={onOpenSetup}
          />
        )}
      </div>

      <div className="h-3 bg-gray-100 border-t border-b border-gray-200"></div>

      {/* 第二組系統與帳號設定 */}
      <div className="bg-white">
        <MenuItem
          icon={<Lock className="text-gray-600" size={20} />}
          title="密碼管理"
          onClick={() => setShowPasswordInfoModal(true)}
        />
        <MenuItem
          icon={<Shield className="text-gray-600" size={20} />}
          title="私隱政策"
          onClick={() => setLegalModalType('privacy')}
        />
        <MenuItem
          icon={<FileCheck className="text-gray-600" size={20} />}
          title="使用條款"
          onClick={() => setLegalModalType('terms')}
        />
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
            title="登入帳戶"
            onClick={() => onOpenAuth?.('login')}
          />
        )}
      </div>

      {/* 法律與服務協議條款彈窗 */}
      <LegalModal
        isOpen={legalModalType !== null}
        type={legalModalType || 'privacy'}
        onClose={() => setLegalModalType(null)}
      />
    
      {/* 🔑 密碼管理提示彈窗 */}
      {showPasswordInfoModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-gray-150 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-[#FF6B57] flex items-center justify-center mx-auto shadow-xs">
              <Lock size={24} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-gray-900">密碼管理</h3>
              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                本系統帳號密碼由學校系統管理人員統一派發及管理。
              </p>
              <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-3 text-xs text-[#FF6B57] font-bold leading-relaxed">
                如有需要查詢、修改或重設密碼，請聯絡學校管理人員進行辦理。
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordInfoModal(false)}
              className="w-full py-2.5 bg-[#FF6B57] hover:bg-[#FF5138] text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
</div>
  );
};
