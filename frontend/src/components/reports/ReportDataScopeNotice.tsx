import React from 'react';
import { Calendar, FolderOpen } from 'lucide-react';

interface ReportDataScopeNoticeProps {
  projectName?: string | null;
  dateRange: string;
  /** Optional: pass explicit resolved label, e.g. "Last 30 days" */
  dateRangeLabel?: string;
}

const DATE_RANGE_LABELS: Record<string, string> = {
  '1d': 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'all': 'All time',
};

/**
 * ReportDataScopeNotice
 *
 * Clearly communicates to the user what data scope a report covers:
 * which project and which date range. Displayed at the top of each
 * report page to avoid confusion about what data is included.
 */
export function ReportDataScopeNotice({ projectName, dateRange, dateRangeLabel }: ReportDataScopeNoticeProps) {
  const label = dateRangeLabel || DATE_RANGE_LABELS[dateRange] || dateRange;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-gray-400 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
      <span className="font-semibold text-slate-700 dark:text-gray-300">Report scope:</span>

      <span className="flex items-center gap-1.5 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1 font-medium">
        <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
        {projectName || <span className="italic text-slate-400 dark:text-gray-500">All projects</span>}
      </span>

      <span className="flex items-center gap-1.5 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1 font-medium">
        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
        {label}
      </span>
    </div>
  );
}
