'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search, Eye, Trash2, FileText, X, ExternalLink,
  ArrowUpDown, ChevronDown, ChevronUp, Filter, BarChart3,
  Globe, Rss, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, BrainCircuit, Loader2,
  Facebook, Youtube, RefreshCw, SlidersHorizontal, Sparkles,
  Twitter, Instagram, Mic, Video, Link2Off, Tag,
  SearchCode, Download, CheckSquare, Square, Calendar,
  Scan, ChevronLeft, ChevronRight, Info
} from 'lucide-react';
import { mentions as mentionsApi, dashboard, keywords as keywordsApi, crawl, savedFilters } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════════════════════════════════════ */

interface MentionItem {
  id: number;
  source_id: number;
  source_name: string;
  source_type: string;
  title: string | null;
  content: string;
  url: string;
  author: string | null;
  published_at: string | null;
  collected_at: string | null;
  is_reviewed: boolean;
  is_muted: boolean;
  add_to_report: boolean;
  matched_keywords: any[] | null;
  snippet: string | null;
  sentiment: string | null;
  domain: string | null;
  influence_score: number | null;
  tags_json: string[] | null;
  ai_analysis: {
    sentiment: string | null;
    risk_score: number | null;
    crisis_level: number | null;
    summary_vi: string | null;
    suggested_action: string | null;
    ai_provider: string | null;
    vietnamese_context_label: string | null;
    tone: string | null;
    sarcasm_possible: boolean | null;
    complaint_type: string | null;
    sensitive_signal: boolean | null;
  } | null;
  metadata: {
    source_type?: string;
    discovery_job_id?: number;
    [key: string]: any;
  } | null;
}

interface Filters {
  sentiment: string | null;
  source_type: string | null;
  min_risk_score: number | null;
  min_influence_score: number | null;
  add_to_report?: boolean | null;
  sort_by: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const SENTIMENT_OPTIONS = [
  { value: 'positive', label: 'Tích cực', dot: 'bg-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
  { value: 'neutral', label: 'Trung lập', dot: 'bg-gray-400', bg: 'bg-gray-500/10 border-gray-500/20 text-gray-400' },
  { value: 'negative_low', label: 'Tiêu cực nhẹ', dot: 'bg-amber-500', bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
  { value: 'negative_medium', label: 'Tiêu cực', dot: 'bg-orange-500', bg: 'bg-orange-500/10 border-orange-500/20 text-orange-400' },
  { value: 'negative_high', label: 'Nghiêm trọng', dot: 'bg-rose-500 animate-pulse', bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400' },
];

const SOURCE_TYPE_OPTIONS = [
  { value: 'web', label: 'Web', icon: Globe, color: 'text-blue-400', disabled: false },
  { value: 'news', label: 'News', icon: FileText, color: 'text-gray-400', disabled: false },
  { value: 'blog', label: 'Blogs', icon: FileText, color: 'text-green-400', disabled: false },
  { value: 'video', label: 'Videos (YouTube)', icon: Youtube, color: 'text-red-400', disabled: false },
  { value: 'rss', label: 'RSS', icon: Rss, color: 'text-orange-400', disabled: false },
  { value: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-500', disabled: true, msg: 'Connect required' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-fuchsia-500', disabled: true, msg: 'Connect required' },
  { value: 'twitter', label: 'X/Twitter', icon: Twitter, color: 'text-sky-400', disabled: false },
  { value: 'reddit', label: 'Reddit', icon: Globe, color: 'text-orange-400', disabled: false },
  { value: 'tiktok', label: 'TikTok', icon: Video, color: 'text-pink-400', disabled: true, msg: 'Connector required' },
  { value: 'podcast', label: 'Podcasts', icon: Mic, color: 'text-purple-400', disabled: true, msg: 'Coming soon' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'risk_high', label: 'Risk cao → thấp' },
  { value: 'risk_low', label: 'Risk thấp → cao' },
  { value: 'influence_high', label: 'Ảnh hưởng cao' },
  { value: 'engagement_high', label: 'Tương tác cao' },
];

const RISK_PRESETS = [
  { value: null, label: 'Tất cả' },
  { value: 40, label: '≥ 40' },
  { value: 60, label: '≥ 60' },
  { value: 80, label: '≥ 80' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function SourceIcon({ type, className }: { type: string; className?: string }) {
  const baseClass = className || 'w-4 h-4';
  switch (type?.toLowerCase()) {
    case 'facebook':
    case 'facebook_page':
    case 'facebook_group':
      return <Facebook className={baseClass} />;
    case 'instagram':
      return <Instagram className={baseClass} />;
    case 'twitter':
      return <Twitter className={baseClass} />;
    case 'tiktok':
    case 'video':
    case 'youtube':
      return <Youtube className={baseClass} />;
    case 'rss':
      return <Rss className={baseClass} />;
    case 'news':
    case 'blog':
      return <FileText className={baseClass} />;
    default:
      return <Globe className={baseClass} />;
  }
}

function SentimentDot({ sentiment }: { sentiment: string | null }) {
  const opt = SENTIMENT_OPTIONS.find((s) => s.value === sentiment);
  if (!opt) return <span className="w-2 h-2 rounded-full bg-gray-600 inline-block" />;
  return <span className={`w-2 h-2 rounded-full ${opt.dot} inline-block`} />;
}

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return d.toLocaleDateString('vi-VN');
}

function highlightKeywords(text: string, keywords: any[] | null) {
  if (!keywords || keywords.length === 0 || !text) return text;
  const kwStrings = keywords
    .map((k: any) => (typeof k === 'string' ? k : k.keyword))
    .filter(Boolean);
  if (kwStrings.length === 0) return text;
  const escaped = kwStrings.map((s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = `(${escaped.join('|')})`;
  const splitRegex = new RegExp(pattern, 'gi');
  const parts = text.split(splitRegex);
  return parts.map((part, i) => {
    // Use a fresh regex per test to avoid lastIndex statefulness
    const testRegex = new RegExp(pattern, 'i');
    return testRegex.test(part) ? (
      <mark key={i} className="bg-indigo-500/20 text-indigo-300 rounded px-0.5">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5 font-medium">{part}</mark>
      : part
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function MentionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialJobId = searchParams?.get('job_id');
  const initialSearch = searchParams?.get('q') || searchParams?.get('keyword');

  // Data
  const [mentionsList, setMentionsList] = useState<MentionItem[]>([]);
  const [totalMentions, setTotalMentions] = useState<number>(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sentimentSummary, setSentimentSummary] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const { activeProject, fetchProjects } = useProject();
  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(initialSearch || '');
  const [searchInput, setSearchInput] = useState(initialSearch || '');
  const [filters, setFilters] = useState<Filters>({
    sentiment: null,
    source_type: null,
    min_risk_score: null,
    min_influence_score: null,
    sort_by: 'newest',
  });
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false);
  const [savedFiltersList, setSavedFiltersList] = useState<any[]>([]);
  const [saveFilterModalOpen, setSaveFilterModalOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [saveFilterOverwrite, setSaveFilterOverwrite] = useState(false);
  const [dateRange, setDateRange] = useState('7d');
  const [summarizeDrawerOpen, setSummarizeDrawerOpen] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; mentionId: number | null; mentionTitle: string }>({
    isOpen: false,
    mentionId: null,
    mentionTitle: '',
  });
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const savedFiltersRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
      if (savedFiltersRef.current && !savedFiltersRef.current.contains(e.target as Node)) {
        setSavedFiltersOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch saved filters
  useEffect(() => {
    if (activeProject) {
      fetchSavedFilters();
    }
  }, [activeProject]);

  const fetchSavedFilters = async () => {
    try {
      const data = await savedFilters.list(activeProject?.id);
      setSavedFiltersList(data.items || []);
    } catch (error) {
      console.error('Error fetching saved filters:', error);
    }
  };

  const handleSaveFilter = async () => {
    if (!saveFilterName.trim()) {
      toast.error('Vui lòng nhập tên bộ lọc');
      return;
    }

    try {
      const filterJson = {
        ...filters,
        search_term: searchTerm,
      };

      // Check if filter with same name exists
      const existingFilter = savedFiltersList.find((sf: any) => sf.name === saveFilterName.trim());
      
      if (existingFilter && !saveFilterOverwrite) {
        if (!confirm(`Bộ lọc "${saveFilterName}" đã tồn tại. Bạn có muốn ghi đè không?`)) {
          return;
        }
        setSaveFilterOverwrite(true);
      }

      if (existingFilter) {
        await savedFilters.update(existingFilter.id, { name: saveFilterName.trim(), filter_json: filterJson });
        toast.success('Đã cập nhật bộ lọc');
      } else {
        await savedFilters.create({ name: saveFilterName.trim(), filter_json: filterJson }, activeProject?.id);
        toast.success('Đã lưu bộ lọc');
      }

      setSaveFilterModalOpen(false);
      setSaveFilterName('');
      setSaveFilterOverwrite(false);
      fetchSavedFilters();
    } catch (error) {
      toast.error('Lỗi khi lưu bộ lọc');
    }
  };

  const openSaveFilterModal = () => {
    setSaveFilterName('');
    setSaveFilterOverwrite(false);
    setSaveFilterModalOpen(true);
  };

  const handleApplyFilter = async (filterId: number) => {
    try {
      const filter = await savedFilters.get(filterId);
      const filterJson = filter.filter_json;
      
      // Apply filters
      setFilters({
        sentiment: filterJson.sentiment || null,
        source_type: filterJson.source_type || null,
        min_risk_score: filterJson.min_risk_score || null,
        min_influence_score: filterJson.min_influence_score || null,
        sort_by: filterJson.sort_by || 'newest',
      });
      setSearchTerm(filterJson.search_term || '');
      setSearchInput(filterJson.search_term || '');
      
      toast.success('Đã áp dụng bộ lọc');
      setSavedFiltersOpen(false);
    } catch (error) {
      toast.error('Lỗi khi áp dụng bộ lọc');
    }
  };

  const handleDeleteFilter = async (filterId: number) => {
    if (!confirm('Bạn có chắc muốn xóa bộ lọc này?')) return;

    try {
      await savedFilters.delete(filterId);
      toast.success('Đã xóa bộ lọc');
      fetchSavedFilters();
    } catch (error) {
      toast.error('Lỗi khi xóa bộ lọc');
    }
  };

  const handleSummarize = async () => {
    try {
      setSummarizing(true);
      setAiSummary(null);
      
      const payload: any = {
        project_id: activeProject?.id,
      };
      
      // Add filters
      if (filters.sentiment) payload.filters = { ...payload.filters, sentiment: filters.sentiment };
      if (filters.source_type) payload.filters = { ...payload.filters, source_type: filters.source_type };
      if (filters.min_risk_score !== null) payload.filters = { ...payload.filters, min_risk_score: filters.min_risk_score };
      if (filters.min_influence_score !== null) payload.filters = { ...payload.filters, min_influence_score: filters.min_influence_score };
      if (searchTerm) payload.filters = { ...payload.filters, search_query: searchTerm };
      
      // If specific mention IDs are selected (future feature), add them
      // For now, summarize based on current filtered view
      
      const result = await mentionsApi.summarize(payload);
      setAiSummary(result);
      setSummarizeDrawerOpen(true);
      toast.success('Đã tạo tóm tắt AI');
    } catch (error: any) {
      console.error('Error summarizing:', error);
      toast.error(error?.response?.data?.detail || 'Lỗi khi tạo tóm tắt AI. Có thể AI chưa được cấu hình.');
    } finally {
      setSummarizing(false);
    }
  };

  /* ─── DATA FETCHING ─────────────────────────────────────────────────── */

  const fetchMentions = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        page_size: 20,
        sort_by: filters.sort_by,
      };
      if (initialJobId) params.job_id = initialJobId;
      if (searchTerm) {
        params.q = searchTerm;
      }
      if (activeProject) params.project_id = activeProject.id;
      if (filters.sentiment) params.sentiment = filters.sentiment;
      if (filters.source_type) params.source_type = filters.source_type;
      if (filters.min_risk_score !== null) params.min_risk_score = filters.min_risk_score;
      if (filters.min_influence_score !== null) params.min_influence_score = filters.min_influence_score;

      const data = await mentionsApi.list(params);
      setMentionsList(data.items);
      setTotalMentions(data.total);
      setTotalPages(data.total_pages);
    } catch (error: any) {
      console.error('Error fetching mentions:', error);
      toast.error(error.response?.data?.detail || 'Lỗi khi tải mentions');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filters, initialJobId]);

  const fetchChartData = useCallback(async () => {
    try {
      setLoadingChart(true);
      const [sentRes, trendRes] = await Promise.all([
        mentionsApi.summary(activeProject?.id),
        dashboard.trends('7d'),
      ]);
      setSentimentSummary(sentRes);
      setTrendData(trendRes.items || []);
    } catch {
      // Silently fail — charts are secondary
    } finally {
      setLoadingChart(false);
    }
  }, [activeProject]);

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions, activeProject]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData, activeProject]);

  /* ─── PROJECT / SCAN ACTIONS ─────────────────────────────────────────── */

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchTerm(val);
      setPage(1);
      
      const newParams = new URLSearchParams(searchParams?.toString() || '');
      if (val) {
        newParams.set('q', val);
      } else {
        newParams.delete('q');
      }
      router.push(`/dashboard/mentions?${newParams.toString()}`);
    }, 400);
  };


  /* ─── FILTER ACTIONS ────────────────────────────────────────────────── */

  const updateFilter = (key: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearAllFilters = () => {
    setFilters({ sentiment: null, source_type: null, min_risk_score: null, min_influence_score: null, sort_by: 'newest' });
    setSearchTerm('');
    setSearchInput('');
    setPage(1);
  };

  const hasActiveFilters = filters.sentiment || filters.source_type || filters.min_risk_score !== null || searchTerm;

  const activeFilterCount = [filters.sentiment, filters.source_type, filters.min_risk_score, searchTerm].filter(Boolean).length;

  /* ─── MENTION ACTIONS ───────────────────────────────────────────────── */

  const handleDelete = async () => {
    if (!deleteConfirm.mentionId) return;
    try {
      await mentionsApi.delete(deleteConfirm.mentionId);
      toast.success('Xóa mention thành công!');
      fetchMentions();
    } catch (error: any) {
      toast.error('Lỗi khi xóa mention');
    }
  };

  const handleAction = async (mentionId: number, action: string, apiCall: () => Promise<any>, successMsg: string) => {
    setActionLoading((prev) => ({ ...prev, [`${mentionId}_${action}`]: true }));
    try {
      await apiCall();
      toast.success(successMsg);
      fetchMentions();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Có lỗi xảy ra');
    } finally {
      setActionLoading((prev) => ({ ...prev, [`${mentionId}_${action}`]: false }));
    }
  };

  const handleToggleAddToReport = async (mentionId: number, currentStatus: boolean) => {
    setActionLoading((prev) => ({ ...prev, [`${mentionId}_add_to_report`]: true }));
    try {
      await mentionsApi.addToReport(mentionId, !currentStatus);
      toast.success(!currentStatus ? 'Đã thêm vào báo cáo' : 'Đã xóa khỏi báo cáo');
      fetchMentions();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Có lỗi xảy ra');
    } finally {
      setActionLoading((prev) => ({ ...prev, [`${mentionId}_add_to_report`]: false }));
    }
  };

  const handleExportCsv = async () => {
    try {
      const params: Record<string, unknown> = {};
      if (activeProject) params.project_id = activeProject.id;
      if (filters.sentiment) params.sentiment = filters.sentiment;
      if (filters.source_type) params.source_type = filters.source_type;
      if (searchTerm) params.keyword = searchTerm;
      const blob = await mentionsApi.exportCsv(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mentions_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Đã xuất CSV');
    } catch {
      toast.error('Lỗi khi xuất CSV');
    }
  };

  /* ─── SENTIMENT SUMMARY STATS ───────────────────────────────────────── */

  const summaryStats = sentimentSummary
    ? [
        { label: 'Tổng mentions', value: sentimentSummary.total || 0, icon: BarChart3, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
        { label: 'Tích cực', value: sentimentSummary.positive || 0, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Tiêu cực', value: sentimentSummary.negative || 0, icon: TrendingDown, color: 'text-rose-400', bg: 'bg-rose-500/10' },
        { label: 'Trung lập', value: sentimentSummary.neutral || 0, icon: Minus, color: 'text-gray-400', bg: 'bg-gray-500/10' },
      ]
    : [];

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-0 -mt-2">
      <Toaster position="top-right" />

      {/* ─── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <FileText className="w-4 h-4 text-white" />
              </div>
              Mentions
            </h1>
            {activeProject && (
              <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs font-medium text-indigo-400">
                {activeProject.name}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 ml-[42px]">
            {loading ? 'Đang tải...' : totalMentions >= 0 ? `${totalMentions.toLocaleString()} kết quả ${searchTerm ? `cho '${searchTerm}'` : ''}` : 'Đang tải...'}
            {hasActiveFilters && ' (đã lọc)'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Range Selector */}
          <div className="inline-flex bg-[#1E293B] border border-gray-700 rounded-lg p-1">
            {['1d', '7d', '30d', '90d'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  dateRange === range
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {range === '1d' ? '1 ngày' : range === '7d' ? '7 ngày' : range === '30d' ? '30 ngày' : '90 ngày'}
              </button>
            ))}
          </div>

          {/* Saved Filters Dropdown */}
          <div className="relative" ref={savedFiltersRef}>
            <button
              onClick={() => setSavedFiltersOpen(!savedFiltersOpen)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-[#1E293B] border border-gray-700 rounded-xl hover:bg-gray-800 hover:text-white transition-all"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Saved Filters
              <ChevronDown className={`w-3 h-3 transition-transform ${savedFiltersOpen ? 'rotate-180' : ''}`} />
            </button>
            {savedFiltersOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-[#1E293B] border border-gray-700 rounded-xl shadow-2xl z-20 py-1 animate-fadeIn">
                <button
                  onClick={openSaveFilterModal}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-indigo-400 hover:bg-[#111827] transition-colors border-b border-gray-800"
                >
                  + Save Current Filter
                </button>
                {savedFiltersList.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-gray-500 text-center">No saved filters</div>
                ) : (
                  savedFiltersList.map((sf: any) => (
                    <div key={sf.id} className="flex items-center justify-between px-4 py-2 hover:bg-[#111827] group">
                      <button
                        onClick={() => handleApplyFilter(sf.id)}
                        className="flex-1 text-left text-xs font-medium text-gray-300 hover:text-white transition-colors"
                      >
                        {sf.name}
                      </button>
                      <button
                        onClick={() => handleDeleteFilter(sf.id)}
                        className="p-1 text-gray-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Summarize with AI Button */}
          <button
            onClick={handleSummarize}
            disabled={summarizing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/20 hover:text-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI Summary
          </button>

          {/* Scan Now Button */}
          <Link
            href="/dashboard/scan"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/20 hover:text-emerald-200 transition-all"
          >
            <Scan className="w-4 h-4" />
            Scan Now
          </Link>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-[#1E293B] border border-gray-700 rounded-xl hover:bg-gray-800 hover:text-white transition-all"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          {/* Refresh */}
          <button
            onClick={() => { fetchMentions(); fetchChartData(); }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-[#1E293B] border border-gray-700 rounded-xl hover:bg-gray-800 hover:text-white transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ─── TOOLBAR ─────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input
            id="mentions-search"
            type="text"
            placeholder="Tìm kiếm mentions..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-12 pr-12 py-3 bg-[#111827] border border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-white placeholder-gray-500 shadow-sm transition-all text-sm"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                setSearchTerm('');
                setPage(1);
                const newParams = new URLSearchParams(searchParams?.toString() || '');
                newParams.delete('q');
                router.push(`/dashboard/mentions?${newParams.toString()}`);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="inline-flex items-center gap-2 px-4 py-3 bg-[#111827] border border-gray-800 rounded-xl hover:border-gray-700 transition-all text-sm font-medium text-gray-300 hover:text-white"
          >
            <ArrowUpDown className="w-4 h-4" />
            {SORT_OPTIONS.find((o) => o.value === filters.sort_by)?.label || 'Sort'}
            <ChevronDown className={`w-3 h-3 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-[#111827] border border-gray-800 rounded-xl shadow-2xl z-20 py-1 animate-fadeIn">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setFilters({ ...filters, sort_by: opt.value }); setSortOpen(false); setPage(1); }}
                  className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                    filters.sort_by === opt.value
                      ? 'bg-indigo-600/20 text-indigo-400'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setFilterPanelOpen(!filterPanelOpen)}
          className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
            filterPanelOpen
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-[#111827] border border-gray-800 text-gray-300 hover:border-gray-700 hover:text-white'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
          )}
        </button>
      </div>

      {/* Quick Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => { setFilters({ ...filters, sentiment: null, source_type: null, min_risk_score: null, min_influence_score: null }); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            !hasActiveFilters
              ? 'bg-indigo-600 text-white'
              : 'bg-[#111827] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
          }`}
        >
          All
        </button>
        <button
          onClick={() => { setFilters({ ...filters, sentiment: 'positive' }); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filters.sentiment === 'positive'
              ? 'bg-emerald-600 text-white'
              : 'bg-[#111827] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
          }`}
        >
          Positive
        </button>
        <button
          onClick={() => { setFilters({ ...filters, sentiment: 'negative_medium' }); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filters.sentiment?.includes('negative')
              ? 'bg-rose-600 text-white'
              : 'bg-[#111827] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
          }`}
        >
          Negative
        </button>
        <button
          onClick={() => { setFilters({ ...filters, sentiment: 'neutral' }); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filters.sentiment === 'neutral'
              ? 'bg-gray-600 text-white'
              : 'bg-[#111827] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
          }`}
        >
          Neutral
        </button>
        <button
          onClick={() => { setFilters({ ...filters, min_risk_score: 60 }); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filters.min_risk_score !== null && filters.min_risk_score >= 60
              ? 'bg-amber-600 text-white'
              : 'bg-[#111827] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
          }`}
        >
          Important
        </button>
        <button
          onClick={() => { setFilters({ ...filters, add_to_report: true }); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filters.add_to_report
              ? 'bg-indigo-600 text-white'
              : 'bg-[#111827] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
          }`}
        >
          Added to Report
        </button>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <>
            <div className="w-px h-6 bg-gray-800 mx-2" />
            {filters.sentiment && (
              <button
                onClick={() => { setFilters({ ...filters, sentiment: null }); setPage(1); }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-xs font-medium text-indigo-400 hover:bg-indigo-500/20"
              >
                {SENTIMENT_OPTIONS.find((o) => o.value === filters.sentiment)?.label || filters.sentiment}
                <X className="w-3 h-3" />
              </button>
            )}
            {filters.source_type && (
              <button
                onClick={() => { setFilters({ ...filters, source_type: null }); setPage(1); }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-xs font-medium text-indigo-400 hover:bg-indigo-500/20"
              >
                {SOURCE_TYPE_OPTIONS.find((o) => o.value === filters.source_type)?.label || filters.source_type}
                <X className="w-3 h-3" />
              </button>
            )}
            {filters.min_risk_score !== null && (
              <button
                onClick={() => { setFilters({ ...filters, min_risk_score: null }); setPage(1); }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-xs font-medium text-indigo-400 hover:bg-indigo-500/20"
              >
                Risk ≥ {filters.min_risk_score}
                <X className="w-3 h-3" />
              </button>
            )}
            {searchTerm && (
              <button
                onClick={() => { setSearchInput(''); setSearchTerm(''); setPage(1); }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-xs font-medium text-indigo-400 hover:bg-indigo-500/20"
              >
                Search: {searchTerm}
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => { setFilters({ sentiment: null, source_type: null, min_risk_score: null, min_influence_score: null, sort_by: 'newest' }); setSearchInput(''); setSearchTerm(''); setPage(1); }}
              className="px-2 py-1 text-xs font-medium text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
            >
              Clear All
            </button>
          </>
        )}
      </div>

      {/* ─── SUMMARY CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total</span>
            <BarChart3 className="w-4 h-4 text-gray-600" />
          </div>
          <div className="text-2xl font-bold text-white">{totalMentions.toLocaleString()}</div>
        </div>
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Positive</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{sentimentSummary?.positive || 0}</div>
        </div>
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Negative</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-400">{sentimentSummary?.negative || 0}</div>
        </div>
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Neutral</span>
            <Minus className="w-4 h-4 text-gray-500" />
          </div>
          <div className="text-2xl font-bold text-gray-400">{sentimentSummary?.neutral || 0}</div>
        </div>
      </div>

      {/* ─── MAIN LAYOUT ─────────────────────────────────────────────────── */}
      <div className="flex gap-6">
        {/* Mentions List */}
        <div className="flex-1 min-w-0">
          {loading && mentionsList.length === 0 ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-[#111827] border border-gray-800 rounded-xl p-4 animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="w-5 h-5 bg-gray-800 rounded mt-1" />
                    <div className="w-10 h-10 rounded-lg bg-gray-800" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 bg-gray-800 rounded w-3/4" />
                      <div className="h-3 bg-gray-800 rounded w-1/4" />
                      <div className="h-16 bg-gray-800 rounded w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : mentionsList.length === 0 ? (
            <div className="bg-[#111827] border border-gray-800 rounded-xl p-12 text-center">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              {searchTerm ? (
                <>
                  <p className="text-gray-400 font-medium">Không tìm thấy mentions nào cho '{searchTerm}'</p>
                  <p className="text-gray-500 text-sm mt-2">Thử thay đổi từ khóa hoặc mở rộng bộ lọc.</p>
                </>
              ) : (
                <>
                  <p className="text-gray-400 font-medium">Không tìm thấy mentions nào</p>
                  <p className="text-gray-500 text-sm mt-2">Thử thay đổi bộ lọc hoặc chạy quét mới</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {mentionsList.map((mention) => (
                <div
                  key={mention.id}
                  className={`bg-[#111827] border rounded-xl p-4 hover:border-gray-700 transition-all group ${
                    mention.add_to_report ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox for add_to_report */}
                    <button
                      onClick={() => handleToggleAddToReport(mention.id, mention.add_to_report)}
                      disabled={!!actionLoading[`${mention.id}_add_to_report`]}
                      className="flex-shrink-0 mt-1"
                    >
                      {actionLoading[`${mention.id}_add_to_report`] ? (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                      ) : mention.add_to_report ? (
                        <CheckSquare className="w-5 h-5 text-indigo-400" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-600 hover:text-gray-400" />
                      )}
                    </button>

                    {/* Source Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-[#1E293B] border border-gray-700 flex items-center justify-center">
                        <SourceIcon type={mention.source_type} className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1">
                            {highlightText(mention.title || 'Không có tiêu đề', searchTerm)}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="text-gray-400">{mention.domain || mention.source_name || 'unknown'}</span>
                            <span>•</span>
                            <span>{formatRelativeTime(mention.published_at || mention.collected_at)}</span>
                          </div>
                        </div>
                        {/* Sentiment Badge */}
                        {mention.sentiment && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                            mention.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            mention.sentiment?.includes('negative') ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                          }`}>
                            {mention.sentiment.replace('_', ' ')}
                          </span>
                        )}
                      </div>

                      {/* Snippet with keyword highlight */}
                      <p className="text-sm text-gray-300 line-clamp-3 mb-3">
                        {searchTerm ? highlightText(mention.snippet || mention.content, searchTerm) : highlightKeywords(mention.snippet || mention.content, mention.matched_keywords)}
                      </p>

                      {/* Meta Row */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-3">
                        {mention.ai_analysis && mention.ai_analysis.risk_score !== null && (
                          <span className={`px-2 py-0.5 rounded ${
                            mention.ai_analysis.risk_score >= 60 ? 'bg-amber-500/10 text-amber-400' : 'bg-gray-500/10 text-gray-400'
                          }`}>
                            Risk: {mention.ai_analysis.risk_score}
                          </span>
                        )}
                        {mention.influence_score !== null && (
                          <span className="px-2 py-0.5 bg-gray-500/10 text-gray-400 rounded">
                            Influence: {mention.influence_score}
                          </span>
                        )}
                        {mention.matched_keywords && mention.matched_keywords.length > 0 && (
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded">
                            {mention.matched_keywords.length} keywords
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                        <a
                          href={mention.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Visit
                        </a>
                        <button
                          onClick={() => handleToggleAddToReport(mention.id, mention.add_to_report)}
                          disabled={!!actionLoading[`${mention.id}_add_to_report`]}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            mention.add_to_report
                              ? 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20'
                              : 'text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white'
                          } disabled:opacity-50`}
                        >
                          {actionLoading[`${mention.id}_add_to_report`] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : mention.add_to_report ? (
                            <CheckSquare className="w-3.5 h-3.5" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                          {mention.add_to_report ? 'In Report' : 'Add to Report'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ isOpen: true, mentionId: mention.id, mentionTitle: mention.title || 'N/A' })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed bg-[#111827] border border-gray-800 rounded-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-400">
                Trang {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed bg-[#111827] border border-gray-800 rounded-lg"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Sticky Filter Panel */}
        {filterPanelOpen && (
          <div className="w-80 flex-shrink-0">
            <div className="sticky top-4 bg-[#111827] border border-gray-800 rounded-xl p-5 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-white text-base flex items-center gap-2">
                  <Filter className="w-4 h-4 text-indigo-400" />
                  Filters
                </h3>
                <button
                  onClick={() => setFilterPanelOpen(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sentiment Section */}
              <div className="mb-6 pb-6 border-b border-gray-800">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Sentiment
                </label>
                <div className="space-y-2">
                  {SENTIMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFilters({ ...filters, sentiment: filters.sentiment === opt.value ? null : opt.value })}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        filters.sentiment === opt.value
                          ? 'bg-indigo-500/15 text-white border border-indigo-500/30'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E293B] border border-transparent'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source Type Section */}
              <div className="mb-6 pb-6 border-b border-gray-800">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Source Type
                </label>
                <div className="space-y-2">
                  {SOURCE_TYPE_OPTIONS.filter((o) => !o.disabled).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFilters({ ...filters, source_type: filters.source_type === opt.value ? null : opt.value })}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        filters.source_type === opt.value
                          ? 'bg-indigo-500/15 text-white border border-indigo-500/30'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E293B] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <opt.icon className={`w-4 h-4 flex-shrink-0 ${opt.color}`} />
                        {opt.label}
                      </div>
                      {filters.source_type === opt.value && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk Score Section */}
              <div className="mb-6 pb-6 border-b border-gray-800">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Risk Score
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {RISK_PRESETS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setFilters({ ...filters, min_risk_score: filters.min_risk_score === opt.value ? null : opt.value })}
                      className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-center ${
                        filters.min_risk_score === opt.value
                          ? 'bg-indigo-500/15 text-white border border-indigo-500/30'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E293B] border border-gray-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Influence Score Section */}
              <div className="mb-6">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Influence Score
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: null, label: 'All' },
                    { value: 50, label: '≥ 50' },
                    { value: 70, label: '≥ 70' },
                    { value: 90, label: '≥ 90' },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setFilters({ ...filters, min_influence_score: opt.value })}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-all text-center ${
                        filters.min_influence_score === opt.value
                          ? 'bg-indigo-500/15 text-white border border-indigo-500/30'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E293B] border border-gray-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset Button */}
              <button
                onClick={() => setFilters({ sentiment: null, source_type: null, min_risk_score: null, min_influence_score: null, sort_by: 'newest' })}
                className="w-full px-4 py-3 text-sm font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reset All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── AI SUMMARY DRAWER ─────────────────────────────────────────────── */}
      {summarizeDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSummarizeDrawerOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-[#111827] border-l border-gray-800 shadow-2xl overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  AI Summary
                </h2>
                <button
                  onClick={() => setSummarizeDrawerOpen(false)}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {summarizing ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-gray-500 flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang tạo tóm tắt...
                  </div>
                </div>
              ) : aiSummary ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4 mb-4">
                    <p className="text-sm text-indigo-300">
                      <Info className="w-4 h-4 inline mr-2" />
                      Tóm tắt này được tạo dựa trên {totalMentions} mentions hiện tại với các bộ lọc đã áp dụng.
                    </p>
                  </div>
                  <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {aiSummary.summary || aiSummary.result || JSON.stringify(aiSummary, null, 2)}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <Info className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <p>Không thể tạo tóm tắt</p>
                  <p className="text-sm mt-2">Có thể AI chưa được cấu hình hoặc có lỗi xảy ra.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── SAVE FILTER MODAL ─────────────────────────────────────────────── */}
      {saveFilterModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSaveFilterModalOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-[#111827] border border-gray-800 rounded-xl shadow-2xl w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                    Save Filter
                  </h2>
                  <button
                    onClick={() => setSaveFilterModalOpen(false)}
                    className="text-gray-500 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Filter Name</label>
                    <input
                      type="text"
                      value={saveFilterName}
                      onChange={(e) => setSaveFilterName(e.target.value)}
                      placeholder="Enter filter name..."
                      className="w-full px-4 py-3 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
                      autoFocus
                    />
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-2">Current filters:</p>
                    <div className="flex flex-wrap gap-2">
                      {filters.sentiment && (
                        <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded text-xs">
                          Sentiment: {filters.sentiment}
                        </span>
                      )}
                      {filters.source_type && (
                        <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded text-xs">
                          Source: {filters.source_type}
                        </span>
                      )}
                      {filters.min_risk_score !== null && (
                        <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded text-xs">
                          Risk ≥ {filters.min_risk_score}
                        </span>
                      )}
                      {searchTerm && (
                        <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded text-xs">
                          Search: {searchTerm}
                        </span>
                      )}
                      {!hasActiveFilters && (
                        <span className="text-xs text-gray-500">No active filters</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setSaveFilterModalOpen(false)}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveFilter}
                      disabled={!saveFilterName.trim()}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save Filter
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRM DIALOG ─────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, mentionId: null, mentionTitle: '' })}
        onConfirm={handleDelete}
        title="Xóa Mention"
        message={`Bạn có chắc muốn xóa mention "${deleteConfirm.mentionTitle}"?`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
      />
    </div>
  );
}
