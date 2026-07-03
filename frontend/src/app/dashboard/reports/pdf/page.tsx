'use client';
import { useState, useEffect } from 'react';
import { FileText, Download, RefreshCcw, Eye, Settings2, Palette, Layout, Type, Lock } from 'lucide-react';
import { reports as reportsApi } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast from 'react-hot-toast';
import { ReportDataScopeNotice } from '@/components/reports/ReportDataScopeNotice';
import { ExportHistoryTable } from '@/components/reports/ExportHistoryTable';
import { PdfPreviewModal } from './PdfPreviewModal';

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

const DATE_RANGE_OPTIONS = [
  { label: 'Today', value: '1d', days: 1 },
  { label: 'Last 7 days', value: '7d', days: 7 },
  { label: 'Last 30 days', value: '30d', days: 30 },
  { label: 'Last 90 days', value: '90d', days: 90 },
  { label: 'All time', value: 'all', days: null },
];

const AVAILABLE_SECTIONS = [
  { id: 'summary', title: 'Summary', desc: 'Title page with basic info' },
  { id: 'overview', title: 'Overview', desc: 'KPIs and high-level metrics' },
  { id: 'executive_summary', title: 'Executive Summary', desc: 'AI-generated summary text' },
  { id: 'analysis', title: 'Analysis', desc: 'Sentiment breakdown and volume trend' },
  { id: 'ai_visibility', title: 'AI Visibility', desc: 'Brand visibility in AI models', disabled: true, reason: 'AI visibility score not supported by current data model.' },
  { id: 'demographics', title: 'Demographics', desc: 'Audience age and gender', disabled: true, reason: 'Demographics parsing not fully implemented in current pipeline.' },
  { id: 'project_comparison', title: 'Project Comparison', desc: 'Compare with other projects', disabled: true, reason: 'Only single-project reporting supported currently.' },
  { id: 'period_comparison', title: 'Period Comparison', desc: 'Compare with previous period' },
  { id: 'influencers_sources', title: 'Influencers & Sources', desc: 'Top authors and platforms' },
  { id: 'active_sites', title: 'Active Sites', desc: 'Most active domains', disabled: true, reason: 'Included inside Sources section.' },
  { id: 'influential_sites', title: 'Most Influential Sites', desc: 'Sites by influence score', disabled: true, reason: 'Influence scores per site not currently tracked.' },
  { id: 'mention_tags', title: 'Mention Tags', desc: 'Distribution of applied tags', disabled: true, reason: 'Mention tags not natively supported in reports endpoint.' },
  { id: 'top_mentions', title: 'Top Mentions', desc: 'Most impactful mentions by reach' },
  { id: 'recent_mentions', title: 'Recent Mentions', desc: 'Latest mentions chronologically' },
  { id: 'sentiment', title: 'Sentiment', desc: 'Detailed sentiment analysis', disabled: true, reason: 'Included inside Analysis section in this version.' },
  { id: 'mentions_reach', title: 'Mentions & Reach', desc: 'Volume and reach over time', disabled: true, reason: 'Included inside Analysis section in this version.' },
  { id: 'categories', title: 'Categories / Sources', desc: 'Top domains and tags', disabled: true, reason: 'Included inside Influencers & Sources section.' },
  { id: 'trending_hashtags', title: 'Trending Hashtags / Links', desc: 'Most common hashtags', disabled: true, reason: 'Hashtag extraction not fully supported by current data model.' },
  { id: 'emojis', title: 'Emojis / Discussion Context', desc: 'Frequently used emojis', disabled: true, reason: 'Emoji extraction not supported by current data model.' }
];

export default function PdfReportPage() {
  const { activeProject } = useProject();
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [exportHistory, setExportHistory] = useState<any[]>([]);
  const [exportHistoryLoading, setExportHistoryLoading] = useState(true);
  
  // Customization State
  const [sections, setSections] = useState(AVAILABLE_SECTIONS.map(s => ({ ...s, enabled: !s.disabled })));
  const [theme, setTheme] = useState('light');
  const [accentColor, setAccentColor] = useState('#3b82f6');
  const [fontColor, setFontColor] = useState('#1e293b');
  const [fontFamily, setFontFamily] = useState('Helvetica');
  const [aspectRatio, setAspectRatio] = useState('vertical');
  const [language, setLanguage] = useState('english');
  
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchExports();
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
      const res = await reportsApi.listExports(1, 10, 'pdf');
      setExportHistory(res.items || []);
    } catch (e) {}
    finally { setExportHistoryLoading(false); }
  };

  const getParams = () => {
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
    return params;
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const params = getParams();
      
      const config = {
        date_from: params.date_from,
        date_to: params.date_to,
        sections: sections.filter(s => s.enabled).map(s => ({ id: s.id, enabled: true })),
        theme,
        accent_color: accentColor,
        font_color: fontColor,
        font_style: fontFamily,
        aspect_ratio: aspectRatio,
        language
      };

      await reportsApi.requestExport('pdf', activeProject?.id, config);
      toast.success('PDF report requested! Check the history below.');
      fetchExports();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Error requesting export');
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    try {
      setPreviewLoading(true);
      setPreviewOpen(true);
      const params = getParams();
      const res = await reportsApi.summaryData(params);
      setPreviewData(res);
    } catch (error) {
      toast.error('Failed to load preview data');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
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

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id && !s.disabled ? { ...s, enabled: !s.enabled } : s));
  };

  return (
    <div className="max-w-7xl mx-auto py-10 space-y-6">
      <ReportDataScopeNotice
        projectName={activeProject?.name}
        dateRange={dateRange}
        dateRangeLabel={DATE_RANGE_OPTIONS.find(r => r.value === dateRange)?.label}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Main Content Area: Sections List */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Report Content</h2>
                <p className="text-gray-500 mt-1">Select the sections to include in your PDF.</p>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
                <FileText className="w-6 h-6 text-indigo-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map((section) => (
                <div key={section.id} className={cn("flex flex-col p-4 rounded-xl border", section.disabled ? "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-[#0f172a]")}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-white">{section.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{section.desc}</p>
                    </div>
                    {!section.disabled && (
                      <label className="relative inline-flex items-center cursor-pointer mt-1">
                        <input type="checkbox" className="sr-only peer" checked={section.enabled} onChange={() => toggleSection(section.id)} />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-500"></div>
                      </label>
                    )}
                  </div>
                  {section.disabled && (
                    <div className="mt-3 text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 p-2 rounded">
                      Unavailable: {section.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar: Customization & Actions */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-gray-400" /> Customization
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-slate-900 dark:text-gray-300 flex items-center gap-2 mb-2">
                  <Layout className="w-4 h-4 text-gray-400" /> Theme
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setTheme('light')} className={cn("p-2 rounded-lg border text-sm font-medium transition-all", theme === 'light' ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400")}>Light</button>
                  <button onClick={() => setTheme('dark')} className={cn("p-2 rounded-lg border text-sm font-medium transition-all bg-slate-900", theme === 'dark' ? "border-indigo-500 shadow-md text-white" : "border-gray-700 text-gray-400")}>Dark</button>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-900 dark:text-gray-300 flex items-center gap-2 mb-2">
                  <Palette className="w-4 h-4 text-gray-400" /> Accent Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6'].map(c => (
                    <button key={c} onClick={() => setAccentColor(c)} className={cn("w-6 h-6 rounded-full border-2 transition-transform", accentColor === c ? "scale-110 border-white shadow-md ring-2 ring-gray-400 dark:ring-gray-500" : "border-transparent")} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-semibold text-slate-900 dark:text-gray-300 flex items-center gap-2 mb-2">
                  <Type className="w-4 h-4 text-gray-400" /> Font Family
                </label>
                <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="Helvetica">Helvetica (Default)</option>
                  <option value="Times-Roman">Times New Roman</option>
                  <option value="Courier">Courier</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-900 dark:text-gray-300 mb-2 block">Font Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={fontColor} onChange={e => setFontColor(e.target.value)} className="w-10 h-10 rounded border-0 cursor-pointer bg-transparent p-0" />
                  <span className="text-sm font-mono">{fontColor}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-900 dark:text-gray-300 mb-2 block">Aspect Ratio</label>
                <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="vertical">Vertical (A4 Portrait)</option>
                  <option value="horizontal">Horizontal (Landscape)</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-900 dark:text-gray-300 mb-2 block">Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="english">English</option>
                  <option value="vietnamese" disabled>Vietnamese (Not translated in PDF yet)</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-semibold text-slate-900 dark:text-gray-300 mb-2 block">Report Logo</label>
                <div className="w-full flex flex-col items-center justify-center gap-2 bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-4 text-sm opacity-70">
                  <Lock className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-500 dark:text-gray-400 text-center text-xs px-2">Logo upload is disabled until report asset storage is implemented.</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-900 dark:text-gray-300 mb-2 block">Time Range</label>
                <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  {DATE_RANGE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col gap-3">
            <button onClick={loadPreview} className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-800 dark:text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
              <Eye className="w-5 h-5" /> Live Preview
            </button>
            <button onClick={handleGenerate} disabled={loading} className="w-full py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50">
              {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {loading ? 'Generating...' : 'Generate PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1E293B] p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Recent Exports</h3>
        <ExportHistoryTable exports={exportHistory} loading={exportHistoryLoading} onDownload={downloadFile} />
      </div>

      <PdfPreviewModal 
        isOpen={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        data={previewData} 
        loading={previewLoading}
        config={{ sections, theme, accentColor, fontColor, fontFamily, aspectRatio, language }}
      />
    </div>
  );
}

