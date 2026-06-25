import React from 'react';
import { X } from 'lucide-react';

interface ActiveFilterChipsProps {
  filters: {
    sentiment: string | null;
    source_type: string | null;
    min_risk_score: number | null;
    min_influence_score: number | null;
  };
  searchTerm: string;
  dateRange: string;
  onRemoveFilter: (key: string) => void;
  onClearAll: () => void;
}

export function MentionActiveFilterChips({
  filters,
  searchTerm,
  dateRange,
  onRemoveFilter,
  onClearAll
}: ActiveFilterChipsProps) {
  const activeChips = [];

  if (searchTerm) {
    activeChips.push({ key: 'search', label: `Tìm kiếm: ${searchTerm}` });
  }
  if (filters.sentiment) {
    const sentimentLabels: Record<string, string> = { positive: 'Tích cực', neutral: 'Trung lập', negative: 'Tiêu cực' };
    activeChips.push({ key: 'sentiment', label: `Cảm xúc: ${sentimentLabels[filters.sentiment] || filters.sentiment}` });
  }
  if (filters.source_type) {
    const sources = filters.source_type.split(',').join(', ');
    activeChips.push({ key: 'source_type', label: `Nguồn: ${sources}` });
  }
  if (filters.min_risk_score !== null) {
    activeChips.push({ key: 'min_risk_score', label: `Rủi ro ≥ ${filters.min_risk_score}` });
  }
  if (filters.min_influence_score !== null) {
    activeChips.push({ key: 'min_influence_score', label: `Ảnh hưởng ≥ ${filters.min_influence_score}` });
  }
  if (dateRange && dateRange !== 'all') {
    const dateLabels: Record<string, string> = { '1d': 'Hôm nay', '7d': '7 ngày qua', '30d': '30 ngày qua', '90d': '90 ngày qua' };
    activeChips.push({ key: 'dateRange', label: `Thời gian: ${dateLabels[dateRange] || dateRange}` });
  }

  if (activeChips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {activeChips.map(chip => (
        <div key={chip.key} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full border border-blue-200 dark:border-blue-700/50 shadow-sm">
          <span>{chip.label}</span>
          <button
            onClick={() => onRemoveFilter(chip.key)}
            className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      {activeChips.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline ml-2 transition-colors"
        >
          Xóa tất cả
        </button>
      )}
    </div>
  );
}
