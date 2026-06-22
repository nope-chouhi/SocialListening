'use client';

import { useState, useEffect } from 'react';
import { BarChart, FileText, Download, Mail, Copy, CheckCircle, RefreshCcw, X, ExternalLink, Plus, Settings } from 'lucide-react';
import { reports, mentions as mentionsApi } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function ReportsPage() {
  const { activeProject } = useProject();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [removingMention, setRemovingMention] = useState<number | null>(null);

  const [dateRange, setDateRange] = useState('30d');
  
  // Section Toggles
  const [showSummary, setShowSummary] = useState(true);
  const [showSentiment, setShowSentiment] = useState(true);
  const [showMentions, setShowMentions] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeProject, dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (activeProject) params.project_id = activeProject.id;
      
      const days = parseInt(dateRange.replace('d', ''));
      if (!isNaN(days)) {
        const now = new Date();
        const from = new Date();
        from.setDate(now.getDate() - days);
        params.date_from = from.toISOString();
        params.date_to = now.toISOString();
      }

      const res = await reports.summaryData(params);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Báo Cáo (Reports)</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Trình xuất báo cáo định kỳ và tùy chỉnh.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleCopyLink}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-white dark:bg-[#1E293B] text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:text-white border border-slate-300 dark:border-gray-700 hover:border-gray-500 rounded-lg transition-all font-medium text-sm"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>QuickShare Link</span>
          </button>
          <div className="relative group">
            <button 
              disabled={exporting || loading}
              onClick={() => handleExport('PDF')}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-all shadow-sm shadow-indigo-500/20 font-medium text-sm disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Đang xuất...' : 'Xuất PDF Report'}</span>
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl shadow-xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button disabled className="w-full text-left px-4 py-2 text-sm text-gray-500 cursor-not-allowed flex items-center gap-2">
                PowerPoint (PPTX) <span className="text-[9px] bg-gray-600 text-slate-500 dark:text-gray-400 px-1.5 py-0.5 rounded uppercase">Coming soon</span>
              </button>
              <button onClick={() => window.location.href = '/dashboard/reports/excel'} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:text-white hover:bg-gray-800 transition-colors">Excel / CSV Export</button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left: Configuration Panel */}
        <div className="w-full lg:w-80 shrink-0 space-y-6">
          <div className="bg-white dark:bg-[#050A15] p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-400" /> Cấu hình báo cáo
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Khoảng thời gian</label>
                <select
                  value={dateRange}
                  onChange={e => setDateRange(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="7d">7 ngày qua</option>
                  <option value="30d">30 ngày qua</option>
                  <option value="90d">90 ngày qua</option>
                  <option value="all">Tất cả</option>
                </select>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-white/5 space-y-3">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Nội dung hiển thị</label>
                
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={showSummary} onChange={e => setShowSummary(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-white">Tổng quan Metrics</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={showSentiment} onChange={e => setShowSentiment(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-white">Tỷ lệ sắc thái (Sentiment)</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={showMentions} onChange={e => setShowMentions(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-white">Mentions được chọn ({data?.selected_mentions?.length || 0})</span>
                </label>
              </div>
            </div>
          </div>
          
          <div className="bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
            <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">Mẹo:</h4>
            <p className="text-xs text-indigo-600 dark:text-indigo-200 leading-relaxed">
              Các tuỳ chọn bạn bật ở đây sẽ phản ánh trực tiếp vào bản Preview bên cạnh, và bản PDF tải về sẽ y hệt như Preview.
            </p>
          </div>
        </div>

        {/* Right: Preview Panel */}
        <div className="flex-1 overflow-x-auto pb-8">
          <div className="bg-white dark:bg-transparent p-4 sm:p-8 rounded-[2rem] border border-slate-200 dark:border-transparent shadow-sm dark:shadow-none min-w-[800px]">
            {/* Actual PDF Content */}
            <div id="report-content" className="bg-[#050A15] rounded-2xl shadow-xl dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] p-10 w-full min-h-[800px] border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />
              
              <div className="relative z-10">
                {/* PDF Header */}
                <div className="border-b-2 border-white/10 pb-8 mb-10 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                        <span className="text-white font-black text-xl">N</span>
                      </div>
                      <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 tracking-tight">EXECUTIVE REPORT</h2>
                    </div>
                    <p className="text-zinc-400 mt-2 font-medium tracking-wide">Dự án: {data?.project_name || activeProject?.name || 'Toàn hệ thống'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-white uppercase tracking-[0.2em]">Nope Intelligence</div>
                    <div className="text-xs text-indigo-400 mt-1 font-mono bg-indigo-500/10 inline-block px-3 py-1 rounded-md border border-indigo-500/20">
                      DATE: {new Date(data?.generated_at || Date.now()).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                </div>

                {/* PDF Body */}
                {(showSummary || showSentiment) && (
                  <div className="grid grid-cols-2 gap-8 mb-12">
                    {showSummary && (
                      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-inner relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 relative z-10">Tổng Mentions</div>
                        <div className="text-5xl font-black text-white tracking-tight relative z-10">{data?.metrics?.total_mentions?.toLocaleString() || 0}</div>
                        <div className="text-[10px] font-bold text-indigo-400 mt-3 uppercase tracking-widest flex items-center gap-2 relative z-10">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                          Giai đoạn: {dateRange}
                        </div>
                      </div>
                    )}
                    
                    {showSentiment && (
                      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-inner relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 relative z-10">Sắc thái chính</div>
                        <div className="flex items-end space-x-3 relative z-10">
                          <div className="text-5xl font-black text-emerald-400 tracking-tight">{data?.metrics?.sentiment?.positive || 0}</div>
                          <div className="text-sm text-emerald-500/70 mb-1.5 font-bold uppercase tracking-wider">Tích cực</div>
                        </div>
                        <div className="flex items-center space-x-6 mt-4 text-xs font-bold uppercase tracking-wider relative z-10">
                          <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-rose-500 mr-2 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span><span className="text-zinc-300">{data?.metrics?.sentiment?.negative || 0} Tiêu cực</span></div>
                          <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-zinc-500 mr-2"></span><span className="text-zinc-400">{data?.metrics?.sentiment?.neutral || 0} Trung lập</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {showMentions && (
                  <div className="mb-12">
                    <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                      <h3 className="text-sm font-bold text-white uppercase tracking-widest">Mentions Được Chọn</h3>
                      <span className="text-xs text-slate-400">{data?.selected_mentions?.length || 0} mentions</span>
                    </div>
                    <div className="space-y-3">
                      {data?.selected_mentions && data.selected_mentions.length > 0 ? (
                        data.selected_mentions.map((m: any, i: number) => (
                          <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors group">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-bold text-white text-sm line-clamp-1">{m.title || 'Không có tiêu đề'}</h4>
                                  {m.url && (
                                    <a
                                      href={m.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-gray-400 hover:text-indigo-400 transition-colors"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 mb-2">{m.domain || m.source_name || 'unknown'}</p>
                                <p className="text-xs text-slate-300 line-clamp-2">{m.snippet || m.content?.substring(0, 200) || ''}</p>
                              </div>
                              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                                  m.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  m.sentiment?.includes('negative') ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                  'bg-gray-500/10 text-slate-300 border-gray-500/20'
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
                          <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                          <p className="text-sm text-slate-400 mb-4">Chưa có mentions nào được chọn cho báo cáo.</p>
                          <Link
                            href="/dashboard/mentions"
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            Thêm Mentions
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* PDF Footer */}
                <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/20 border border-indigo-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(99,102,241,0.1)]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                      <CheckCircle className="w-5 h-5 text-indigo-400" />
                    </div>
                    <h3 className="text-sm font-black text-indigo-300 uppercase tracking-widest">Ghi chú hệ thống</h3>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    Báo cáo này được tạo tự động từ hệ thống Social Listening Nope. Dữ liệu trên đã được chắt lọc theo bộ cấu hình trong thời điểm xuất.
                  </p>
                </div>

                <div className="mt-16 pt-6 border-t border-white/5 text-center flex flex-col items-center justify-center">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">Generated by</div>
                  <div className="flex items-center gap-2 opacity-50 grayscale">
                    <div className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center">
                      <span className="text-white font-black text-[10px]">N</span>
                    </div>
                    <span className="text-sm font-black text-white tracking-widest">NOPE INTELLIGENCE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
