import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export function AntiNoiseNotice() {
  return (
    <div className="bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Anti-Noise / Lọc nhiễu</h3>
      </div>
      
      <div className="space-y-3">
        {/* Supported capabilities */}
        <div className="text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300">Đang hoạt động (Thực tế):</span>
          <ul className="list-disc pl-4 mt-1 text-slate-500 dark:text-slate-400 space-y-0.5">
            <li>Lọc theo cảm xúc, nguồn, độ uy tín.</li>
            <li>Loại bỏ tin nhắn rác (Xóa).</li>
            <li>Chặn toàn bộ bài từ một Domain hoặc Tác giả.</li>
          </ul>
        </div>

        {/* Missing capabilities */}
        <div className="bg-slate-50 dark:bg-[#0a0f1c] p-2.5 rounded-lg border border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-1.5 mb-1.5">
             <Info className="w-3.5 h-3.5 text-blue-500" />
             <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Lọc nâng cao</span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 cursor-not-allowed" title="Tính năng backend đang phát triển">
              <span>Required words (Bắt buộc có)</span>
              <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-[10px] font-medium">Sắp hỗ trợ</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 cursor-not-allowed" title="Tính năng backend đang phát triển">
              <span>Excluded words (Loại trừ)</span>
              <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-[10px] font-medium">Sắp hỗ trợ</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 cursor-not-allowed" title="Tính năng backend đang phát triển">
              <span>Boolean logic (AND/OR)</span>
              <span className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-[10px] font-medium">Sắp hỗ trợ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
