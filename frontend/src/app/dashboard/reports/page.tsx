'use client';

import { useState, useEffect } from 'react';
import { BarChart, FileText, Download, Mail, Copy, CheckCircle, RefreshCcw, X, ExternalLink, Plus } from 'lucide-react';
import { reports, mentions as mentionsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [removingMention, setRemovingMention] = useState<number | null>(null);

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

  const handleRemoveFromReport = async (mentionId: number) => {
    try {
      setRemovingMention(mentionId);
      await mentionsApi.addToReport(mentionId, false);
      toast.success('Đã xóa mention khỏi báo cáo');
      fetchData(); // Refresh report data
    } catch (error) {
      toast.error('Lỗi khi xóa mention khỏi báo cáo');
    } finally {
      setRemovingMention(null);
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
        
        if (!element) {
          toast.error('Không tìm thấy nội dung báo cáo để xuất', { id: 'export-pdf' });
          setExporting(false);
          return;
        }
        
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
        <div className="text-slate-500 dark:text-gray-400 font-medium tracking-wide flex items-center">
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Báo Cáo (Reports)</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Trình xuất báo cáo định kỳ và tùy chỉnh.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleCopyLink}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white dark:bg-[#1E293B] text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:text-white border border-slate-300 dark:border-gray-700 hover:border-gray-500 rounded-xl transition-all font-medium"
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
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl shadow-xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button onClick={() => handleExport('PDF')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:text-white hover:bg-gray-800 transition-colors">PDF Report</button>
              <button disabled className="w-full text-left px-4 py-2 text-sm text-gray-500 cursor-not-allowed flex items-center gap-2">
                PowerPoint (PPTX) <span className="text-[9px] bg-gray-600 text-slate-500 dark:text-gray-400 px-1.5 py-0.5 rounded uppercase">Coming soon</span>
              </button>
              <button onClick={() => window.location.href = '/dashboard/reports/excel'} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:text-white hover:bg-gray-800 transition-colors">Excel / CSV Export</button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div id="report-content" className="bg-[#050A15] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-10 max-w-4xl mx-auto min-h-[800px] border border-white/10 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <div className="border-b-2 border-white/10 pb-8 mb-10 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                  <span className="text-slate-900 dark:text-white font-black text-xl">N</span>
                </div>
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 tracking-tight">EXECUTIVE REPORT</h2>
              </div>
              <p className="text-zinc-400 mt-2 font-medium tracking-wide">Báo cáo Trí tuệ Danh tiếng & Phân tích Dữ liệu</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Nope Intelligence</div>
              <div className="text-xs text-indigo-400 mt-1 font-mono bg-indigo-500/10 inline-block px-3 py-1 rounded-md border border-indigo-500/20">
                DATE: {new Date(data?.generated_at || Date.now()).toLocaleDateString('vi-VN')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-inner relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 relative z-10">Tổng Mentions</div>
              <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tight relative z-10">{data?.metrics?.total_mentions?.toLocaleString() || 0}</div>
              <div className="text-[10px] font-bold text-indigo-400 mt-3 uppercase tracking-widest flex items-center gap-2 relative z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                AI Phân tích toàn diện
              </div>
            </div>
            
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-inner relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 relative z-10">Chỉ số Sắc thái (Sentiment)</div>
              <div className="flex items-end space-x-3 relative z-10">
                <div className="text-5xl font-black text-emerald-400 tracking-tight">{data?.metrics?.sentiment?.positive || 0}</div>
                <div className="text-sm text-emerald-500/70 mb-1.5 font-bold uppercase tracking-wider">Tích cực</div>
              </div>
              <div className="flex items-center space-x-6 mt-4 text-xs font-bold uppercase tracking-wider relative z-10">
                <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-rose-500 mr-2 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span><span className="text-zinc-300">{data?.metrics?.sentiment?.negative || 0} Tiêu cực</span></div>
                <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-zinc-500 mr-2"></span><span className="text-zinc-400">{data?.metrics?.sentiment?.neutral || 0} Trung lập</span></div>
              </div>
            </div>
          </div>

          <div className="mb-12">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">Mentions Được Chọn Cho Báo Cáo</h3>
              <span className="text-xs text-slate-500 dark:text-gray-400">{data?.selected_mentions?.length || 0} mentions</span>
            </div>
            <div className="space-y-3">
              {data?.selected_mentions && data.selected_mentions.length > 0 ? (
                data.selected_mentions.map((m: any, i: number) => (
                  <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">{m.title || 'Không có tiêu đề'}</h4>
                          {m.url && (
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-500 hover:text-indigo-400 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mb-2">{m.domain || m.source_name || 'unknown'}</p>
                        <p className="text-xs text-slate-700 dark:text-gray-300 line-clamp-2">{m.snippet || m.content?.substring(0, 200) || ''}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                          m.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          m.sentiment?.includes('negative') ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          'bg-gray-500/10 text-slate-500 dark:text-gray-400 border-gray-500/20'
                        }`}>
                          {m.sentiment || 'unknown'}
                        </span>
                        <button
                          onClick={() => handleRemoveFromReport(m.id)}
                          disabled={removingMention === m.id}
                          className="text-xs text-gray-500 hover:text-rose-400 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {removingMention === m.id ? (
                            <RefreshCcw className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 bg-white/5 border border-white/5 rounded-xl text-center">
                  <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">Chưa có mentions nào được chọn cho báo cáo.</p>
                  <Link
                    href="/dashboard/mentions"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm Mentions từ trang Mentions
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* AI Strategic Advice Block */}
          <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/20 border border-indigo-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(99,102,241,0.1)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                <CheckCircle className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-sm font-black text-indigo-300 uppercase tracking-widest">Ghi chú báo cáo</h3>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Báo cáo này được tạo tự động từ dữ liệu Social Listening thu thập bởi hệ thống Nope.
              Để xem phân tích AI chi tiết, vui lòng truy cập trang <strong>Analysis Summary</strong> và nhấn "Tạo AI Summary".
            </p>
          </div>

          <div className="mt-16 pt-6 border-t border-white/5 text-center flex flex-col items-center justify-center">
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-2">Generated by</div>
            <div className="flex items-center gap-2 opacity-50 grayscale">
              <div className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center">
                <span className="text-slate-900 dark:text-white font-black text-[10px]">N</span>
              </div>
              <span className="text-sm font-black text-slate-900 dark:text-white tracking-widest">NOPE INTELLIGENCE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
