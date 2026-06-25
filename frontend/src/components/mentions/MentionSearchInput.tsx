import React from 'react';
import { Search, X } from 'lucide-react';

interface MentionSearchInputProps {
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
}

export function MentionSearchInput({ value, onChange, onClear, placeholder = 'Tìm kiếm mentions, từ khóa...', className = '' }: MentionSearchInputProps) {
  return (
    <div className={`relative flex-1 ${className}`}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white dark:bg-[#050A15] border border-gray-200 dark:border-white/10 rounded-xl pl-11 pr-10 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm"
      />
      {value && (
        <button
          onClick={onClear}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
