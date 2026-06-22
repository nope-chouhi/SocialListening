'use client';

import { useState } from 'react';
import { FileSpreadsheet, Download, Filter, RefreshCcw, Table } from 'lucide-react';
import { mentions as mentionsApi, reports as reportsApi } from '@/lib/api';
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
  const [exportType, setExportType] = useState<'xlsx' | 'csv'>('xlsx');

  const handleExport = async (type: 'xlsx' | 'csv') => {
    try {
      setLoading(true);
      setExportType(type);
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

      let blob;
      let filename;
      
      if (type === 'xlsx') {
        blob = await reportsApi.exportProjectSummaryXlsx(params);
        filename = `project_summary_${new Date().toISOString().slice(0, 10)}.xlsx`;
      } else {
        blob = await mentionsApi.exportCsv(params);
        filename = `mentions_export_${new Date().toISOString().slice(0, 10)}.csv`;
      }
      
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
      toast.success(`Xuất ${type.toUpperCase()} thành công!`);
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

              <div className="pt-2 space-y-3">
                <div className="text-xs text-slate-500 dark:text-gray-400 mb-3">
                  Project: <span className="font-bold text-gray-700 dark:text-gray-200">{activeProject?.name || 'Toàn hệ thống'}</span>
                </div>
                <button
                  onClick={() => handleExport('xlsx')}
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {loading && exportType === 'xlsx' ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Table className="w-4 h-4" />}
                  {loading && exportType === 'xlsx' ? 'Đang xuất...' : 'Tải xuống Excel (.xlsx)'}
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  disabled={loading}
                  className="w-full py-2.5 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-gray-700 hover:border-gray-500 text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {loading && exportType === 'csv' ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {loading && exportType === 'csv' ? 'Đang xuất...' : 'Tải xuống CSV thô'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="md:col-span-2">
          <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-6 h-full flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Cấu trúc file Excel (.xlsx)</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">
                File Excel xuất ra được định dạng chuyên nghiệp với các trang tính (sheets) sau:
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">1</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Summary</h4>
                    <p className="text-xs text-slate-500 dark:text-gray-400">Tổng hợp thông tin dự án, khoảng thời gian và số liệu tổng quan (Mentions, Alerts, Incidents).</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">2</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Mentions</h4>
                    <p className="text-xs text-slate-500 dark:text-gray-400">Danh sách chi tiết các mentions cùng phân tích sắc thái AI.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
                    <span className="font-bold text-red-600 dark:text-red-400 text-sm">3</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Alerts</h4>
                    <p className="text-xs text-slate-500 dark:text-gray-400">Danh sách cảnh báo được ghi nhận trong thời gian này.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                    <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">4</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Incidents</h4>
                    <p className="text-xs text-slate-500 dark:text-gray-400">Danh sách các sự cố khủng hoảng (nếu có).</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
              <h4 className="font-bold text-emerald-800 dark:text-emerald-400 text-sm mb-1">Dành cho chuyên gia phân tích:</h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                Nút <strong>"Tải xuống Excel"</strong> sẽ xuất báo cáo tổng hợp chuyên nghiệp (đã format sẵn, dễ đọc).<br />
                Nút <strong>"Tải xuống CSV thô"</strong> sẽ xuất định dạng 1 bảng duy nhất tối đa 5000 dòng để dễ import vào PowerBI/Tableau.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
