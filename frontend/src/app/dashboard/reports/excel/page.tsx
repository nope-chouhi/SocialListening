'use client';

import { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, RefreshCcw, Table, Check } from 'lucide-react';
import { mentions as mentionsApi, reports as reportsApi } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast from 'react-hot-toast';
import { ReportDataScopeNotice } from '@/components/reports/ReportDataScopeNotice';
import { ExportHistoryTable } from '@/components/reports/ExportHistoryTable';

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

const DATE_RANGE_OPTIONS = [
  { label: 'Today', value: '1d', days: 1 },
  { label: 'Last 7 days', value: '7d', days: 7 },
  { label: 'Last 30 days', value: '30d', days: 30 },
  { label: 'Last 90 days', value: '90d', days: 90 },
  { label: 'All time', value: 'all', days: null },
];

export default function ExcelReportPage() {
  const { activeProject } = useProject();
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'mentions'>('all');
  const [exportHistory, setExportHistory] = useState<any[]>([]);
  const [exportHistoryLoading, setExportHistoryLoading] = useState(true);

  useEffect(() => {
    fetchExports();
    
    // Poll history every 5s if there are pending/running tasks
    const interval = setInterval(() => {
      setExportHistory(prev => {
        if (prev.some(e => e.status === 'pending' || e.status === 'running')) {
          fetchExports();
        }
        return prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchExports = async () => {
    setExportHistoryLoading(true);
    try {
      const res = await reportsApi.listExports(1, 10, 'excel');
      setExportHistory(res.items || []);
    } catch (e) {}
    finally { setExportHistoryLoading(false); }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {};
      if (activeProject) params.project_id = activeProject.id;

      const selectedRange = DATE_RANGE_OPTIONS.find(r => r.value === dateRange);
      if (selectedRange?.days) {
        const now = new Date();
        const from = new Date();
        from.setDate(now.getDate() - selectedRange.days);
        params.date_from = from.toISOString();
        params.date_to = now.toISOString();
      }

      let blob;
      let filename;
      
      if (exportScope === 'all') {
        await reportsApi.requestExport('excel', activeProject?.id);
        toast.success('Excel export requested! Check the history below.');
        fetchExports();
      } else {
        // Raw mentions CSV still synchronous
        const blob = await mentionsApi.exportCsv(params);
        const filename = `Nope24_Mentions_Export_${new Date().toISOString().slice(0, 10)}.csv`;
        if (!blob || blob.size === 0) {
          toast.error('Không có dữ liệu để xuất với bộ lọc hiện tại');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`CSV file downloaded!`);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Error requesting export');
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (exportId: number, filename: string) => {
    try {
      const blob = await reportsApi.downloadExport(exportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Failed to download file');
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">

      {/* Data Scope Notice */}
      <ReportDataScopeNotice
        projectName={activeProject?.name}
        dateRange={dateRange}
        dateRangeLabel={DATE_RANGE_OPTIONS.find(r => r.value === dateRange)?.label}
      />

      <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-8 border-b border-gray-100 dark:border-gray-800">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center mb-6">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Generate Excel file</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Select scope of Data you want to include in Excel file.</p>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-8">
          
          <div className="space-y-4">
            <label className="text-sm font-semibold text-slate-900 dark:text-white">Data Scope</label>
            
            <div 
              className={cn(
                "p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-4",
                exportScope === 'all' ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              )}
              onClick={() => setExportScope('all')}
            >
              <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5", exportScope === 'all' ? "border-emerald-500 bg-emerald-500" : "border-gray-300")}>
                {exportScope === 'all' && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">All data from current Project (.xlsx)</h4>
                <p className="text-sm text-gray-500">Includes Summary metrics, Top Sources, Influencers, and Mentions with AI Sentiment analysis.</p>
              </div>
            </div>

            <div 
              className={cn(
                "p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-4",
                exportScope === 'mentions' ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              )}
              onClick={() => setExportScope('mentions')}
            >
              <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5", exportScope === 'mentions' ? "border-emerald-500 bg-emerald-500" : "border-gray-300")}>
                {exportScope === 'mentions' && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Raw Mentions only (.csv)</h4>
                <p className="text-sm text-gray-500">Generates a flat CSV file with up to 5000 mentions suitable for importing into BI tools.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-semibold text-slate-900 dark:text-white">Time Range</label>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="w-full max-w-xs bg-white dark:bg-[#0f172a] border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {DATE_RANGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-gray-50 dark:bg-[#0f172a] border-t border-gray-100 dark:border-gray-800 flex justify-end gap-4">
          <button
            disabled={loading}
            onClick={handleExport}
            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50"
          >
            {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Table className="w-5 h-5" />}
            {loading ? 'Generating...' : 'Generate Excel File'}
          </button>
        </div>

      </div>

      {/* Export History Section */}
      <div className="mt-8 bg-white dark:bg-[#1E293B] p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Recent Exports</h3>
        <ExportHistoryTable
          exports={exportHistory}
          loading={exportHistoryLoading}
          onDownload={downloadFile}
        />
      </div>
    </div>
  );
}
