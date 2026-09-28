'use client';

import React from 'react';
import { X, Shield, FileCheck, CheckCircle2, Lock, School } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms';
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  const isPrivacy = type === 'privacy';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F8F9FA] w-screen h-screen overflow-hidden animate-in fade-in duration-200">
      <div className="w-full flex-1 flex flex-col overflow-hidden bg-white">
        
        {/* 頂部 Header */}
        <div className={`px-5 py-4 text-white flex items-center justify-between shrink-0 shadow-sm ${
          isPrivacy ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700' : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              {isPrivacy ? <Shield size={18} className="text-white" /> : <FileCheck size={18} className="text-white" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-wide">
                {isPrivacy ? '私隱政策 (Privacy Policy)' : '使用條款 (Terms of Use)'}
              </h2>
              <p className="text-[11px] text-white/80">
                {isPrivacy ? '保障學童、家長與教職員個人資料安全' : '智能網上教室平台服務協議與使用規範'}
              </p>
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

        {/* 條款本文內容 (可垂直滾動) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed bg-[#F8F9FA] max-w-4xl w-full mx-auto">
          {isPrivacy ? (
            /* 私隱政策詳細內容 */
            <div className="space-y-3.5">
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold text-xs">
                  <Shield size={14} />
                  <span>個人資料私隱保障承諾</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-normal">
                  本平台遵守香港《個人資料（私隱）條例》（第486章）之六項保障資料原則，所有收集之學籍與學習資料嚴格僅用於教學、校務及家校溝通，絕不用於未經授權之商業用途。
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
                <h3 className="font-black text-gray-900 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center">1</span>
                  收集之個人資料類別
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-gray-600 text-[11px]">
                  <li><strong>帳戶與身分資料</strong>：學童姓名、登入用戶名、密碼、身分角色（學生、家長、導師、管理員）、所屬學校/分校及班別。</li>
                  <li><strong>學業與教學記錄</strong>：功課作業提交記錄、作業附件（相片、音訊、視訊、檔案）、課堂點名出席考勤記錄與單元學習進度。</li>
                  <li><strong>家校諮詢通訊</strong>：即時訊息交流記錄、校務公告與最新消息閱讀狀態。</li>
                  <li><strong>系統日誌數據</strong>：登入時間戳記、瀏覽設備類型（僅用於維護帳戶安全與系統運行支援）。</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
                <h3 className="font-black text-gray-900 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center">2</span>
                  資料用途及目的
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-gray-600 text-[11px]">
                  <li>發布課程單元教材、作業指派與批改反饋。</li>
                  <li>傳遞學校緊急通告、校務資訊與最新活動通知。</li>
                  <li>記錄課堂出席考勤與提供家長諮詢溝通管道。</li>
                  <li>維護系統運行安全，防止未經授權之存取。</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
                <h3 className="font-black text-gray-900 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center">3</span>
                  未成年人保護特別聲明
                </h3>
                <p className="text-gray-600 text-[11px]">
                  學童帳戶均由所屬辦學團體或學校管理人員統一派發。學童使用本平台時，須在法定監護人或家長之知情、同意與指導下進行。平台絕不會在未經學校或家長授權下公開學童個人資料或學習成果。
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
                <h3 className="font-black text-gray-900 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center">4</span>
                  資料安全與絕不出售承諾
                </h3>
                <p className="text-gray-600 text-[11px]">
                  平台採用符合業界標準之 SSL/TLS 傳輸加密與雲端安全資料庫管理技術。除獲授權之校方教職員及合約約束之雲端系統供應商外，<strong>平台承諾絕不會向任何第三方機構或廣告商出售、出租、交換或轉移任何用戶之個人資料</strong>。
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
                <h3 className="font-black text-gray-900 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center">5</span>
                  用戶權利與查閱申請
                </h3>
                <p className="text-gray-600 text-[11px]">
                  家長與用戶依法享有查閱、更新或更正其個人及子女資料之權利。如需查詢、更正或於離校後申請封存/刪除資料，請直接聯絡所屬學校校務處或系統管理員。
                </p>
              </div>
            </div>
          ) : (
            /* 使用條款詳細內容 */
            <div className="space-y-3.5">
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-blue-800 font-extrabold text-xs">
                  <FileCheck size={14} />
                  <span>服務協議與使用規則</span>
                </div>
                <p className="text-[11px] text-blue-700 leading-normal">
                  歡迎使用智能網上教室平台。登入或使用本系統即代表閣下已閱讀、理解並同意受本服務條款所約束。
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
                <h3 className="font-black text-gray-900 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center">1</span>
                  帳戶資格與保管責任
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-gray-600 text-[11px]">
                  <li>用戶帳號與預設密碼統一由學校系統管理員派發，僅供獲授權之師生及家長使用。</li>
                  <li>用戶有責任妥善保管登入認證資訊，不得將帳號轉讓、外借或公開予任何未授權之第三方。</li>
                  <li>如懷疑帳戶遭他人未經授權登入，應立即通知學校管理人員以進行重設。</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
                <h3 className="font-black text-gray-900 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center">2</span>
                  使用規範與嚴禁行為
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-gray-600 text-[11px]">
                  <li>嚴禁上載或發布任何具騷擾性、誹謗、粗俗、淫褻、侵權或違法之文字、檔案或視像。</li>
                  <li>嚴禁任何試圖干擾系統運作、探測安全性漏洞、植入惡意代碼或逆向工程之行為。</li>
                  <li>即時訊息功能僅供家校事務、教學輔導及請假溝通，嚴禁濫作未授權之商業推廣或非教學聯絡。</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
                <h3 className="font-black text-gray-900 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center">3</span>
                  教材與平台知識產權
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-gray-600 text-[11px]">
                  <li>學校與導師發布之課程教材、單元講義、習題、影音資源及軟體介面設計，其知識產權均屬學校或原權利人所有。</li>
                  <li>學生與家長僅獲授權於個人學習範圍內閱覽，<strong>未經書面許可嚴禁私自下載後公開轉載、散布或作任何商業販售</strong>。</li>
                  <li>學童繳交之功課著作權屬學童所有，校方擁有在教學批改與校內展示學習成果所需之合理非商業使用權。</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
                <h3 className="font-black text-gray-900 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center">4</span>
                  服務可用性與免責限制
                </h3>
                <p className="text-gray-600 text-[11px]">
                  本平台致力維持高可用性運作。若因互聯網基礎設施故障、例行系統維護或不可抗力事件導致暫時性中斷，校方及技術平台將盡快恢復服務，但不承擔因非過失所衍生之連帶責任。建議重要學習檔案自行保留備份。
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
                <h3 className="font-black text-gray-900 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center">5</span>
                  條款修訂與管轄法律
                </h3>
                <p className="text-gray-600 text-[11px]">
                  校方與平台保留按需要更新本條款之權利。最新條款將於本系統公告。本服務條款受<strong>香港特別行政區法律</strong>管轄並按其詮釋。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 底部確認關閉按鈕 */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full max-w-md mx-auto py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-xs"
          >
            我已閱讀並理解
          </button>
        </div>

      </div>
    </div>
  );
};
