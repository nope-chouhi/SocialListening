import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ReportErrorStateProps {
  /** The error message from the API call. */
  errorMessage?: string | null;
  /** Callback to retry the failed API call. */
  onRetry?: () => void;
}

/**
 * ReportErrorState
 *
 * Shown when the report data API (`/api/reports/summary-data`) or the
 * export history API fails. Replaces the previous behavior where the
 * error was only shown as a toast and the page appeared empty.
 *
 * This component surfaces the real API error message so the user knows
 * the absence of data is due to a backend error, not "no data".
 */
export function ReportErrorState({ errorMessage, onRetry }: ReportErrorStateProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-red-100 dark:border-red-900/30">
      <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-2">
        {t('reports.failedToLoad')}
      </h3>
      <p className="text-slate-500 dark:text-gray-400 max-w-sm text-sm mb-6">
        {errorMessage || t('reports.failedToLoad')}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-gray-200 font-semibold text-sm rounded-xl transition-colors"
        >
          <RefreshCcw className="w-4 h-4" />
          {t('reports.retry')}
        </button>
      )}
    </div>
  );
}
