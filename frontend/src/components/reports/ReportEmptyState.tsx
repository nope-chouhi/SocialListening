import React from 'react';
import { BarChart2, FileText } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ReportEmptyStateProps {
  /** Whether there's no active project selected. */
  noProject?: boolean;
  /** Custom message to show. */
  message?: string;
}

/**
 * ReportEmptyState
 *
 * Shown when:
 * - No active project is selected, so the report has no data context.
 * - The summary API returned but has no usable data.
 *
 * Does NOT fake any data or provide a "placeholder" report.
 */
export function ReportEmptyState({ noProject, message }: ReportEmptyStateProps) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
      <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
        {noProject ? (
          <FileText className="w-8 h-8 text-slate-400 dark:text-gray-500" />
        ) : (
          <BarChart2 className="w-8 h-8 text-slate-400 dark:text-gray-500" />
        )}
      </div>
      <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-2">
        {noProject ? t('mentions.page.selectProject') : t('reports.noReportData')}
      </h3>
      <p className="text-slate-500 dark:text-gray-400 max-w-sm text-sm">
        {message || (
          noProject
            ? 'Select a project from the project switcher to generate a report.'
            : 'There is no data for the selected project and date range. Try expanding the time range or scanning for more mentions.'
        )}
      </p>
    </div>
  );
}
