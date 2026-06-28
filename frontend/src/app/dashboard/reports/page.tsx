'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  FileText, Download, Copy, CheckCircle, RefreshCcw, X, ExternalLink, 
  Plus, GripVertical, ChevronDown, ChevronUp, Image as ImageIcon, Eye
} from 'lucide-react';
import { reports, mentions as mentionsApi } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { ReportDataScopeNotice } from '@/components/reports/ReportDataScopeNotice';
import { ReportEmptyState } from '@/components/reports/ReportEmptyState';
import { ReportErrorState } from '@/components/reports/ReportErrorState';
import { ExportHistoryTable } from '@/components/reports/ExportHistoryTable';

// Helper for class names
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

type Section = {
  id: string;
  name: string;
  enabled: boolean;
  count: number;
  total: number;
};

export default function ReportsPage() {
  const { activeProject } = useProject();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [exportHistoryLoading, setExportHistoryLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [exportHistory, setExportHistory] = useState<any[]>([]);

  const [dateRange, setDateRange] = useState('30d');
  
  // Customization State
  const [accentColor, setAccentColor] = useState('#6366f1'); // default indigo-500
  const [fontStyle, setFontStyle] = useState('font-sans');
  const [fontColor, setFontColor] = useState('#1e293b');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [sections, setSections] = useState<Section[]>([
    { id: 'summary', name: 'Summary', enabled: true, count: 1, total: 1 },
    { id: 'analysis', name: 'Analysis & Trends', enabled: true, count: 1, total: 1 },
    { id: 'sentiment', name: 'Sentiment', enabled: true, count: 1, total: 1 },
    { id: 'influencers', name: 'Influencers & Sources', enabled: true, count: 1, total: 1 },
    { id: 'mentions', name: 'Mentions', enabled: true, count: 0, total: 0 },
    { id: 'alerts', name: 'Alerts', enabled: false, count: 0, total: 0 },
    { id: 'incidents', name: 'Incidents', enabled: false, count: 0, total: 0 },
  ]);

  useEffect(() => {
    fetchData();
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
  }, [activeProject, dateRange]);

  const fetchExports = async () => {
    setExportHistoryLoading(true);
    try {
      const res = await reports.listExports(1, 10, 'pdf');
      setExportHistory(res.items || []);
    } catch (e) {}
    finally { setExportHistoryLoading(false); }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setFetchError(null);
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

      // Update section counts based on real data
      setSections(prev => prev.map(s => {
        if (s.id === 'mentions') return { ...s, count: res.selected_mentions?.length || 0, total: res.selected_mentions?.length || 0 };
        if (s.id === 'alerts') return { ...s, count: res.metrics?.total_alerts || 0, total: res.metrics?.total_alerts || 0 };
        if (s.id === 'incidents') return { ...s, count: res.metrics?.total_incidents || 0, total: res.metrics?.total_incidents || 0 };
        return s;
      }));

    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.message || 'Failed to load report data';
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    setUploadingLogo(true);
    const toastId = toast.loading('Uploading logo...');
    try {
      const res = await reports.uploadLogo(file);
      setLogoPath(res.logo_path);
      toast.success('Logo uploaded successfully', { id: toastId });
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to upload logo', { id: toastId });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    toast.loading('Requesting PDF generation on server...', { id: 'export-pdf' });
    try {
      const builderConfig = {
        date_range: dateRange,
        date_from: undefined, // handled by backend or we can pass explicit if needed
        date_to: undefined,
        sections: sections,
        accent_color: accentColor,
        font_style: fontStyle,
        font_color: fontColor,
        theme: theme,
        logo_path: logoPath
      };
      
      const days = parseInt(dateRange.replace('d', ''));
      if (!isNaN(days)) {
        const now = new Date();
        const from = new Date();
        from.setDate(now.getDate() - days);
        builderConfig.date_from = from.toISOString() as any;
        builderConfig.date_to = now.toISOString() as any;
      }
      
      await reports.requestExport('pdf', activeProject?.id, builderConfig);
      toast.success('PDF export requested! Check the history below.', { id: 'export-pdf' });
      fetchExports();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error requesting PDF export', { id: 'export-pdf' });
    } finally {
      setExporting(false);
    }
  };

  const downloadFile = async (exportId: number, filename: string) => {
    try {
      const blob = await reports.downloadExport(exportId);
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

  const isEnabled = (id: string) => sections.find(s => s.id === id)?.enabled;

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

  if (fetchError && !data) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <ReportErrorState errorMessage={fetchError} onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1E293B] p-4 rounded-xl border border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">PDF Reports</h1>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>

          <button 
            onClick={() => setPreviewMode(!previewMode)}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-white dark:bg-[#0f172a] text-slate-700 dark:text-gray-300 hover:text-emerald-600 border border-slate-300 dark:border-gray-700 hover:border-emerald-500 rounded-lg transition-all font-medium text-sm"
          >
            <Eye className="w-4 h-4" />
            <span>{previewMode ? 'Edit Builder' : 'Preview'}</span>
          </button>
          
          <button 
            disabled={exporting || loading}
            onClick={handleExport}
            className="flex items-center justify-center space-x-2 px-5 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg transition-all shadow-sm shadow-emerald-500/20 font-medium text-sm disabled:opacity-50"
          >
            {exporting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Data Scope Notice */}
      <ReportDataScopeNotice
        projectName={activeProject?.name}
        dateRange={dateRange}
      />

      {!activeProject && (
        <ReportEmptyState noProject />
      )}

      <div className={`grid grid-cols-1 ${previewMode ? 'hidden' : 'lg:grid-cols-1'} gap-8`}>
        {/* Main Builder Section */}
        <div className="space-y-8">
          
          {/* Report Content Blocks */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Report content</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">Pick your slides and arrange them into the order you want.</p>
            
            <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              {sections.map((section, idx) => (
                <div key={section.id} className={cn("flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-colors", idx === sections.length - 1 && "border-b-0")}>
                  <div className="flex items-center gap-4">
                    <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                    <FileText className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium text-slate-700 dark:text-gray-200 text-sm">
                      {section.name} <span className="text-gray-400 text-xs ml-1">({section.count}/{section.total})</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => toggleSection(section.id)}
                      className={cn("w-10 h-5 rounded-full relative transition-colors duration-200", section.enabled ? "bg-emerald-500" : "bg-gray-200 dark:bg-gray-700")}
                    >
                      <span className={cn("absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200", section.enabled ? "translate-x-5" : "translate-x-0")} />
                    </button>
                    <div className="flex flex-col gap-1 opacity-50">
                      <button 
                        onClick={() => {
                          if (idx === 0) return;
                          setSections(prev => {
                            const clone = [...prev];
                            [clone[idx - 1], clone[idx]] = [clone[idx], clone[idx - 1]];
                            return clone;
                          });
                        }}
                        disabled={idx === 0}
                        className="hover:text-emerald-500 disabled:opacity-30 disabled:hover:text-current"
                      >
                        <ChevronUp className="w-3 h-3 cursor-pointer" />
                      </button>
                      <button 
                        onClick={() => {
                          if (idx === sections.length - 1) return;
                          setSections(prev => {
                            const clone = [...prev];
                            [clone[idx + 1], clone[idx]] = [clone[idx], clone[idx + 1]];
                            return clone;
                          });
                        }}
                        disabled={idx === sections.length - 1}
                        className="hover:text-emerald-500 disabled:opacity-30 disabled:hover:text-current"
                      >
                        <ChevronDown className="w-3 h-3 cursor-pointer" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customization */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Customize your report</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-gray-300">Add your logo</label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0f172a] text-center hover:bg-gray-100 dark:hover:bg-[#1e293b] transition-colors relative">
                  <input 
                    type="file" 
                    accept="image/jpeg, image/png" 
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                  />
                  {logoPath ? (
                    <div className="flex flex-col items-center">
                      <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
                      <p className="text-sm text-emerald-600 font-medium">Logo uploaded</p>
                      <p className="text-xs text-gray-500 mt-1">Click to replace</p>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className={cn("w-8 h-8 mb-2", uploadingLogo ? "text-emerald-500 animate-pulse" : "text-gray-400")} />
                      <p className="text-sm text-gray-500 font-medium">{uploadingLogo ? 'Uploading...' : 'Click or drag logo here'}</p>
                      <p className="text-xs text-gray-400 mt-1">JPEG or PNG, max 5MB</p>
                    </>
                  )}
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-gray-300">Pick accent color</label>
                <div className="flex flex-wrap gap-3 mt-2">
                  {['#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'].map(color => (
                    <button
                      key={color}
                      onClick={() => setAccentColor(color)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform hover:scale-110"
                      style={{ backgroundColor: color }}
                    >
                      {accentColor === color && <CheckCircle className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                  <button className="w-8 h-8 rounded-lg border border-dashed border-gray-400 flex items-center justify-center text-gray-400 hover:text-gray-600">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Font Choice */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-gray-300">Choose font</label>
                <div className="flex flex-wrap gap-3 mt-2">
                  {[
                    { id: 'font-sans', name: 'Roboto' },
                    { id: 'font-serif', name: 'Lora' },
                    { id: 'font-mono', name: 'Mono' },
                  ].map(font => (
                    <button
                      key={font.id}
                      onClick={() => setFontStyle(font.id)}
                      className={cn(
                        "px-4 py-2 rounded-lg border bg-white dark:bg-[#1E293B] text-center transition-all",
                        fontStyle === font.id ? "border-emerald-500 shadow-[0_0_0_1px_#10b981]" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                      )}
                    >
                      <div className={cn("text-lg font-bold", font.id)}>Aa</div>
                      <div className="text-[10px] uppercase tracking-wider">{font.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Color Choice */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-gray-300">Choose font color</label>
                <div className="flex flex-wrap gap-3 mt-2">
                  {[
                    { id: '#1e293b', name: 'Black' },
                    { id: '#475569', name: 'Gray' },
                    { id: '#1e3a8a', name: 'Navy' },
                  ].map(fc => (
                    <button
                      key={fc.id}
                      onClick={() => setFontColor(fc.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform hover:scale-110"
                      style={{ backgroundColor: fc.id }}
                    >
                      {fontColor === fc.id && <CheckCircle className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Theme Choice */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-gray-300">Choose background</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  <button
                    onClick={() => setTheme('light')}
                    className={cn(
                      "p-1 rounded-xl border-2 transition-all overflow-hidden",
                      theme === 'light' ? "border-emerald-500 shadow-sm" : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    <div className="bg-white h-24 rounded-lg flex items-center justify-center text-slate-800 font-bold text-sm shadow-sm border border-gray-100">
                      Light minimalistic
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setTheme('dark')}
                    className={cn(
                      "p-1 rounded-xl border-2 transition-all overflow-hidden",
                      theme === 'dark' ? "border-emerald-500 shadow-sm" : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    <div className="bg-[#0f172a] h-24 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-inner border border-gray-800">
                      Dark expressive
                    </div>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Preview Section - Shows fully when previewMode is true, otherwise hidden visually but kept in DOM for html2pdf */}
      <div className={cn("mt-12", !previewMode && "fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none")}>
        {previewMode && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Report Preview</h3>
            <span className="text-sm text-gray-500">Rendered with selected customizations</span>
          </div>
        )}
        <div className="overflow-x-auto pb-8">
          {/* Actual PDF Content Target */}
          <div 
            id="report-content" 
            className={cn("rounded-none p-10 w-[800px] min-h-[1131px] relative mx-auto", fontStyle)}
            style={{ 
              backgroundColor: theme === 'light' ? '#ffffff' : '#050A15',
              color: theme === 'light' ? fontColor : '#ffffff',
            }}
          >
            {/* Header */}
            <div className="border-b-2 pb-8 mb-10 flex justify-between items-start" style={{ borderColor: accentColor }}>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                    <span className="text-white font-black text-xl">N</span>
                  </div>
                  <h2 className="text-4xl font-black tracking-tight" style={{ color: theme === 'light' ? fontColor : '#ffffff' }}>REPORT</h2>
                </div>
                <p className="mt-2 font-medium tracking-wide opacity-70">Project: {data?.project_name || activeProject?.name || 'All Data'}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: accentColor }}>Nope Intelligence</div>
                <div className="text-xs mt-1 font-mono px-3 py-1 rounded-md opacity-80 border" style={{ backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}33` }}>
                  DATE: {new Date(data?.generated_at || Date.now()).toLocaleDateString('vi-VN')}
                </div>
              </div>
            </div>

            {/* Content Blocks */}
            <div className="space-y-10">
              {sections.filter(s => s.enabled).map(section => (
                <div key={section.id}>
                  {section.id === 'summary' && (
                    <div>
                      <h3 className="text-lg font-bold uppercase tracking-widest mb-4 opacity-50 border-b pb-2" style={{ borderColor: `${accentColor}33` }}>Summary</h3>
                      <div className="grid grid-cols-2 gap-8">
                        <div className="rounded-2xl p-6 border shadow-sm relative overflow-hidden" style={{ borderColor: `${accentColor}33`, backgroundColor: theme === 'light' ? '#f8fafc' : '#0f172a' }}>
                          <div className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">Total Mentions</div>
                          <div className="text-5xl font-black tracking-tight" style={{ color: accentColor }}>{data?.metrics?.total_mentions?.toLocaleString() || 0}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {section.id === 'sentiment' && (
                    <div>
                      <h3 className="text-lg font-bold uppercase tracking-widest mb-4 opacity-50 border-b pb-2" style={{ borderColor: `${accentColor}33` }}>Sentiment</h3>
                      <div className="grid grid-cols-1 gap-8">
                        <div className="rounded-2xl p-6 border shadow-sm" style={{ borderColor: `${accentColor}33`, backgroundColor: theme === 'light' ? '#f8fafc' : '#0f172a' }}>
                          <div className="flex gap-12">
                            <div>
                              <div className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">Positive</div>
                              <div className="text-4xl font-black text-emerald-500">{data?.metrics?.sentiment?.positive || 0}</div>
                            </div>
                            <div>
                              <div className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">Negative</div>
                              <div className="text-4xl font-black text-rose-500">{data?.metrics?.sentiment?.negative || 0}</div>
                            </div>
                            <div>
                              <div className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">Neutral</div>
                              <div className="text-4xl font-black text-gray-500">{data?.metrics?.sentiment?.neutral || 0}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {section.id === 'analysis' && (
                    <div>
                      <h3 className="text-lg font-bold uppercase tracking-widest mb-4 opacity-50 border-b pb-2" style={{ borderColor: `${accentColor}33` }}>Analysis & Trends</h3>
                      <div className="rounded-2xl p-6 border shadow-sm" style={{ borderColor: `${accentColor}33`, backgroundColor: theme === 'light' ? '#f8fafc' : '#0f172a' }}>
                        <div className="text-sm font-medium opacity-80 mb-4">Top Sources by Mentions:</div>
                        <div className="space-y-3">
                          {Array.isArray(data?.top_sources) && data.top_sources.slice(0, 5).map((s: any, i: number) => (
                            <div key={i} className="flex justify-between items-center">
                              <span className="font-semibold">{s.name}</span>
                              <span className="font-mono text-sm opacity-80">{s.count} mentions</span>
                            </div>
                          ))}
                          {(!data?.top_sources || data.top_sources.length === 0) && (
                            <span className="opacity-50 italic">No sources data available.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {section.id === 'influencers' && (
                    <div>
                      <h3 className="text-lg font-bold uppercase tracking-widest mb-4 opacity-50 border-b pb-2" style={{ borderColor: `${accentColor}33` }}>Influencers</h3>
                      <div className="rounded-2xl p-6 border shadow-sm grid grid-cols-2 gap-4" style={{ borderColor: `${accentColor}33`, backgroundColor: theme === 'light' ? '#f8fafc' : '#0f172a' }}>
                        {Array.isArray(data?.top_influencers) && data.top_influencers.slice(0, 6).map((inf: any, i: number) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center opacity-50">
                              {inf.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-sm">{inf.name}</div>
                              <div className="text-xs opacity-60">{inf.count} mentions</div>
                            </div>
                          </div>
                        ))}
                        {(!data?.top_influencers || data.top_influencers.length === 0) && (
                          <span className="opacity-50 italic col-span-2">No influencer data available.</span>
                        )}
                      </div>
                    </div>
                  )}

                  {section.id === 'mentions' && (
                    <div>
                      <h3 className="text-lg font-bold uppercase tracking-widest mb-4 opacity-50 border-b pb-2" style={{ borderColor: `${accentColor}33` }}>Selected Mentions</h3>
                      <div className="space-y-4">
                        {data?.selected_mentions && data.selected_mentions.length > 0 ? (
                          data.selected_mentions.map((m: any, i: number) => (
                            <div key={i} className="p-4 rounded-xl border shadow-sm" style={{ borderColor: `${accentColor}22`, backgroundColor: theme === 'light' ? '#f8fafc' : '#0f172a' }}>
                              <h4 className="font-bold text-sm mb-1">{m.title || 'Untitled'}</h4>
                              <p className="text-xs opacity-70 mb-2">{m.domain || 'unknown'} • {new Date(m.published_at || Date.now()).toLocaleDateString()}</p>
                              <p className="text-xs opacity-80 leading-relaxed line-clamp-3">{m.snippet || m.content?.substring(0, 200)}</p>
                            </div>
                          ))
                        ) : (
                          <div className="p-6 text-center rounded-xl border opacity-50" style={{ borderColor: `${accentColor}33` }}>
                            <p className="text-sm">No mentions selected for report.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {section.id === 'alerts' && (
                    <div>
                      <h3 className="text-lg font-bold uppercase tracking-widest mb-4 opacity-50 border-b pb-2" style={{ borderColor: `${accentColor}33` }}>Alerts</h3>
                      <div className="rounded-2xl p-6 border shadow-sm" style={{ borderColor: `${accentColor}33`, backgroundColor: theme === 'light' ? '#f8fafc' : '#0f172a' }}>
                        <div className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">Total Alerts</div>
                        <div className="text-5xl font-black tracking-tight" style={{ color: accentColor }}>{data?.metrics?.total_alerts?.toLocaleString() || 0}</div>
                      </div>
                    </div>
                  )}
                  
                  {section.id === 'incidents' && (
                    <div>
                      <h3 className="text-lg font-bold uppercase tracking-widest mb-4 opacity-50 border-b pb-2" style={{ borderColor: `${accentColor}33` }}>Incidents</h3>
                      <div className="rounded-2xl p-6 border shadow-sm" style={{ borderColor: `${accentColor}33`, backgroundColor: theme === 'light' ? '#f8fafc' : '#0f172a' }}>
                        <div className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">Total Incidents</div>
                        <div className="text-5xl font-black tracking-tight" style={{ color: accentColor }}>{data?.metrics?.total_incidents?.toLocaleString() || 0}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-16 pt-6 border-t text-center opacity-50" style={{ borderColor: `${accentColor}33` }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2">Generated by</div>
              <div className="font-black tracking-widest text-sm">NOPE INTELLIGENCE</div>
            </div>

          </div>
        </div>
      </div>

      {/* Export History Section */}
      <div className="bg-white dark:bg-[#1E293B] p-6 rounded-xl border border-gray-200 dark:border-gray-800">
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
