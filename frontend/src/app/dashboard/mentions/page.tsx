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
  Plus, FolderDot, LayoutDashboard, SearchCode
} from 'lucide-react';
import { mentions as mentionsApi, dashboard, keywords as keywordsApi, crawl } from '@/lib/api';
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
  { value: 'twitter', label: 'X/Twitter', icon: Twitter, color: 'text-sky-400', disabled: true, msg: 'Not configured' },
  { value: 'tiktok', label: 'TikTok', icon: Video, color: 'text-pink-400', disabled: true, msg: 'Connector required' },
  { value: 'podcast', label: 'Podcasts', icon: Mic, color: 'text-purple-400', disabled: true, msg: 'Coming soon' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'risk_high', label: 'Risk cao → thấp' },
  { value: 'risk_low', label: 'Risk thấp → cao' },
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

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function MentionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialJobId = searchParams?.get('job_id');
  const initialKeyword = searchParams?.get('keyword');

  // Data
  const [mentionsList, setMentionsList] = useState<MentionItem[]>([]);
  const [totalMentions, setTotalMentions] = useState<number>(-1);
  const [totalPages, setTotalPages] = useState(1);
  const [sentimentSummary, setSentimentSummary] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [keywordGroups, setKeywordGroups] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<any>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(initialKeyword || '');
  const [searchInput, setSearchInput] = useState(initialKeyword || '');
  const [filters, setFilters] = useState<Filters>({
    sentiment: null,
    source_type: null,
    min_risk_score: null,
    min_influence_score: null,
    sort_by: 'newest',
  });
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; mentionId: number | null; mentionTitle: string }>({
    isOpen: false,
    mentionId: null,
    mentionTitle: '',
  });
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
      if (searchTerm) params.search_query = searchTerm;
      if (activeProject) params.keyword = activeProject.name;
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
        dashboard.sentimentSummary('7d'),
        dashboard.trends('7d'),
      ]);
      setSentimentSummary(sentRes);
      setTrendData(trendRes.items || []);
    } catch {
      // Silently fail — charts are secondary
    } finally {
      setLoadingChart(false);
    }
  }, []);

  const fetchKeywordGroups = useCallback(async () => {
    try {
      const groups = await keywordsApi.listGroups();
      setKeywordGroups(groups);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  useEffect(() => {
    fetchKeywordGroups();
  }, [fetchKeywordGroups]);

  /* ─── PROJECT / SCAN ACTIONS ─────────────────────────────────────────── */

  const handleCreateProject = async (keyword: string) => {
    if (!keyword.trim()) return;
    try {
      setIsScanning(true);
      const loadingToast = toast.loading(`Đang tạo project và quét web cho "${keyword}"...`);
      
      // Create Project (KeywordGroup)
      const newGroup = await keywordsApi.createGroup({
        name: keyword.trim(),
        description: 'Tạo từ tìm kiếm Mentions',
      });
      
      // Add Keyword to Group
      await keywordsApi.createKeyword({
        keyword: keyword.trim(),
        group_id: newGroup.id,
        keyword_type: 'general',
      });

      // Trigger Web Scan
      const payload = {
        keyword_group_ids: [newGroup.id],
        mode: 'AUTO_DISCOVERY',
        keywords: [keyword.trim()]
      };
      await crawl.manualScan(payload);

      toast.dismiss(loadingToast);
      toast.success(`Đang quét web cho "${keyword}". Kết quả sẽ sớm xuất hiện!`);
      
      setSearchInput('');
      setSearchTerm('');
      setActiveProject(newGroup);
      fetchKeywordGroups();
    } catch (error: any) {
      toast.error('Lỗi khi tạo project: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsScanning(false);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    // Don't auto-search if we're typing to create a project
  };

  const executeSearch = () => {
    setSearchTerm(searchInput);
    setPage(1);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FileText className="w-4 h-4 text-white" />
            </div>
            Mentions
          </h1>
          <p className="text-sm text-gray-500 mt-1.5 ml-[42px]">
            {totalMentions >= 0 ? `${totalMentions.toLocaleString()} kết quả` : 'Đang tải...'}
            {hasActiveFilters && ' (đã lọc)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchMentions(); fetchChartData(); }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-[#1E293B] border border-gray-700 rounded-xl hover:bg-gray-800 hover:text-white transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* ─── SEARCH BAR / CREATE PROJECT ─────────────────────────────────── */}
      <div className="relative mb-5 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input
            id="mentions-search"
            type="text"
            placeholder="Tìm kiếm mentions đang có hoặc nhập từ khóa mới để tìm trên Web..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
            className="w-full pl-12 pr-12 py-3.5 bg-[#111827] border border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-white placeholder-gray-500 shadow-sm transition-all text-sm"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearchTerm(''); setPage(1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => handleCreateProject(searchInput)}
          disabled={!searchInput.trim() || isScanning}
          className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl flex items-center gap-2 transition-all whitespace-nowrap shadow-lg shadow-indigo-900/20"
        >
          {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <SearchCode className="w-5 h-5" />}
          Tìm trên Web
        </button>
      </div>

      {/* ─── ACTIVE FILTER CHIPS ─────────────────────────────────────────── */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mb-5 animate-fadeIn">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mr-1">Bộ lọc:</span>
          {filters.sentiment && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${SENTIMENT_OPTIONS.find((s) => s.value === filters.sentiment)?.bg || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
              <SentimentDot sentiment={filters.sentiment} />
              {SENTIMENT_OPTIONS.find((s) => s.value === filters.sentiment)?.label}
              <button onClick={() => updateFilter('sentiment', null)} className="ml-1 hover:text-white transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.source_type && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-blue-500/10 text-blue-400 border-blue-500/20">
              <SourceIcon type={filters.source_type} className="w-3.5 h-3.5" />
              {SOURCE_TYPE_OPTIONS.find((s) => s.value === filters.source_type)?.label || filters.source_type}
              <button onClick={() => updateFilter('source_type', null)} className="ml-1 hover:text-white transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.min_risk_score !== null && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-orange-500/10 text-orange-400 border-orange-500/20">
              Risk ≥ {filters.min_risk_score}
              <button onClick={() => updateFilter('min_risk_score', null)} className="ml-1 hover:text-white transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {searchTerm && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-purple-500/10 text-purple-400 border-purple-500/20">
              "{searchTerm}"
              <button onClick={() => { setSearchTerm(''); setSearchInput(''); setPage(1); }} className="ml-1 hover:text-white transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={clearAllFilters}
            className="text-xs text-gray-500 hover:text-white transition-colors underline underline-offset-2 ml-2"
          >
            Xóa tất cả
          </button>
        </div>
      )}

      {/* ─── SUMMARY STATS ───────────────────────────────────────────────── */}
      {summaryStats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {summaryStats.map((stat) => (
            <div
              key={stat.label}
              className="bg-[#111827] border border-gray-800 rounded-xl p-4 flex items-center gap-3 hover:border-gray-700 transition-colors group"
            >
              <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-white tabular-nums">{stat.value.toLocaleString()}</p>
                <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider truncate">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── CHART + MINI TREND ──────────────────────────────────────────── */}
      {trendData.length > 0 && (
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Xu hướng 7 ngày
            </h3>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    if (typeof v === 'string' && v.includes('-')) {
                      const parts = v.split('-');
                      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
                    }
                    return v;
                  }}
                />
                <YAxis tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #374151',
                    backgroundColor: '#1E293B',
                    color: '#F3F4F6',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  }}
                />
                <Bar dataKey="total_mentions" name="Mentions" radius={[4, 4, 0, 0]}>
                  {trendData.map((_, i) => (
                    <Cell key={i} fill={i === trendData.length - 1 ? '#818CF8' : '#4F46E5'} />
                  ))}
                </Bar>
                <Bar dataKey="negative_mentions" name="Tiêu cực" fill="#F43F5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT: PROJECTS + FEED + FILTERS ─────────────────────── */}
      <div className="flex gap-5">
        
        {/* ──── LEFT SIDEBAR: PROJECTS (BRAND24 STYLE) ───────────────────── */}
        <aside className="hidden lg:block w-[240px] xl:w-[260px] flex-shrink-0">
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                PROJECTS
              </h3>
              <button 
                onClick={() => { document.getElementById('mentions-search')?.focus(); }}
                className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all"
                title="Tạo Project mới"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-1.5">
              <button
                onClick={() => { setActiveProject(null); setPage(1); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  !activeProject
                    ? 'bg-indigo-500/15 text-white border border-indigo-500/30 shadow-[inset_4px_0_0_rgba(99,102,241,1)]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E293B] border border-transparent'
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 flex-shrink-0 ${!activeProject ? 'text-indigo-400' : 'text-gray-500'}`} />
                <span className="truncate">Tất cả mentions</span>
              </button>

              {keywordGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => { setActiveProject(group); setPage(1); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group-hover ${
                    activeProject?.id === group.id
                      ? 'bg-emerald-500/15 text-white border border-emerald-500/30 shadow-[inset_4px_0_0_rgba(16,185,129,1)]'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E293B] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activeProject?.id === group.id ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-gray-600 group-hover:bg-gray-400'}`} />
                    <span className="truncate" title={group.name}>{group.name}</span>
                  </div>
                  {group.keyword_count > 0 && (
                    <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-md flex-shrink-0">
                      {group.keyword_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ──── MAIN RESULTS FEED ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">


        {/* ──── MOBILE FILTER BUTTON ───────────────────────────────────────── */}
        <button
          onClick={() => setFilterPanelOpen(!filterPanelOpen)}
          className="lg:hidden fixed bottom-6 right-6 z-30 w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full shadow-xl shadow-indigo-500/30 flex items-center justify-center text-white hover:scale-105 transition-transform"
        >
          <Filter className="w-5 h-5" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* ──── MOBILE FILTER PANEL ────────────────────────────────────────── */}
        {filterPanelOpen && (
          <>
            <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setFilterPanelOpen(false)} />
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#111827] border-t border-gray-800 rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                  Bộ lọc
                </h3>
                <button onClick={() => setFilterPanelOpen(false)} className="p-1 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              {/* Sentiment */}
              <h4 className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-2">Cảm xúc</h4>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {SENTIMENT_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => updateFilter('sentiment', filters.sentiment === s.value ? null : s.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      filters.sentiment === s.value
                        ? 'bg-indigo-500/15 text-white border-indigo-500/30'
                        : 'text-gray-400 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} /> {s.label}
                  </button>
                ))}
              </div>

              {/* Platform */}
              <h4 className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-2">Nền tảng</h4>
              <div className="flex flex-col gap-1.5 mb-4">
                {SOURCE_TYPE_OPTIONS.map((st) => (
                  <button
                    key={st.value}
                    disabled={st.disabled}
                    onClick={() => updateFilter('source_type', filters.source_type === st.value ? null : st.value)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      filters.source_type === st.value
                        ? 'bg-indigo-500/15 text-white border-indigo-500/30'
                        : st.disabled
                          ? 'opacity-40 cursor-not-allowed border-transparent bg-transparent grayscale'
                          : 'text-gray-400 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <st.icon className={`w-3.5 h-3.5 ${st.color}`} /> {st.label}
                    </div>
                    {st.disabled && <span className="text-[9px] text-gray-500">{st.msg}</span>}
                  </button>
                ))}
              </div>

              {/* Risk */}
              <h4 className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-2">Risk Score</h4>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {RISK_PRESETS.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => updateFilter('min_risk_score', filters.min_risk_score === r.value ? null : r.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      filters.min_risk_score === r.value
                        ? 'bg-indigo-500/15 text-white border-indigo-500/30'
                        : 'text-gray-400 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-800">
                <button onClick={clearAllFilters} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 bg-[#1E293B] border border-gray-700 rounded-xl hover:bg-gray-800 transition-colors">
                  Reset
                </button>
                <button onClick={() => setFilterPanelOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors">
                  Áp dụng
                </button>
              </div>
            </div>
          </>
        )}


          {/* Sort bar */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500 font-medium">
              {loading ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Đang tải...</span>
              ) : (
                <>Hiển thị {mentionsList.length} / {totalMentions.toLocaleString()} mentions</>
              )}
            </p>
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 bg-[#111827] border border-gray-800 rounded-lg hover:text-white hover:border-gray-700 transition-all"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {SORT_OPTIONS.find((s) => s.value === filters.sort_by)?.label}
                <ChevronDown className={`w-3 h-3 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-[#1E293B] border border-gray-700 rounded-xl shadow-2xl z-20 py-1 animate-fadeIn">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { updateFilter('sort_by', opt.value); setSortOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                        filters.sort_by === opt.value
                          ? 'text-indigo-400 bg-indigo-500/10'
                          : 'text-gray-300 hover:bg-[#111827]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── RESULTS LIST ─────────────────────────────────────────────── */}
          {loading && mentionsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-sm text-gray-500 font-medium">Đang tải dữ liệu...</p>
            </div>
          ) : totalMentions === 0 && !loading ? (
            <div className="bg-[#111827] border border-gray-800 rounded-xl p-10 text-center">
              <div className="w-16 h-16 rounded-xl bg-[#1E293B] flex items-center justify-center mx-auto mb-4 border border-gray-800">
                {hasActiveFilters ? <Search className="w-8 h-8 text-gray-600" /> : <FileText className="w-8 h-8 text-gray-600" />}
              </div>
              <p className="text-gray-300 font-medium mb-2 text-lg">
                {hasActiveFilters ? 'Không tìm thấy mentions nào' : 'Chưa có dữ liệu'}
              </p>
              <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                {hasActiveFilters
                  ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'
                  : initialJobId
                    ? 'Quá trình quét tự động có thể đang diễn ra. Vui lòng thử tải lại sau ít phút hoặc không có mention nào phù hợp được tìm thấy.'
                    : 'Nhập từ khóa và tạo phiên bản quét tại Scan Center để tìm kiếm mentions trên web.'}
              </p>
              {hasActiveFilters ? (
                <button onClick={clearAllFilters} className="mt-6 px-4 py-2 text-sm text-indigo-400 hover:text-white hover:bg-indigo-500 border border-indigo-500/50 rounded-xl font-medium transition-colors">
                  Xóa bộ lọc
                </button>
              ) : !initialJobId && (
                <Link href="/dashboard/scan" className="mt-6 inline-flex px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium transition-colors">
                  Đến Scan Center
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {mentionsList.map((mention, idx) => {
                const sentimentOpt = SENTIMENT_OPTIONS.find((s) => s.value === mention.sentiment) || SENTIMENT_OPTIONS.find((s) => s.value === 'neutral');
                const riskScore = mention.ai_analysis?.risk_score;
                const isCritical = mention.sentiment === 'negative_high' || (riskScore !== null && riskScore !== undefined && riskScore >= 80);
                const isPositive = mention.sentiment === 'positive';
                const isMuted = mention.is_muted;
                
                const glowClass = isMuted
                  ? 'border-gray-800/50 bg-[#111827]/50 opacity-60 grayscale-[50%]'
                  : isCritical 
                    ? 'border-rose-500/40 shadow-[0_0_30px_rgba(225,29,72,0.15)] bg-gradient-to-r from-rose-950/40 to-[#050A15]'
                    : isPositive 
                      ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)] bg-gradient-to-r from-emerald-950/30 to-[#050A15]'
                      : 'border-white/10 hover:border-white/20 bg-white/5 backdrop-blur-xl hover:shadow-[0_0_25px_rgba(255,255,255,0.05)]';

                return (
                  <div
                    key={mention.id}
                    className={`rounded-2xl border overflow-hidden transition-all duration-500 hover:-translate-y-1 group relative ${glowClass}`}
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    {isCritical && !isMuted && <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 shadow-[0_0_15px_rgba(225,29,72,1)]" />}
                    {isPositive && !isMuted && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,1)]" />}

                    <div className="p-5">
                      {/* ── Top Row: Source Info + Badges ───────────────────── */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 bg-[#0B1220] border border-gray-800 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:border-gray-700 transition-colors">
                            <SourceIcon type={mention.source_type || 'web'} className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-indigo-400 tracking-wide truncate">
                                {mention.domain || mention.source_name || 'unknown'}
                              </span>
                              <span className="text-gray-700">·</span>
                              <span className="text-[11px] text-gray-400 flex-shrink-0">{formatRelativeTime(mention.published_at || mention.collected_at)}</span>
                              {mention.author && (
                                <>
                                  <span className="text-gray-700">·</span>
                                  <span className="text-[11px] text-gray-400 truncate">{mention.author}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right badges */}
                        <div className="flex flex-wrap justify-end items-center gap-1.5 flex-shrink-0">
                          {mention.influence_score !== undefined && mention.influence_score !== null && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold tracking-wider rounded-md border bg-indigo-500/10 text-indigo-400 border-indigo-500/20" title="Influence Score">
                              ⭐ {mention.influence_score}/10
                            </span>
                          )}
                          {sentimentOpt && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold tracking-wider rounded-md border ${sentimentOpt.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sentimentOpt.dot}`} />
                              {sentimentOpt.label}
                            </span>
                          )}
                          {isMuted && (
                            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider text-gray-500 bg-gray-800 rounded-md border border-gray-700">
                              <Link2Off className="w-3 h-3 inline mr-1" /> MUTED
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ── Title ───────────────────────────────────────────── */}
                      <h3 className="font-semibold text-white text-[16px] leading-snug mb-2 line-clamp-2 hover:text-indigo-300 transition-colors cursor-pointer" onClick={() => window.open(mention.url, '_blank')}>
                        {mention.title
                          ? highlightKeywords(mention.title, mention.matched_keywords)
                          : <span className="text-gray-500 italic">Không có tiêu đề</span>
                        }
                      </h3>

                      {/* ── Content Preview ─────────────────────────────────── */}
                      <p className="text-sm text-gray-300 leading-relaxed line-clamp-3 mb-3">
                        {mention.snippet
                          ? highlightKeywords(mention.snippet, mention.matched_keywords)
                          : mention.content
                            ? highlightKeywords(mention.content.substring(0, 300), mention.matched_keywords)
                            : ''
                        }
                      </p>

                      {/* ── Meta Row: Tags ────────────────── */}
                      {mention.tags_json && mention.tags_json.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {mention.tags_json.map((tag: string, tidx: number) => (
                            <span key={tidx} className="px-2 py-0.5 text-[10px] font-medium text-gray-300 bg-[#0B1220] rounded-md border border-gray-800">
                              <Tag className="w-2.5 h-2.5 inline mr-1" /> {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* ── Action Bar ──────────────────────────────────────── */}
                      <div className="flex flex-wrap items-center justify-between pt-3 border-t border-gray-800/60 gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {mention.url && (
                            <a
                              href={mention.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Visit
                            </a>
                          )}
                          <button
                            onClick={() => handleAction(mention.id, 'mute', () => mentionsApi.updateMute(mention.id, !isMuted), isMuted ? 'Đã bỏ mute' : 'Đã mute domain')}
                            disabled={!!actionLoading[`${mention.id}_mute`]}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all border ${
                              isMuted 
                                ? 'text-gray-400 border-gray-700 bg-[#1E293B] hover:text-white' 
                                : 'text-gray-400 border-transparent hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20'
                            } disabled:opacity-50`}
                          >
                            {actionLoading[`${mention.id}_mute`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
                            {isMuted ? 'Unmute' : 'Mute site'}
                          </button>
                          
                          <button
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all border border-transparent hover:border-emerald-500/20"
                            title="Add Tags"
                          >
                            <Tag className="w-3.5 h-3.5" />
                            Tags
                          </button>

                          <button
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all border border-transparent hover:border-cyan-500/20"
                            title="Add to Report"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Report
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                           <button
                            onClick={() => setDeleteConfirm({ isOpen: true, mentionId: mention.id, mentionTitle: mention.title || 'Mention' })}
                            className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── PAGINATION ────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6 mb-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-3 py-2 text-xs font-medium border border-gray-800 bg-[#111827] text-gray-400 rounded-lg hover:bg-[#1E293B] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ««
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-xs font-medium border border-gray-800 bg-[#111827] text-gray-400 rounded-lg hover:bg-[#1E293B] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Trước
              </button>
              <span className="px-4 py-2 text-xs font-medium text-gray-400 bg-[#111827] border border-gray-800 rounded-lg">
                <span className="text-white">{page}</span> / <span className="text-white">{totalPages}</span>
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 text-xs font-medium border border-gray-800 bg-[#111827] text-gray-400 rounded-lg hover:bg-[#1E293B] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Sau
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-3 py-2 text-xs font-medium border border-gray-800 bg-[#111827] text-gray-400 rounded-lg hover:bg-[#1E293B] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                »»
              </button>
            </div>
          )}
        </div>

        {/* ──── RIGHT FILTER PANEL (Desktop) ───────────────────────────────── */}
        <aside className="hidden xl:block w-[260px] flex-shrink-0">
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 sticky top-24 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                Bộ lọc
              </h3>
              {hasActiveFilters && (
                <button onClick={clearAllFilters} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium uppercase tracking-wider transition-colors">
                  Reset
                </button>
              )}
            </div>

            {/* Sentiment */}
            <div>
              <h4 className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-2.5">Cảm xúc</h4>
              <div className="space-y-1">
                {SENTIMENT_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => updateFilter('sentiment', filters.sentiment === s.value ? null : s.value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      filters.sentiment === s.value
                        ? 'bg-indigo-500/15 text-white border border-indigo-500/30'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E293B] border border-transparent'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <h4 className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-2.5">Nền tảng</h4>
              <div className="space-y-1">
                {SOURCE_TYPE_OPTIONS.map((st) => (
                  <button
                    key={st.value}
                    disabled={st.disabled}
                    onClick={() => updateFilter('source_type', filters.source_type === st.value ? null : st.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      filters.source_type === st.value
                        ? 'bg-indigo-500/15 text-white border border-indigo-500/30'
                        : st.disabled
                          ? 'opacity-40 cursor-not-allowed bg-transparent border border-transparent grayscale'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E293B] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <st.icon className={`w-3.5 h-3.5 flex-shrink-0 ${st.color}`} />
                      {st.label}
                    </div>
                    {st.disabled && <span className="text-[9px] text-gray-500">{st.msg}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Score */}
            <div>
              <h4 className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-2.5">Risk Score</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {RISK_PRESETS.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => updateFilter('min_risk_score', filters.min_risk_score === r.value ? null : r.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-center ${
                      filters.min_risk_score === r.value
                        ? 'bg-indigo-500/15 text-white border border-indigo-500/30'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E293B] border border-gray-800'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ─── DELETE DIALOG ────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, mentionId: null, mentionTitle: '' })}
        onConfirm={handleDelete}
        title="Xóa mention"
        message={`Bạn có chắc muốn xóa mention "${deleteConfirm.mentionTitle}"?`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
      />
    </div>
  );
}
