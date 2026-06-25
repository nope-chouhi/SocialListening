import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface MentionFilterErrorStateProps {
  errorMessage: string;
  onRetry: () => void;
}

export function MentionFilterErrorState({ errorMessage, onRetry }: MentionFilterErrorStateProps) {
  return (
    <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-rose-200 dark:border-rose-900/30">
      <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-4 text-rose-500">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
        Lỗi tải dữ liệu
      </h3>
      <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md">
        Đã xảy ra lỗi thực tế từ hệ thống backend khi tải danh sách mentions. 
        <br/><span className="text-rose-600 dark:text-rose-400 font-medium text-sm mt-2 block">{errorMessage}</span>
      </p>
      <button 
        onClick={onRetry} 
        className="px-6 py-2 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/50"
      >
        <RefreshCw className="w-4 h-4" /> Thử lại
      </button>
    </div>
  );
}
