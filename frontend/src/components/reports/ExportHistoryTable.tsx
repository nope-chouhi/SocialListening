import React from 'react';
import { Download, RefreshCcw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ExportItem {
  id: number;
  report_type: string;
  status: 'pending' | 'running' | 'success' | 'failed' | string;
  created_at: string;
  error_message?: string | null;
  file_path?: string | null;
}

interface ExportHistoryTableProps {
  exports: ExportItem[];
  /** Called when the user clicks Download for a completed export. */
  onDownload: (id: number, filename: string) => void;
  /** Whether the history is currently being loaded. */
  loading?: boolean;
}

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const label =
    status === 'pending' ? t('reports.statusPending') :
    status === 'running' ? t('reports.statusRunning') :
    status === 'success' ? t('reports.statusSuccess') :
    status === 'failed' ? t('reports.statusFailed') : status;

  return (
    <span
      className={cn(
        'px-2.5 py-1 rounded-lg text-xs font-semibold',
        status === 'success' && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
        status === 'failed' && 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
        (status === 'pending' || status === 'running') &&
          'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 animate-pulse',
      )}
    >
      {status === 'running' && <RefreshCcw className="inline w-3 h-3 mr-1 animate-spin" />}
      {label}
    </span>
  );
}

/**
 * ExportHistoryTable
 *
 * Shared export history component used in both the PDF and Excel report
 * pages. Displays real export history from the backend `/api/reports/exports/history`
 * endpoint. Does not fake any export status or download links.
 */
export function ExportHistoryTable({ exports, onDownload, loading }: ExportHistoryTableProps) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="py-10 text-center">
        <RefreshCcw className="w-5 h-5 animate-spin text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500 dark:text-gray-400">{t('reports.exportHistoryLoading')}</p>
      </div>
    );
  }

  if (exports.length === 0) {
    return (
      <div className="py-10 text-center text-slate-500 dark:text-gray-400 text-sm">
        {t('reports.exportHistoryEmpty')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 font-semibold">{t('reports.exportId')}</th>
            <th className="px-4 py-3 font-semibold">{t('reports.exportType')}</th>
            <th className="px-4 py-3 font-semibold">{t('reports.exportStatus')}</th>
            <th className="px-4 py-3 font-semibold">{t('reports.exportRequestedAt')}</th>
            <th className="px-4 py-3 font-semibold">{t('reports.exportActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {exports.map((ex) => (
            <tr key={ex.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <td className="px-4 py-3 text-slate-500 dark:text-gray-400 font-mono text-xs">
                #{ex.id}
              </td>
              <td className="px-4 py-3 font-semibold uppercase text-slate-700 dark:text-gray-200 text-xs tracking-wider">
                {ex.report_type}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={ex.status} />
                {ex.error_message && (
                  <p
                    className="text-xs text-rose-500 mt-1 max-w-xs truncate"
                    title={ex.error_message}
                  >
                    {ex.error_message}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs">
                {new Date(ex.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                {ex.status === 'success' && (
                  <button
                    onClick={() => {
                      const extMap: Record<string, string> = { excel: 'xlsx', xlsx: 'xlsx', csv: 'csv', pdf: 'pdf' };
                      const ext = extMap[ex.report_type.toLowerCase()] || ex.report_type;
                      onDownload(ex.id, `Nope360_Export_${ex.id}.${ext}`);
                    }}
                    className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold text-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {t('reports.download')}
                  </button>
                )}
                {(ex.status === 'pending' || ex.status === 'running') && (
                  <span className="text-blue-500 dark:text-blue-400 text-xs font-medium flex items-center gap-1.5">
                    <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                    {t('reports.processing')}
                  </span>
                )}
                {ex.status === 'failed' && (
                  <span className="text-rose-400 dark:text-rose-500 text-xs font-medium">{t('reports.failed')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
