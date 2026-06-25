import React from 'react';
import { Search, ChevronDown, RefreshCw, Download, Loader2, SlidersHorizontal } from 'lucide-react';
import { MentionSearchInput } from './MentionSearchInput';

interface MentionFilterBarProps {
  searchInput: string;
  onSearchChange: (val: string) => void;
  onScanClick: () => void;
  onExportClick: () => void;
  onRefreshClick: () => void;
  onSaveFilterClick: () => void;
  onClearFilters: () => void;
  isScanning: boolean;
  isLoading: boolean;
  hasActiveFilters: boolean;
  sortValue: string;
  onSortChange: (val: string) => void;
  sortOptions: { value: string; label: string }[];
  sortOpen: boolean;
  setSortOpen: (open: boolean) => void;
}

export function MentionFilterBar({
  searchInput,
  onSearchChange,
  onScanClick,
  onExportClick,
  onRefreshClick,
  onSaveFilterClick,
  onClearFilters,
  isScanning,
  isLoading,
  hasActiveFilters,
  sortValue,
  onSortChange,
  sortOptions,
  sortOpen,
  setSortOpen
}: MentionFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 bg-white dark:bg-[#050A15] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <MentionSearchInput
          value={searchInput}
          onChange={onSearchChange}
          onClear={() => onSearchChange('')}
        />
        <button
          onClick={onScanClick}
          disabled={isScanning || !searchInput}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 whitespace-nowrap shadow-sm"
        >
          {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {isScanning ? 'Đang quét...' : 'Scan Now'}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 dark:border-white/5 pt-3">
        {/* Left Side: Sort & Actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors"
            >
              {sortOptions.find((o) => o.value === sortValue)?.label || 'By relevance'}
              <ChevronDown className="w-4 h-4" />
            </button>
            {sortOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setSortOpen(false)}
                ></div>
                <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-[#050A15] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl z-20 py-1">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        onSortChange(opt.value);
                        setSortOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                        sortValue === opt.value
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-[#0a0f1c]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-500 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}

          <button
            onClick={onSaveFilterClick}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-bold transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Save filters
          </button>
        </div>

        {/* Right Side: Tools & Scan */}
        <div className="flex items-center gap-3">
          <button
            onClick={onRefreshClick}
            className="p-2 text-slate-500 dark:text-gray-400 hover:text-blue-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onExportClick}
            className="p-2 text-slate-500 dark:text-gray-400 hover:text-blue-600 transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
