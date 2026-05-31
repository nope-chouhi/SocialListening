'use client';

import { useState, useEffect } from 'react';
import { BarChart, FileText, Download, Mail, Copy, CheckCircle, RefreshCcw } from 'lucide-react';
import { reports } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await reports.summary();
      setData(res);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href + '?shared=true');
    setCopied(true);
    toast.success('Đã copy link QuickShare');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async (format: string) => {
    if (format === 'PDF') {
      setExporting(true);
      toast.loading('Đang xuất PDF...', { id: 'export-pdf' });
      try {
        const html2pdf = (await import('html2pdf.js')).default;
        const element = document.getElementById('report-content');
        
        const opt: any = {
          margin:       10,
          filename:     `Brand_Report_${new Date().toISOString().split('T')[0]}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(element).save();
        toast.success('Xuất PDF thành công!', { id: 'export-pdf' });
      } catch (e) {
        console.error('Lỗi khi xuất PDF', e);
        toast.error('Lỗi khi xuất PDF', { id: 'export-pdf' });
      } finally {
        setExporting(false);
      }
    } else {
      toast.error(`Xuất ${format} chưa được tích hợp (Đang phát triển)`);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 font-medium tracking-wide flex items-center">
          <RefreshCcw className="w-5 h-5 mr-2 animate-spin text-indigo-400" />
          Đang tải báo cáo...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Báo Cáo (Reports)</h1>
          <p className="text-sm text-gray-400 mt-1">Trình xuất báo cáo định kỳ và tùy chỉnh.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleCopyLink}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#1E293B] text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 rounded-xl transition-all font-medium"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>QuickShare Link</span>
          </button>
          <div className="relative group">
            <button 
              disabled={exporting}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-all shadow-sm shadow-indigo-500/20 font-medium disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Đang xuất...' : 'Xuất Báo Cáo'}</span>
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-[#1E293B] border border-gray-700 rounded-xl shadow-xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button onClick={() => handleExport('PDF')} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">PDF Report</button>
              <button onClick={() => handleExport('PowerPoint')} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">PowerPoint (PPTX)</button>
              <button onClick={() => handleExport('Excel')} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">Excel (XLSX)</button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div id="report-content" className="bg-white rounded-lg shadow-2xl p-8 max-w-4xl mx-auto min-h-[800px] border border-gray-200">
        <div className="border-b-2 border-gray-100 pb-6 mb-8 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">BRAND REPORT</h2>
            <p className="text-gray-500 mt-2">Dữ liệu Social Listening tổng hợp</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-gray-900 uppercase tracking-wider">Nope Intelligence</div>
            <div className="text-xs text-gray-500 mt-1">Ngày: {new Date(data?.generated_at || Date.now()).toLocaleDateString('vi-VN')}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-12">
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Tổng Mentions</div>
            <div className="text-4xl font-black text-indigo-600">{data?.metrics?.total_mentions?.toLocaleString() || 0}</div>
            <div className="text-xs font-medium text-emerald-600 mt-2">Đã được AI phân tích toàn bộ</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Chỉ số Cảm xúc (Sentiment)</div>
            <div className="flex items-end space-x-2">
              <div className="text-4xl font-black text-emerald-600">{data?.metrics?.sentiment?.positive || 0}</div>
              <div className="text-sm text-gray-500 mb-1">Tích cực</div>
            </div>
            <div className="flex items-center space-x-4 mt-3 text-sm">
              <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-rose-500 mr-2"></span><span className="text-gray-600 font-medium">{data?.metrics?.sentiment?.negative || 0} Tiêu cực</span></div>
              <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-gray-400 mr-2"></span><span className="text-gray-600 font-medium">{data?.metrics?.sentiment?.neutral || 0} Trung lập</span></div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Top Nguồn Đóng Góp Thảo Luận</h3>
          <div className="space-y-3">
            {data?.top_sources?.map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">{i + 1}</div>
                  <span className="font-semibold text-gray-700">{s.name}</span>
                </div>
                <span className="font-black text-gray-900">{s.count.toLocaleString()} mentions</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center text-xs font-medium text-gray-400">
          Tài liệu này được tạo tự động bởi hệ thống AI của Nope Social Listening.
        </div>
      </div>
    </div>
  );
}
