'use client';

import { useState } from 'react';
import { FileSpreadsheet, Download, Filter, RefreshCcw } from 'lucide-react';
import { mentions as mentionsApi } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast from 'react-hot-toast';

const DATE_RANGE_OPTIONS = [
  { label: '30 ngày qua', value: '30d', days: 30 },
  { label: '7 ngày qua', value: '7d', days: 7 },
  { label: 'Hôm nay', value: '1d', days: 1 },
  { label: '90 ngày qua', value: '90d', days: 90 },
  { label: 'Tất cả', value: 'all', days: null },
];

export default function ExcelReportPage() {
  const { activeProject } = useProject();
  const [dateRange, setDateRange] = useState('30d');
  const [sentiment, setSentiment] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {};
      if (activeProject) params.project_id = activeProject.id;
      if (sentiment) params.sentiment = sentiment;
      if (sourceType) params.source_type = sourceType;

      const selectedRange = DATE_RANGE_OPTIONS.find(r => r.value === dateRange);
      if (selectedRange?.days) {
        const now = new Date();
        const from = new Date();
        from.setDate(now.getDate() - selectedRange.days);
        params.date_from = from.toISOString();
        params.date_to = now.toISOString();
      }

      const blob = await mentionsApi.exportCsv(params);
      if (!blob || blob.size === 0) {
        toast.error('Không có dữ liệu để xuất với bộ lọc hiện tại');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mentions_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Xuất CSV thành công!');
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Lỗi khi xuất dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            Excel / CSV Export
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Xuất toàn bộ mentions ra CSV (Excel-compatible) với bộ lọc tuỳ chỉnh.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Filters */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-400" />
              Bộ lọc xuất dữ liệu
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Khoảng thời gian</label>
                <select
                  value={dateRange}
                  onChange={e => setDateRange(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {DATE_RANGE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sentiment</label>
                <select
                  value={sentiment}
                  onChange={e => setSentiment(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Tất cả</option>
                  <option value="positive">Tích cực</option>
                  <option value="neutral">Trung lập</option>
                  <option value="negative_medium">Tiêu cực</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nguồn</label>
                <select
                  value={sourceType}
                  onChange={e => setSourceType(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Tất cả nguồn</option>
                  <option value="web">Web</option>
                  <option value="news">News</option>
                  <option value="blog">Blog</option>
                  <option value="rss">RSS</option>
                  <option value="youtube">YouTube</option>
                </select>
              </div>

              <div className="pt-2">
                <div className="text-xs text-slate-500 dark:text-gray-400 mb-3">
                  Project: <span className="font-bold text-gray-700 dark:text-gray-200">{activeProject?.name || 'Chưa chọn'}</span>
                </div>
                <button
                  onClick={handleExport}
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {loading ? 'Đang xuất...' : 'Tải xuống CSV (.csv)'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="md:col-span-2">
          <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-6 h-full">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Cấu trúc file CSV</h2>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">
              File CSV sẽ bao gồm các cột sau (tối đa 5000 dòng):
            </p>
            <div className="overflow-auto rounded-lg border border-gray-200 dark:border-white/10">
              <table className="w-full text-xs text-gray-600 dark:text-slate-500 dark:text-gray-400">
                <thead className="bg-gray-50 dark:bg-[#0a0f1c]">
                  <tr>
                    {['id', 'author', 'platform', 'source_type', 'title', 'content', 'url', 'sentiment', 'reach', 'interactions', 'influence_score', 'published_at', 'collected_at', 'keyword'].map(col => (
                      <th key={col} className="px-3 py-2 text-left font-bold whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-100 dark:border-white/5">
                    <td className="px-3 py-2 text-slate-500 dark:text-gray-400" colSpan={14}>
                      Dữ liệu thực sẽ được tải từ database khi bấm xuất...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              ✅ File CSV có thể mở trực tiếp bằng Microsoft Excel hoặc Google Sheets.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
