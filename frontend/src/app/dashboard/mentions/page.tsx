'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search, Eye, Trash2, FileText, X, ExternalLink,
  ArrowUpDown, ChevronDown, ChevronUp, Filter, BarChart3,
  Globe, Rss, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, BrainCircuit, Loader2,
  Facebook, Youtube, RefreshCw, SlidersHorizontal, Sparkles,
  Twitter, Instagram, Mic, Video, Link2Off, Tag,
  SearchCode, Download, CheckSquare, Square, Calendar,
  Scan, ChevronLeft, ChevronRight, Info, Link2, ShieldAlert, ShieldCheck
} from 'lucide-react';
import { mentions as mentionsApi, dashboard, keywords as keywordsApi, crawl, savedFilters } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useDialog } from '@/components/ui/Dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getSafeVisitUrl, getVisitUrlStatus } from '@/lib/visit-url';
import { MentionFilterBar } from '@/components/mentions/MentionFilterBar';
import { MentionActiveFilterChips } from '@/components/mentions/MentionActiveFilterChips';
import { MentionEmptyResults } from '@/components/mentions/MentionEmptyResults';
import { AntiNoiseNotice } from '@/components/mentions/AntiNoiseNotice';
import { MentionFilterErrorState } from '@/components/mentions/MentionFilterErrorState';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════════════════════════════════════ */

interface MentionItem {
  id: number;
  job_id: number | null;
  source_id: number;
  source_name: string;
  source_type: string;
  title: string | null;
  content: string;
  url: string | null;
  canonical_url?: string | null;
  original_url?: string | null;
  visit_url_invalid_reason?: string | null;
  source_integrity_level?: 'high' | 'medium' | 'low' | 'unavailable' | null;
  source_confidence?: number | 'low' | 'high' | null;
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
  tags?: string[] | string;
  tags_json: string[] | null;
  risk_score?: number;
  crisis_level?: number;
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
  visit_count?: number;
  last_visited_at?: string | null;
  is_visited?: boolean;
  matched_in?: string[];
  match_strength?: string;
}

interface Filters {
  sentiment: string | null;
  sentiments: string[];
  source_types: string[];
  source_type: string | null;
  date_from: string | null;
  date_to: string | null;
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
  { value: 'neutral', label: 'Trung lập', dot: 'bg-gray-400', bg: 'bg-gray-500/10 border-gray-500/20 text-slate-500 dark:text-gray-400' },
  { value: 'negative', label: 'Tiêu cực', dot: 'bg-rose-500', bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400' },
];

const SOURCE_TYPE_OPTIONS = [
  { value: 'web', label: 'Web', icon: Globe, color: 'text-blue-400', disabled: false },
  { value: 'news', label: 'News', icon: FileText, color: 'text-slate-500 dark:text-gray-400', disabled: false },
  { value: 'blog', label: 'Blogs/Forums', icon: FileText, color: 'text-green-400', disabled: false },
  { value: 'video', label: 'YouTube', icon: Youtube, color: 'text-red-400', disabled: false },
  { value: 'rss', label: 'RSS', icon: Rss, color: 'text-orange-400', disabled: false },
  { value: 'facebook_page', label: 'Facebook', icon: Facebook, color: 'text-blue-500', disabled: true, msg: 'Kết nối' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-fuchsia-500', disabled: true, msg: 'Kết nối' },
  { value: 'twitter', label: 'X/Twitter', icon: Twitter, color: 'text-sky-400', disabled: true, msg: 'Sắp hỗ trợ' },
  { value: 'reddit', label: 'Reddit', icon: Globe, color: 'text-orange-400', disabled: true, msg: 'Sắp hỗ trợ' },
  { value: 'tiktok', label: 'TikTok', icon: Video, color: 'text-pink-400', disabled: true, msg: 'Kết nối' },
  { value: 'podcast', label: 'Podcasts', icon: Mic, color: 'text-purple-400', disabled: true, msg: 'Sắp hỗ trợ' },
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

function getSafeUrl(url: string | null | undefined): string | null {
  return getSafeVisitUrl(url) || null;
}

function getSourceIntegrityLabel(level: string | null | undefined): { label: string; color: string; title: string } | null {
  switch (level) {
    case 'high': return null; // No badge for high confidence — expected baseline
    case 'medium': return { label: '\u25cf', color: 'text-yellow-400', title: 'Nguồn: độ tin cậy trung bình' };
    case 'low': return { label: '\u25cf', color: 'text-orange-500', title: 'Nguồn: độ tin cậy thấp — link có thể không chính xác' };
    case 'unavailable': return { label: '\u25cf', color: 'text-gray-500', title: 'Nguồn: không xác minh được' };
    default: return null;
  }
}

function keywordToText(keyword: any): string | null {
  if (typeof keyword === 'string') return keyword.trim() || null;
  if (!keyword || typeof keyword !== 'object') return null;
  const value = keyword.keyword ?? keyword.name ?? keyword.value ?? keyword.text ?? keyword.search_query;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function keywordTexts(keywords: any[] | null | undefined): string[] {
  return (keywords || []).map(keywordToText).filter((value): value is string => Boolean(value));
}

function getMentionSourceLabel(mention: MentionItem): string {
  return mention.domain || 'Không xác định';
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function MentionsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialJobId = searchParams?.get('job_id');
  const initialSearch = searchParams?.get('q') || searchParams?.get('keyword');

  const initialProjectId = searchParams?.get('project_id');

  // Data
  const [mentionsList, setMentionsList] = useState<MentionItem[]>([]);
  const [totalMentions, setTotalMentions] = useState<number>(0);
  const [totalPages, setTotalPages] = useState(1);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [sentimentSummary, setSentimentSummary] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const { activeProject, setActiveProject, projects, fetchProjects } = useProject();
  const { confirm, prompt } = useDialog();
  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(initialSearch || '');
  const [searchInput, setSearchInput] = useState(initialSearch || '');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'reach' | 'sentiment'>('reach');
  const [chartTimeRange, setChartTimeRange] = useState<'days' | 'weeks' | 'months'>('days');

  const currentFetchIdRef = useRef<number>(0);
  const scannedKeywordsRef = useRef<Set<string>>(new Set());

  const [searchState, setSearchState] = useState<'IDLE' | 'TYPING' | 'SEARCHING_DB' | 'LOCAL_RESULTS_FOUND' | 'NO_LOCAL_RESULTS' | 'AUTO_SCAN_STARTING' | 'AUTO_SCAN_RUNNING' | 'AUTO_SCAN_COMPLETED' | 'AUTO_SCAN_NO_RESULTS' | 'AUTO_SCAN_FAILED'>('IDLE');

  useEffect(() => {
    const handleTyping = () => setSearchState('TYPING');
    window.addEventListener('topbar_search_typing', handleTyping);
    return () => window.removeEventListener('topbar_search_typing', handleTyping);
  }, []);

  useEffect(() => {
    const q = searchParams?.get('q') || searchParams?.get('keyword') || '';
    if (q !== searchTerm) {
      setSearchTerm(q);
      setSearchInput(q);
      setPage(1);
      setActiveScanJobId(null);
      setActiveScanKeyword('');
      setScanJobStatus(null);
      scannedKeywordsRef.current?.clear();
      setSearchState('SEARCHING_DB');
    } else {
      setSearchState(prev => prev === 'TYPING' ? (q ? 'LOCAL_RESULTS_FOUND' : 'IDLE') : prev);
    }
  }, [searchParams, searchTerm]);

  const [filters, setFilters] = useState<Filters>({
    sentiment: null,
    source_type: null,
    date_from: null,
    date_to: null,
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
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    let active = true;
    const fetchFacets = async () => {
      try {
        const params: any = {};
        const projectParam = searchParams?.get('project_id');
        if (projectParam) params.project_id = Number(projectParam);
        const qParam = searchParams?.get('q') || searchParams?.get('keyword');
        if (qParam) params.q = qParam;
        if (filters.sentiment) params.sentiment = filters.sentiment;
        if (filters.source_type) params.source_type = filters.source_type;
        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;
        const data = await mentionsApi.sentimentFacets(params);
        if (active) {
          setSentimentSummary({
            total: (data?.positive || 0) + (data?.neutral || 0) + (data?.negative || 0) + (data?.unknown || 0),
            positive: data?.positive || 0,
            neutral: data?.neutral || 0,
            negative: data?.negative || 0,
            unknown: data?.unknown || 0,
          });
        }
      } catch {
        if (active) setSentimentSummary(null);
      }
    };
    fetchFacets();
    return () => {
      active = false;
    };
  }, [filters, searchParams]);
  const [summarizeDrawerOpen, setSummarizeDrawerOpen] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; mentionId: number | null; mentionTitle: string }>({
    isOpen: false,
    mentionId: null,
    mentionTitle: '',
  });
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === mentionsList.length && mentionsList.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(mentionsList.map((m) => m.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: `Xóa ${selectedIds.size} mention?`,
      message: `Bạn sắp xóa vĩnh viễn ${selectedIds.size} mention đã chọn. Thao tác này không thể hoàn tác.`,
      confirmText: 'Xóa tất cả',
      variant: 'danger',
    });
    if (!ok) return;
    let success = 0;
    for (const id of Array.from(selectedIds)) {
      try { await mentionsApi.delete(id); success++; } catch {}
    }
    toast.success(`Đã xóa ${success}/${selectedIds.size} mentions`);
    setSelectedIds(new Set());
    fetchMentions();
  };

  const hasSyncedUrlProject = useRef(false);

  // NEW SCAN STATES
  const [activeScanJobId, setActiveScanJobId] = useState<number | null>(null);
  const [activeScanKeyword, setActiveScanKeyword] = useState<string>('');
  const [scanJobStatus, setScanJobStatus] = useState<any>(null);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const scanStartTimeRef = useRef<number | null>(null);
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
        const ok = await confirm({
          title: 'Ghi đè bộ lọc',
          message: `Bộ lọc "${saveFilterName}" đã tồn tại. Bạn có muốn ghi đè không?`,
          confirmText: 'Ghi đè',
          cancelText: 'Hủy',
          variant: 'warning',
        });
        if (!ok) {
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
    const ok = await confirm({
      title: 'Xóa bộ lọc',
      message: 'Bạn có chắc muốn xóa bộ lọc này? Thao tác này không thể hoàn tác.',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      variant: 'danger'
    });
    if (!ok) return;

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
      console.error('[API Error] POST /api/mentions/summarize ->', error?.response?.status || error.message);
      toast.error(error?.response?.data?.detail || 'Không tạo được tóm tắt AI lúc này');
    } finally {
      setSummarizing(false);
    }
  };

  /* ─── DATA FETCHING ─────────────────────────────────────────────────── */

  const fetchMentions = useCallback(async (forceRefresh = false, forcePage1 = false) => {
    const fetchId = ++currentFetchIdRef.current;
    try {
      setLoading(true);
      const currentPage = forcePage1 ? 1 : page;
      // Khi page = 1 (tá»©c lÃ  query/filter thay Ä'á»•i), clear dá»¯ liá»‡u cÅ© Ä'á»ƒ hiá»ƒn thá»‹ loading chÃ­nh xÃ¡c
      if (currentPage === 1) {
        setMentionsList([]);
      }

      const params: any = {
        page: currentPage,
        page_size: 20,
        sort_by: filters.sort_by,
      };
      if (forceRefresh === true) {
        params.refresh = true;
      }
      if (initialJobId) {
        params.job_id = initialJobId;
      } else {
        // Apply q instead of keyword so backend searches only title, snippet, and content.
        if (searchTerm) {
          params.q = searchTerm;
        }
        if (filters.sentiment) params.sentiment = filters.sentiment;
        if (filters.source_type) params.source_type = filters.source_type;
        if (filters.min_risk_score !== null) params.min_risk_score = filters.min_risk_score;
        if (filters.min_influence_score !== null) params.min_influence_score = filters.min_influence_score;

        if (dateRange && dateRange !== 'all') {
          const now = new Date();
          const from = new Date();
          if (dateRange === '1d') from.setDate(now.getDate() - 1);
          else if (dateRange === '7d') from.setDate(now.getDate() - 7);
          else if (dateRange === '30d') from.setDate(now.getDate() - 30);
          else if (dateRange === '90d') from.setDate(now.getDate() - 90);

          params.date_from = from.toISOString();
          params.date_to = now.toISOString();
        }
      }
      if (activeProject) params.project_id = activeProject.id;

      const data = await mentionsApi.list(params);
      if (fetchId !== currentFetchIdRef.current) return;

      setFetchError(null);
      setMentionsList(data.items);
      setTotalMentions(data.total);
      setTotalPages(data.total_pages);

      // Auto-trigger scan on EVERY search (not just empty results) if < threshold
      if (searchTerm && !initialJobId && !activeScanJobId && activeProject) {
        const keywordLower = searchTerm.toLowerCase().trim();
        const allowlist = ['tth', 'fpt', 'vtv', 'vnpt', 'f88', '24h'];
        const isAllowedShort = allowlist.includes(keywordLower);

        if ((keywordLower.length >= 3 || isAllowedShort) && !scannedKeywordsRef.current?.has(keywordLower)) {
          if (data.total < 20) {
            scannedKeywordsRef.current?.add(keywordLower);
            // Show existing results immediately, scan runs in background
            if (data.total > 0) {
              setSearchState('LOCAL_RESULTS_FOUND');
            } else {
              setSearchState('AUTO_SCAN_STARTING');
            }
            crawl.manualScan({
                project_id: activeProject.id,
                query: searchTerm,
                expand_keywords: true,
                mode: 'AUTO_DISCOVERY',
                source_types: filters.source_type ? [filters.source_type] : [],
                max_results: 20,
                auto_triggered: true,
                reason: 'live_search_low_results',
                current_result_count: data.total
              }).then((res) => {
              if (fetchId !== currentFetchIdRef.current) return;
              if (res.message === "Returned existing recent job to prevent duplicate crawl" || res.message === "Returned existing running job to prevent duplicate crawl") {
                toast.success(`Đang theo dõi tiến độ quét '${searchTerm}'...`, { icon: '🔍' });
              } else {
                toast.success(`Đang quét thêm '${searchTerm}' do ít kết quả...`, { icon: '🔍' });
              }
              setActiveScanJobId(res.job_id);
              setActiveScanKeyword(searchTerm);
              setScanJobStatus({ status: 'QUEUED' });
              setSearchState('AUTO_SCAN_RUNNING');
              scanStartTimeRef.current = Date.now();
            }).catch((err) => {
              console.error('Scan error:', err);
              setSearchState(data.total > 0 ? 'LOCAL_RESULTS_FOUND' : 'AUTO_SCAN_FAILED');
              scannedKeywordsRef.current?.delete(keywordLower);
            });
          } else {
            // Sufficient results, no need to auto-scan
            setSearchState('LOCAL_RESULTS_FOUND');
          }
        } else {
          // Already scanned or too short
          if (data.total === 0) setSearchState('NO_LOCAL_RESULTS');
          else setSearchState('LOCAL_RESULTS_FOUND');
        }
      } else if (data.total === 0 && searchTerm) {
        setSearchState('NO_LOCAL_RESULTS');
      } else {
        if (searchTerm) setSearchState('LOCAL_RESULTS_FOUND');
        else setSearchState('IDLE');
      }
    } catch (error: any) {
      console.error('Error fetching mentions:', error);
      const errMsg = error.response?.data?.detail || error.message || 'Lỗi khi tải mentions';
      setFetchError(errMsg);
      toast.error(errMsg);
      setSearchState('NO_LOCAL_RESULTS');
    } finally {
      setLoading(false);
    }
  }, [page, filters, initialJobId, searchTerm, activeProject, dateRange]);

  const fetchMentionsRef = useRef(fetchMentions);
  useEffect(() => {
    fetchMentionsRef.current = fetchMentions;
  }, [fetchMentions]);

  const fetchChartData = async () => {
    setChartLoading(true);
    try {
      // Map chartTimeRange to API range and granularity
      let range = '30d';
      let granularity = 'daily';
      if (chartTimeRange === 'days') {
        range = '7d';
        granularity = 'daily';
      } else if (chartTimeRange === 'weeks') {
        range = '30d';
        granularity = 'weekly';
      } else if (chartTimeRange === 'months') {
        range = '180d';
        granularity = 'monthly';
      } else {
        // fallback from dateRange
        if (dateRange === '1d') range = 'today';
        else if (dateRange === '7d') range = '7d';
      }

      const res = await dashboard.trends(range, activeProject?.id, granularity);
      if (res && res.items) {
        const mappedData = res.items.map((item: any) => {
          return {
            date: item.date,
            mentions: item.total_mentions,
            reach: item.total_mentions * 10 // Placeholder for reach
          };
        });
        setChartData(mappedData);
      } else {
        setChartData([]);
      }
    } catch (err) {
      console.error('Failed to fetch chart data', err);
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  };

  const fetchSourceCounts = useCallback(async () => {
    if (!activeProject && !searchTerm && !initialJobId) return;
    try {
      const params: any = {};
      if (initialJobId) {
        params.job_id = initialJobId;
      } else {
        if (searchTerm) params.q = searchTerm;
        if (filters.sentiment) params.sentiment = filters.sentiment;
        if (filters.min_risk_score !== null) params.min_risk_score = filters.min_risk_score;
        if (filters.min_influence_score !== null) params.min_influence_score = filters.min_influence_score;

        if (dateRange && dateRange !== 'all') {
          const now = new Date();
          const from = new Date();
          if (dateRange === '1d') from.setDate(now.getDate() - 1);
          else if (dateRange === '7d') from.setDate(now.getDate() - 7);
          else if (dateRange === '30d') from.setDate(now.getDate() - 30);
          else if (dateRange === '90d') from.setDate(now.getDate() - 90);
          params.date_from = from.toISOString();
          params.date_to = now.toISOString();
        }
      }
      if (activeProject) params.project_id = activeProject.id;
      const counts = await mentionsApi.sourceCounts(params);
      setSourceCounts(counts);
    } catch (error) {
      console.error('Error fetching source counts:', error);
    }
  }, [filters.sentiment, filters.min_risk_score, filters.min_influence_score, initialJobId, searchTerm, activeProject, dateRange]);

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions, activeProject]);

  useEffect(() => {
    fetchSourceCounts();
  }, [fetchSourceCounts]);

  useEffect(() => {
    fetchChartData();
  }, [activeProject?.id, chartTimeRange]);

  useEffect(() => {
    // Reset state on project change to prevent stale data
    setMentionsList([]);
    setPage(1);

    const newParams = new URLSearchParams(searchParams?.toString() || '');
    if (newParams.has('job_id')) {
      newParams.delete('job_id');
      router.replace(`/dashboard/mentions?${newParams.toString()}`);
    }

    // Explicitly call fetchMentions here to ensure it loads immediately on project switch
    fetchMentions();
    fetchChartData();
  }, [activeProject?.id]); // DO NOT add searchParams to deps of this effect


  /* ─── SCAN NOW LOGIC ────────────────────────────────────────────────── */
  const [scanConfirm, setScanConfirm] = useState({ isOpen: false, keyword: '' });

  const executeScan = async (keyword: string) => {
    if (!activeProject) return;
    try {
      const res = await crawl.manualScan({
        project_id: activeProject.id,
        query: keyword,
        source_types: filters.source_type ? filters.source_type.split(',') : [],
        expand_keywords: true,
        mode: 'AUTO_DISCOVERY',
        source_ids: [],
        max_results: 100,
      });
      if (res.message === "Returned existing running job to prevent duplicate crawl") {
        toast.success("Đang có job quét tương tự đang chạy. Tự động theo dõi tiến độ...");
      } else {
        toast.success(`Đang quét dữ liệu mới cho từ khóa ${keyword}...`);
      }
      setActiveScanJobId(res.job_id);
      setActiveScanKeyword(keyword);
      setScanJobStatus({ status: 'QUEUED' });
      setScanConfirm({ isOpen: false, keyword: '' });
    } catch (err: any) {
      toast.error('Lỗi khi bắt đầu quét');
    }
  };

  const handleScanClick = () => {
    if (!activeProject) {
      toast.error('Vui lòng chọn project trước.');
      return;
    }
    const keyword = searchTerm || activeProject.name || 'TTH';

    // Warn if scanning a keyword that differs from the project name
    const projectNameStr = activeProject.name.toLowerCase().trim();
    const keywordStr = keyword.toLowerCase().trim();

    if (projectNameStr !== keywordStr && !projectNameStr.includes(keywordStr)) {
      setScanConfirm({ isOpen: true, keyword });
    } else {
      executeScan(keyword);
    }
  };

  useEffect(() => {
    if (!activeScanJobId) return;
    const interval = setInterval(async () => {
      if (scanStartTimeRef.current && Date.now() - scanStartTimeRef.current > 90000) {
        clearInterval(interval);
        setSearchState('AUTO_SCAN_FAILED');
        setScanJobStatus((prev: any) => ({ ...prev, status: 'TIMEOUT', error_message: 'Job quét đang chạy lâu hơn bình thường (90s). Vui lòng kiểm tra lại Worker/Status.' }));
        return;
      }

      try {
        const data = await crawl.getJob(activeScanJobId);
        setScanJobStatus(data);
        const status = data.status?.toUpperCase();
        if (['COMPLETED', 'COMPLETED_NO_RESULTS', 'FAILED', 'PARTIAL_FAILED', 'TIMEOUT'].includes(status)) {
          clearInterval(interval);
          scanStartTimeRef.current = null;

          if (status === 'COMPLETED' || status === 'PARTIAL_FAILED') {
            setSearchState('AUTO_SCAN_COMPLETED');
            setPage(1);
            // Use .then() so we clear activeScanJobId AFTER the refetch completes,
            // preventing any accidental double-scan trigger in between
            Promise.resolve(fetchMentionsRef.current(true, true)).finally(() => {
              setActiveScanJobId(null);
            });
          } else if (status === 'COMPLETED_NO_RESULTS') {
            setSearchState('AUTO_SCAN_NO_RESULTS');
            setActiveScanJobId(null);
          } else {
            setSearchState('AUTO_SCAN_FAILED');
            setActiveScanJobId(null);
          }
        } else {
            setSearchState('AUTO_SCAN_RUNNING');
        }
      } catch (err) {
        console.error(err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeScanJobId, router, searchParams]);

  /* ─── PROJECT / SCAN ACTIONS ─────────────────────────────────────────── */



  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchTerm(val);
      setPage(1);
      setActiveScanJobId(null);
      setActiveScanKeyword('');
      setScanJobStatus(null);
      setSearchState('IDLE');
      const newParams = new URLSearchParams(searchParams?.toString() || '');
      if (val) {
        newParams.set('q', val);
      } else {
        newParams.delete('q');
      }
      newParams.delete('job_id'); // Always clear job_id when searching
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
    router.push('/dashboard/mentions'); // Clear URL params completely
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

  const handleVisit = async (mention: MentionItem) => {
    const safeUrl = getSafeUrl(mention.canonical_url || mention.url);
    if (!safeUrl) {
      toast.error(mention.visit_url_invalid_reason || 'Khong co link bai goc hop le');
      return;
    }

    window.open(safeUrl, '_blank', 'noopener,noreferrer');

    // Optimistic update
    setMentionsList(prev => prev.map(m => {
      if (m.id === mention.id) {
        return {
          ...m,
          is_visited: true,
          visit_count: (m.visit_count || 0) + 1
        };
      }
      return m;
    }));

    try {
      await mentionsApi.visit(mention.id);
    } catch (error) {
      console.error('Lỗi khi ghi nhận visit', error);
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
      if (searchTerm) params.q = searchTerm;
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        const from = new Date();
        if (dateRange === '1d') from.setDate(now.getDate() - 1);
        else if (dateRange === '7d') from.setDate(now.getDate() - 7);
        else if (dateRange === '30d') from.setDate(now.getDate() - 30);
        else if (dateRange === '90d') from.setDate(now.getDate() - 90);
        params.date_from = from.toISOString();
        params.date_to = now.toISOString();
      }
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
        { label: 'Trung lập', value: sentimentSummary.neutral || 0, icon: Minus, color: 'text-slate-500 dark:text-gray-400', bg: 'bg-gray-500/10' },
      ]
    : [];

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto min-h-screen">
      <Toaster position="top-right" />

      {/* ─── LEFT MAIN COLUMN (75%) ─────────────────────────────────────────── */}
      <div className="flex-1 w-full lg:w-[75%] min-w-0 flex flex-col gap-6">

        {/* Header & Filter Controls */}
        <MentionFilterBar
          searchInput={searchInput}
          onSearchChange={handleSearchChange}
          onScanClick={handleScanClick}
          onExportClick={handleExportCsv}
          onRefreshClick={() => { fetchMentions(); fetchChartData(); }}
          onSaveFilterClick={openSaveFilterModal}
          onClearFilters={clearAllFilters}
          isScanning={activeScanJobId !== null}
          isLoading={loading}
          hasActiveFilters={!!hasActiveFilters}
          sortValue={filters.sort_by}
          onSortChange={(val) => { setFilters({ ...filters, sort_by: val }); setPage(1); }}
          sortOptions={SORT_OPTIONS}
          sortOpen={sortOpen}
          setSortOpen={setSortOpen}
        />

        <MentionActiveFilterChips
          filters={filters}
          searchTerm={searchTerm}
          dateRange={dateRange}
          onRemoveFilter={(key) => {
            if (key === 'search') { setSearchTerm(''); setSearchInput(''); }
            else if (key === 'dateRange') setDateRange('all');
            else updateFilter(key as any, null);
          }}
          onClearAll={clearAllFilters}
        />

        {/* Scan / Search Status */}
        {(searchTerm || activeScanJobId || scanJobStatus) && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-slate-500 dark:text-gray-400">
            {searchTerm && (
              <span className="font-medium bg-white dark:bg-[#050A15] border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-lg shadow-sm">
                Tìm thấy <span className="font-bold text-slate-900 dark:text-white">{totalMentions}</span> kết quả cho <span className="text-blue-600 font-bold">'{searchTerm}'</span>
              </span>
            )}

            {activeScanJobId && (
              <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 px-3 py-1.5 rounded-lg shadow-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Đang quét thêm nguồn mới để mở rộng kết quả...
              </span>
            )}

            {!activeScanJobId && scanJobStatus && scanJobStatus.status === 'COMPLETED' && (
              <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 px-3 py-1.5 rounded-lg shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Quét xong: tìm thấy {scanJobStatus.meta_data?.actual_raw_results_count || 0}, thêm mới {scanJobStatus.meta_data?.created_mentions_count || 0}, bỏ qua {scanJobStatus.meta_data?.duplicate_mentions_count || 0} trùng lặp.
              </span>
            )}
            {!activeScanJobId && scanJobStatus && scanJobStatus.status === 'PARTIAL_FAILED' && (
              <span className="flex items-center gap-1.5 text-orange-600 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/50 px-3 py-1.5 rounded-lg shadow-sm">
                <AlertTriangle className="w-3.5 h-3.5" />
                Quét xong (có lỗi 1 phần): tìm thấy {scanJobStatus.meta_data?.actual_raw_results_count || 0}, thêm mới {scanJobStatus.meta_data?.created_mentions_count || 0}.
              </span>
            )}
          </div>
        )}

        {/* Chart Section */}
        <div className="bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 dark:border-white/5 gap-2 pb-2 sm:pb-0">
            <div className="flex items-center">
              <button
                onClick={() => setActiveChartTab('reach')}
                className={`px-4 sm:px-6 py-3 border-b-2 text-sm font-bold ${activeChartTab === 'reach' ? 'border-blue-600 text-gray-900 dark:text-white' : 'border-transparent text-gray-600 dark:text-slate-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-slate-700 dark:text-gray-300'}`}
              >
                Mentions & Reach
              </button>
              <button
                onClick={() => setActiveChartTab('sentiment')}
                className={`px-4 sm:px-6 py-3 border-b-2 text-sm font-bold ${activeChartTab === 'sentiment' ? 'border-blue-600 text-gray-900 dark:text-white' : 'border-transparent text-gray-600 dark:text-slate-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-slate-700 dark:text-gray-300'}`}
              >
                Cảm xúc
              </button>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400 hidden xl:block mr-2 px-4 text-right">
               Xu hướng đề cập trong dự án (Không phụ thuộc bộ lọc hiện tại)
            </div>
            <div className="ml-auto pr-4 flex items-center gap-2">
               <div className="flex bg-gray-100 dark:bg-white/10 p-0.5 rounded-lg border border-gray-200 dark:border-white/10">
                 <button
                   onClick={() => setChartTimeRange('days')}
                   className={`px-3 py-1 text-xs font-medium rounded shadow-sm ${chartTimeRange === 'days' ? 'bg-white dark:bg-[#050A15] text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-slate-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-slate-700 dark:text-gray-300'}`}
                 >Days</button>
                 <button
                   onClick={() => setChartTimeRange('weeks')}
                   className={`px-3 py-1 text-xs font-medium rounded shadow-sm ${chartTimeRange === 'weeks' ? 'bg-white dark:bg-[#050A15] text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-slate-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-slate-700 dark:text-gray-300'}`}
                 >Weeks</button>
                 <button
                   onClick={() => setChartTimeRange('months')}
                   className={`px-3 py-1 text-xs font-medium rounded shadow-sm ${chartTimeRange === 'months' ? 'bg-white dark:bg-[#050A15] text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-slate-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-slate-700 dark:text-gray-300'}`}
                 >Months</button>
               </div>
            </div>
          </div>

          <div className="px-5 pt-2 pb-5">
            {chartLoading ? (
              <div className="w-full h-56 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                    contentStyle={{
                      backgroundColor: '#0d1426',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#F9FAFB',
                      padding: '8px 14px',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
                    }}
                    labelStyle={{ color: '#6B7280', fontWeight: 600, marginBottom: 4 }}
                  />
                  {activeChartTab === 'reach' ? (
                    <Bar dataKey="mentions" name="Mentions" fill="#4F46E5" radius={[5, 5, 0, 0]} maxBarSize={36} />
                  ) : (
                    <>
                      <Bar dataKey="positive" name="Tích cực" stackId="a" fill="#10B981" maxBarSize={36} />
                      <Bar dataKey="neutral" name="Trung lập" stackId="a" fill="#6B7280" maxBarSize={36} />
                      <Bar dataKey="negative" name="Tiêu cực" stackId="a" fill="#EF4444" radius={[5, 5, 0, 0]} maxBarSize={36} />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-56 flex items-center justify-center text-sm text-gray-500">
                Không có dữ liệu biểu đồ
              </div>
            )}
          </div>
          <div className="px-6 pb-4 flex items-center gap-6">
             {activeChartTab === 'reach' ? (
               <>
                 <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-blue-500"></span><span className="text-xs font-bold text-blue-600">Mentions</span></div>
                 <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-emerald-500"></span><span className="text-xs font-bold text-emerald-600">Reach</span></div>
               </>
             ) : (
               <>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-emerald-500"></span><span className="text-xs font-bold text-emerald-600">Tích cực</span></div>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-gray-400"></span><span className="text-xs font-bold text-gray-500">Trung lập</span></div>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-rose-500"></span><span className="text-xs font-bold text-rose-600">Tiêu cực</span></div>
               </>
             )}
          </div>
        </div>

        {/* Pagination Bar Top */}
        <div className="flex items-center justify-between bg-white dark:bg-[#050A15] px-4 py-3 rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
           <div className="text-sm font-medium text-gray-600 dark:text-slate-500 dark:text-gray-400">
             {loading && !mentionsList.length ? 'Đang tải...' : totalMentions >= 0 ? `${totalMentions.toLocaleString()} kết quả ${searchTerm ? `cho '${searchTerm}'` : ''}` : 'Đang tải...'}
           </div>

           {totalPages > 1 && (
             <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-slate-500 dark:text-gray-400">
               {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => (
                 <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 flex items-center justify-center rounded-md ${page === i + 1 ? 'text-blue-600 font-bold bg-blue-50' : 'hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-white/10'}`}>
                   {i + 1}
                 </button>
               ))}
               {totalPages > 5 && <span className="px-1">...</span>}
               {totalPages > 5 && (
                 <button onClick={() => setPage(totalPages)} className={`w-8 h-8 flex items-center justify-center rounded-md ${page === totalPages ? 'text-blue-600 font-bold bg-blue-50' : 'hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-white/10'}`}>
                   {totalPages}
                 </button>
               )}
               <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-white/10 rounded-md disabled:opacity-50 text-blue-600">
                 <ChevronRight className="w-5 h-5" />
               </button>
             </div>
           )}
        </div>

        {/* MENTIONS LIST */}
        <div className="space-y-4">
          {fetchError ? (
            <MentionFilterErrorState 
              errorMessage={fetchError} 
              onRetry={() => { setFetchError(null); fetchMentions(); }} 
            />
          ) : loading && !mentionsList.length ? (
            <div className="py-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex flex-col sm:flex-row gap-4 p-5 bg-white dark:bg-[#050A15] border border-gray-200 dark:border-white/10 rounded-xl">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-white/10 rounded-xl"></div>
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-5/6"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : mentionsList.length === 0 ? (
            <MentionEmptyResults
              searchState={searchState}
              searchTerm={searchTerm}
              dateRange={dateRange}
              hasFilters={!!filters.source_type}
              onExtend7Days={() => { setDateRange('7d'); setPage(1); }}
              onExtend30Days={() => { setDateRange('30d'); setPage(1); }}
              onClearFilters={() => { setFilters(prev => ({...prev, source_type: null})); setPage(1); }}
              onScanClick={handleScanClick}
              isScanning={activeScanJobId !== null}
            />
          ) : (
            <div className="space-y-4">
              {loading && mentionsList.length > 0 && (
                <div className="sticky top-0 z-10 flex items-center justify-center py-2 text-blue-600 bg-blue-50/90 dark:bg-blue-900/40 backdrop-blur-sm border border-blue-100 dark:border-blue-800/50 text-sm font-medium gap-2 rounded-lg shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {searchTerm ? `Đang cập nhật kết quả cho "${searchTerm}"...` : 'Đang cập nhật danh sách...'}
                </div>
              )}
              {searchState === 'TYPING' && !loading && mentionsList.length > 0 && (
                <div className="sticky top-0 z-10 flex items-center justify-center py-2 text-gray-500 bg-gray-50/90 dark:bg-gray-800/40 backdrop-blur-sm border border-gray-100 dark:border-slate-300 dark:border-gray-700 text-sm font-medium gap-2 rounded-lg shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang nhập từ khóa...
                </div>
              )}
              {['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3 mb-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <span className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                    Hệ thống đang tự động quét thêm kết quả mới cho '{searchTerm}' ở chế độ nền...
                  </span>
                </div>
              )}
              {searchState === 'AUTO_SCAN_COMPLETED' && scanJobStatus && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3 border-b border-emerald-200/50 dark:border-emerald-800/30 pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm text-emerald-800 dark:text-emerald-300 font-bold">
                        Quét hoàn tất (Job #{scanJobStatus.job_id})
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-emerald-800 dark:text-emerald-200/80">
                    <div><span className="font-semibold text-emerald-900 dark:text-emerald-100">Query gốc:</span> {scanJobStatus.meta_data?.query || searchTerm}</div>
                    <div><span className="font-semibold text-emerald-900 dark:text-emerald-100">Nguồn quét:</span> {scanJobStatus.summary?.adapters_ready?.join(', ') || 'Tất cả'}</div>
                    <div><span className="font-semibold text-emerald-900 dark:text-emerald-100">Kết quả (Raw):</span> {scanJobStatus.summary?.serpapi_result_count || 0}</div>
                    <div><span className="font-semibold text-emerald-900 dark:text-emerald-100">Tạo mới:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">{scanJobStatus.summary?.new_mentions_created || 0} mentions</span></div>
                    <div><span className="font-semibold text-emerald-900 dark:text-emerald-100">Bỏ qua (Duplicate):</span> {scanJobStatus.summary?.duplicates_skipped || 0}</div>
                  </div>
                </div>
              )}
              {/* Bulk Action Bar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-500/30 rounded-xl mb-2">
                  <div className="flex items-center gap-4 text-sm font-bold text-indigo-700 dark:text-indigo-300">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === mentionsList.length && mentionsList.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-indigo-400 text-indigo-600 cursor-pointer"
                    />
                    <span>{selectedIds.size} đã chọn</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa đã chọn
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              )}
              {mentionsList.map((mention) => {
const getMentionSourceLabel = (mention: any) => {
  if (mention.source_name && mention.source_name.trim() !== '') return mention.source_name;
  if (mention.domain && mention.domain.trim() !== '') return mention.domain;
  return mention.source_type || 'Unknown Source';
};

const extractDomain = (url: string | null | undefined) => {
  try {
    if (!url) return '';
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const getSourceIntegrityLabel = (level: string | null | undefined) => {
  switch (level) {
    case 'high': return { label: 'Trusted', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 px-1.5 py-0.5 rounded border font-bold', title: 'Nguồn được xác thực an toàn' };
    case 'low': return { label: 'Low Trust', color: 'bg-amber-50 text-amber-600 border-amber-200 px-1.5 py-0.5 rounded border font-bold', title: 'Nguồn có độ tin cậy thấp' };
    default: return null;
  }
};
return (
              <div key={mention.id} className="bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden group hover:border-gray-300 transition-colors">
                
                {/* Source & Provenance Header */}
                <div className="px-5 py-3 bg-slate-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm border border-gray-200 dark:border-white/10 ${
                      mention.source_type?.startsWith('facebook') ? 'bg-blue-50 text-blue-600' :
                      mention.source_type?.startsWith('youtube') || mention.source_type === 'video' ? 'bg-red-50 text-red-600' :
                      mention.source_type === 'tiktok' ? 'bg-zinc-100 text-zinc-800' :
                      'bg-white dark:bg-white/5 text-gray-600 dark:text-slate-400'
                    }`}>
                      <SourceIcon type={mention.source_type} className="w-4 h-4" />
                    </div>
                    
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white tracking-wide">
                          {mention.domain && mention.domain.toLowerCase() !== 'unknown' ? mention.domain : extractDomain(mention.canonical_url || mention.url) || 'Nguồn chưa xác định'}
                        </span>
                        {/* Trust Badges */}
                        {(() => {
                          const isLowConfidence = mention.source_confidence === 'low' || (typeof mention.source_confidence === 'number' && mention.source_confidence < 0.5);
                          if (typeof mention.source_confidence !== 'undefined' && !isLowConfidence) {
                             return <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded font-bold" title="Độ tin cậy cao">Trusted</span>;
                          }
                          if (isLowConfidence) {
                             return <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded font-bold" title="Độ tin cậy thấp">Low Trust</span>;
                          }
                          return null;
                        })()}
                        {activeScanJobId && mention.job_id === activeScanJobId && (
                           <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-sm shrink-0 border border-blue-200 dark:border-blue-800">New</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium tracking-wider uppercase">
                        {mention.source_type || 'Unknown Source'} • {mention.published_at ? new Date(mention.published_at).toLocaleString('vi-VN') : new Date(mention.collected_at!).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    {mention.ai_analysis?.ai_provider && (
                       <span className={
                         mention.ai_analysis.ai_provider === 'failed'
                         ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-md text-[10px] font-bold border border-red-200 dark:border-red-500/20 shadow-sm"
                         : "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-1 rounded-md text-[10px] font-bold border border-indigo-200 dark:border-indigo-500/20 shadow-sm"
                       }>
                         {mention.ai_analysis.ai_provider === 'failed' ? 'AI FAILED' :
                          ['dummy', 'dummy_ai'].includes(mention.ai_analysis.ai_provider) ? 'RULE-BASED' :
                          mention.ai_analysis.ai_provider.toUpperCase()}
                       </span>
                     )}
                     <div className={`px-2 py-1 rounded-md border border-gray-200 dark:border-white/10 shadow-sm text-[11px] font-bold flex items-center whitespace-nowrap ${
                       mention.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                       mention.sentiment === 'negative' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                       'bg-white dark:bg-white/10 text-gray-600 dark:text-slate-400'
                     }`}>
                       <select
                         value={mention.sentiment === 'positive' ? 'positive' : mention.sentiment === 'negative' ? 'negative' : 'neutral'}
                         onChange={(e) => handleAction(mention.id, 'sentiment', () => mentionsApi.updateSentiment(mention.id, e.target.value), 'Đã cập nhật sentiment')}
                         className="bg-transparent border-none outline-none font-bold cursor-pointer appearance-none pr-3"
                       >
                         <option value="positive" className="text-emerald-600 font-bold">Positive</option>
                         <option value="neutral" className="text-gray-600 font-bold">Neutral</option>
                         <option value="negative" className="text-rose-600 font-bold">Negative</option>
                       </select>
                       <ChevronDown className="w-3 h-3 pointer-events-none -ml-2" />
                     </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="p-5 flex flex-col md:flex-row gap-5">
                  {/* Media Rendering safely */}
                  {(() => {
                    const meta = mention.metadata || (mention as any).meta_data;
                    if (!meta) return null;

                    const mediaUrl = meta.media_url;
                    let imageUrl = meta.image_url || meta.media_thumbnail;
                    
                    // Validate image url
                    const isSafeImage = imageUrl && typeof imageUrl === 'string' && !imageUrl.startsWith('sediment://') && !imageUrl.includes('image_asset_pointer') && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
                    if (!isSafeImage) imageUrl = null;

                    if (mediaUrl) {
                      if (mediaUrl.match(/\.(mp4|webm|ogg)$/i)) {
                        return (
                          <div className="shrink-0 w-full md:w-48 h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-slate-100 dark:bg-white/5">
                            <video controls className="w-full h-full object-cover" poster={imageUrl}>
                              <source src={mediaUrl} type="video/mp4" />
                            </video>
                          </div>
                        );
                      }
                      if (mediaUrl.match(/\.(mp3|wav|m4a)$/i)) {
                         return (
                           <div className="shrink-0 w-full md:w-48 p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center">
                             <audio controls className="w-full">
                               <source src={mediaUrl} type="audio/mpeg" />
                             </audio>
                           </div>
                         );
                      }
                    }

                    if (imageUrl) {
                      return (
                        <div className="shrink-0 w-full md:w-48 h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-slate-100 dark:bg-white/5">
                          <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight" title={mention.title || mention.author || 'Unknown Author'}>
                       {mention.title ? highlightText(mention.title, searchTerm) : <span className="text-slate-400 italic">Không có tiêu đề</span>}
                    </h3>

                    <p className="text-sm text-slate-600 dark:text-zinc-300 mt-2 line-clamp-3 leading-relaxed">
                      {highlightText(mention.snippet || mention.content?.substring(0, 300) || '', searchTerm)}
                    </p>

                    {/* Metadata Bottom row */}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                       {searchTerm && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {mention.matched_in && mention.matched_in.length > 0 ? (
                              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex gap-1 items-center bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded shadow-sm border border-indigo-100 dark:border-indigo-800/30">
                                <Search className="w-3 h-3" />
                                {mention.matched_in.join(', ')}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500 dark:text-gray-400 font-bold flex gap-1 items-center bg-gray-50 dark:bg-white/5 px-2 py-0.5 rounded shadow-sm border border-gray-200 dark:border-white/10">
                                <Search className="w-3 h-3" />
                                Semantic Match
                              </div>
                            )}
                            {mention.match_strength && (
                              <div className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border uppercase ${
                                mention.match_strength === 'exact' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                mention.match_strength === 'strong' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400' :
                                'bg-white text-gray-600 border-gray-200 dark:bg-white/5 dark:text-slate-400'
                              }`}>
                                {mention.match_strength} match
                              </div>
                            )}
                          </div>
                       )}
                       
                       {/* Keywords */}
                       {keywordTexts(mention.matched_keywords).length > 0 && (
                         <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-[10px] tracking-wide font-bold rounded shadow-sm">
                           <Link2 className="w-3 h-3" />
                           {keywordTexts(mention.matched_keywords).join(', ')}
                         </div>
                       )}
                       
                       {/* Influence & Risk */}
                       {mention.influence_score !== undefined && (
                         <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 border-l border-gray-300 pl-3">
                           Ảnh hưởng: <strong>{mention.influence_score}/10</strong>
                         </span>
                       )}
                       {mention.risk_score !== undefined && (
                         <span className={`text-[11px] font-medium border-l border-gray-300 pl-3 ${mention.risk_score >= 80 ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                           Rủi ro: <strong>{mention.risk_score}</strong>
                         </span>
                       )}
                    </div>
                  </div>
                </div>

                 {/* Actions Footer */}
                <div className="bg-slate-50 dark:bg-[#0a0f1c]/50 px-5 py-3 border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
                   <div className="flex flex-wrap items-center gap-3">
                     {(() => {
                        const integrityLevel = mention.source_integrity_level;
                        const isLowIntegrity = integrityLevel === 'low' || integrityLevel === 'unavailable';
                        const visitStatus = getVisitUrlStatus(mention.canonical_url || mention.url);
                        const safeUrl = visitStatus.url;
                        const integrityBadge = getSourceIntegrityLabel(integrityLevel);

                        if (!safeUrl || mention.visit_url_invalid_reason || isLowIntegrity) {
                          const tooltipText = mention.visit_url_invalid_reason
                            ? mention.visit_url_invalid_reason
                            : isLowIntegrity
                            ? (integrityLevel === 'low' ? 'Độ tin cậy thấp' : 'Không xác minh được nguồn')
                            : 'Không có link an toàn';
                          return (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-gray-400 cursor-not-allowed group/tooltip relative" title={tooltipText}>
                             <Link2Off className="w-3.5 h-3.5" /> Không thể Visit
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/tooltip:block px-2 py-1 bg-gray-800 text-slate-900 dark:text-white text-[10px] rounded whitespace-nowrap z-10">{tooltipText}</div>
                           </div>
                          );
                        }
                        return (
                          <>
                            <button onClick={() => handleVisit(mention)} className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 transition-colors shadow-sm">
                              <ExternalLink className="w-3.5 h-3.5" /> Visit Nguồn
                            </button>
                            {integrityBadge && (
                              <span
                                className={`text-[10px] ${integrityBadge.color} cursor-default`}
                                title={integrityBadge.title}
                              >
                                {integrityBadge.label}
                              </span>
                            )}
                          </>
                        );
                      })()}

                     {mention.is_visited && (
                       <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20 shadow-sm">
                         <CheckCircle2 className="w-3.5 h-3.5" /> Đã xem
                         {(mention.visit_count ?? 0) > 0 && <span className="text-emerald-500 ml-0.5">({mention.visit_count})</span>}
                       </div>
                     )}

                     <button
                       onClick={() => handleAction(mention.id, 'review', () => mentionsApi.markReviewed(mention.id), 'Đã đánh dấu xem')}
                       className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors border shadow-sm ${
                         mention.is_reviewed
                           ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                           : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
                       }`}
                       title="Đánh dấu đã xem nội bộ"
                     >
                       <CheckCircle2 className="w-3.5 h-3.5" /> Review
                     </button>
                     {(!mention.sentiment || !mention.risk_score) && (
                       <button
                         onClick={() => handleAction(mention.id, 'analyze', () => mentionsApi.analyze(mention.id), 'Đã phân tích xong')}
                         className="flex items-center gap-1.5 text-[11px] font-bold text-purple-700 bg-purple-50 border-purple-200 px-2.5 py-1.5 rounded-lg hover:bg-purple-100 transition-colors shadow-sm dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-400"
                         title="Phân tích AI"
                       >
                         <BrainCircuit className="w-3.5 h-3.5" /> Phân tích AI
                       </button>
                     )}
                     {(mention.risk_score !== undefined && mention.risk_score >= 50) && (
                       <button
                         onClick={() => handleAction(mention.id, 'alert', () => mentionsApi.createAlert(mention.id), 'Đã tạo cảnh báo rủi ro')}
                         className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border-rose-200 px-2.5 py-1.5 rounded-lg hover:bg-rose-100 transition-colors shadow-sm dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400"
                         title="Tạo cảnh báo"
                       >
                         <AlertTriangle className="w-3.5 h-3.5" /> Cảnh báo
                       </button>
                     )}
                     <div className="h-4 border-l border-slate-300 dark:border-slate-700 mx-1"></div>
                     <button
                       onClick={async () => {
                         const currentTags = mention.tags ? (Array.isArray(mention.tags) ? mention.tags.join(', ') : mention.tags) : '';
                         const input = await prompt({
                           title: 'Cập nhật tags',
                           message: 'Nhập các tags, cách nhau bằng dấu phẩy.',
                           placeholder: 'tag1, tag2, tag3...',
                           defaultValue: currentTags,
                           confirmText: 'Lưu tags',
                         });
                         if (input !== null) {
                           const newTags = input.split(',').map((t) => t.trim()).filter(Boolean);
                           handleAction(mention.id, 'tags', () => mentionsApi.updateTags(mention.id, newTags), 'Đã cập nhật tags');
                         }
                       }}
                       className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                     >
                       <Tag className="w-3.5 h-3.5" /> Tags
                     </button>
                     <button onClick={() => handleToggleAddToReport(mention.id, mention.add_to_report)} className={`flex items-center gap-1.5 text-[11px] font-medium ${mention.add_to_report ? 'text-indigo-600' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                       <FileText className="w-3.5 h-3.5" /> {mention.add_to_report ? 'Remove PDF' : 'Add PDF'}
                     </button>
                     <button
                       disabled={!mention.author}
                       onClick={() => handleAction(mention.id, 'mute_author', () => mentionsApi.muteAuthor(mention.author!, activeProject!.id), `Đã ẩn tác giả ${mention.author}`)}
                       className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
                     >
                       <Eye className="w-3.5 h-3.5" /> Mute author
                     </button>
                     <button
                       disabled={!mention.domain}
                       onClick={() => handleAction(mention.id, 'mute_domain', () => mentionsApi.muteDomain(mention.domain!, activeProject!.id), `Đã ẩn nguồn ${mention.domain}`)}
                       className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
                     >
                       <Eye className="w-3.5 h-3.5" /> Mute site
                     </button>
                     <button onClick={() => setDeleteConfirm({ isOpen: true, mentionId: mention.id, mentionTitle: mention.title || '' })} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600">
                       <Trash2 className="w-3.5 h-3.5" /> Delete
                     </button>
                   </div>
                   <input
                      type="checkbox"
                      checked={selectedIds.has(mention.id)}
                      onChange={() => toggleSelect(mention.id)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                </div>
               </div>
            );
            })
            }
            </div>
          )}
        </div>

        {/* Pagination Bar Bottom */}
        {totalPages > 1 && (
           <div className="flex items-center justify-end bg-white dark:bg-[#050A15] px-4 py-3 rounded-xl shadow-sm border border-gray-200 dark:border-white/10 mt-2 mb-8">
             <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-slate-500 dark:text-gray-400">
               {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => (
                 <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 flex items-center justify-center rounded-md ${page === i + 1 ? 'text-blue-600 font-bold bg-blue-50' : 'hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-white/10'}`}>
                   {i + 1}
                 </button>
               ))}
               {totalPages > 5 && <span className="px-1">...</span>}
               {totalPages > 5 && (
                 <button onClick={() => setPage(totalPages)} className={`w-8 h-8 flex items-center justify-center rounded-md ${page === totalPages ? 'text-blue-600 font-bold bg-blue-50' : 'hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-white/10'}`}>
                   {totalPages}
                 </button>
               )}
             </div>
           </div>
        )}
      </div>

      {/* ─── RIGHT SIDEBAR (FILTERS - 25%) ───────────────────────────────── */}
      <div className="hidden lg:block w-[300px] xl:w-[320px] shrink-0 space-y-4 pb-8">

        {/* Date Range — Segmented Pill Selector */}
        <div className="bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-4">
           <div className="flex items-center gap-2 mb-3">
             <Calendar className="w-4 h-4 text-slate-500 dark:text-gray-400" />
             <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Thời gian</h3>
           </div>
           <div className="flex flex-wrap gap-1.5">
             {[
               { value: '1d', label: 'Hôm nay' },
               { value: '7d', label: '7N' },
               { value: '30d', label: '30N' },
               { value: '90d', label: '90N' },
               { value: 'all', label: 'Tất cả' },
             ].map((opt) => (
               <button
                 key={opt.value}
                 onClick={() => { setDateRange(opt.value); setPage(1); }}
                 className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-150 border whitespace-nowrap ${
                   dateRange === opt.value
                     ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300 shadow-sm'
                     : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-transparent dark:border-white/10 dark:text-slate-500 dark:text-gray-400 dark:hover:bg-white/5'
                 }`}
               >
                 {opt.label}
               </button>
             ))}
           </div>
        </div>

        {/* Sources — Active Grid + Collapsed Unavailable */}
        <div className="bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-4">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
               Nguồn
             </h3>
             {filters.source_type && (
               <button
                 onClick={() => { setFilters({ ...filters, source_type: null }); setPage(1); }}
                 className="text-[11px] font-bold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
               >
                 Xóa lọc
               </button>
             )}
           </div>
           {/* Active Sources — vertical list */}
           <div className="flex flex-col gap-1.5">
             {SOURCE_TYPE_OPTIONS.filter(s => !s.disabled).map((src) => {
               const currentSources = filters.source_type ? filters.source_type.split(',') : [];
               const isSelected = currentSources.includes(src.value);
               const count = sourceCounts[src.value] || 0;
               return (
                 <button
                   key={src.value}
                   onClick={() => {
                     let next = [...currentSources];
                     if (isSelected) {
                       next = next.filter(s => s !== src.value);
                     } else {
                       next.push(src.value);
                     }
                     setFilters({ ...filters, source_type: next.length ? next.join(',') : null });
                     setPage(1);
                   }}
                   className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 border ${
                     isSelected
                       ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/50 text-blue-700 dark:text-blue-300 shadow-sm'
                       : count > 0 ? 'bg-white dark:bg-transparent border-gray-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-white/5' : 'bg-gray-50 dark:bg-[#0a0f1c] border-transparent text-slate-500 dark:text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/5'
                   }`}
                 >
                   <div className="flex items-center gap-2">
                     <src.icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : count > 0 ? src.color : 'text-slate-500 dark:text-gray-400 dark:text-gray-600'}`} />
                     <span className="truncate">{src.label}</span>
                   </div>
                   <span className={`text-xs font-bold ${isSelected ? 'text-blue-600 dark:text-blue-400' : count > 0 ? 'text-slate-500 dark:text-gray-400' : 'text-slate-500 dark:text-gray-400 dark:text-gray-600'}`}>{count.toLocaleString('vi-VN')}</span>
                 </button>
               );
             })}
           </div>
           {/* Unavailable / Connector Sources */}
           <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex flex-col gap-1.5">
             <div className="text-[11px] text-slate-500 dark:text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-1 px-1">Nguồn kết nối</div>
             {SOURCE_TYPE_OPTIONS.filter(s => s.disabled).map((src) => (
                 <div
                   key={src.value}
                   className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium border border-transparent bg-gray-50 dark:bg-[#0a0f1c] text-slate-500 dark:text-gray-400 dark:text-gray-500"
                 >
                   <div className="flex items-center gap-2">
                     <src.icon className="w-4 h-4 shrink-0 opacity-50" />
                     <span className="truncate">{src.label}</span>
                   </div>
                   <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 bg-gray-200 dark:bg-white/10 dark:text-slate-500 dark:text-gray-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                     {src.msg}
                   </span>
                 </div>
             ))}
           </div>
        </div>
        <AntiNoiseNotice />

        {/* Sentiment Filter */}
        <div className="bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-4">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
               Cảm xúc <Info className="w-3.5 h-3.5 text-slate-500 dark:text-gray-400" />
             </h3>
           </div>
           <div className="flex flex-col gap-3">
             <label className="flex items-center gap-2 cursor-pointer">
               <input
                  type="checkbox"
                  checked={filters.sentiment?.split(',').includes('negative') || false}
                  onChange={() => {
                    const current = filters.sentiment ? filters.sentiment.split(',') : [];
                    const next = current.includes('negative') ? current.filter(s => s !== 'negative') : [...current, 'negative'];
                    setFilters({...filters, sentiment: next.length ? next.join(',') : null});
                    setPage(1);
                  }}
                  className="rounded border-gray-300 text-rose-500 focus:ring-rose-500"
               />
               <span className="text-xs font-medium text-rose-600">Negative</span>
             </label>
             <label className="flex items-center gap-2 cursor-pointer">
               <input
                  type="checkbox"
                  checked={filters.sentiment?.split(',').includes('neutral') || false}
                  onChange={() => {
                    const current = filters.sentiment ? filters.sentiment.split(',') : [];
                    const next = current.includes('neutral') ? current.filter(s => s !== 'neutral') : [...current, 'neutral'];
                    setFilters({...filters, sentiment: next.length ? next.join(',') : null});
                    setPage(1);
                  }}
                  className="rounded border-gray-300 text-gray-600 dark:text-slate-500 dark:text-gray-400 focus:ring-gray-500"
               />
               <span className="text-xs font-medium text-gray-600 dark:text-slate-500 dark:text-gray-400">Neutral</span>
             </label>
             <label className="flex items-center gap-2 cursor-pointer">
               <input
                  type="checkbox"
                  checked={filters.sentiment?.split(',').includes('positive') || false}
                  onChange={() => {
                    const current = filters.sentiment ? filters.sentiment.split(',') : [];
                    const next = current.includes('positive') ? current.filter(s => s !== 'positive') : [...current, 'positive'];
                    setFilters({...filters, sentiment: next.length ? next.join(',') : null});
                    setPage(1);
                  }}
                  className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
               />
               <span className="text-xs font-medium text-emerald-600">Positive</span>
             </label>
           </div>
        </div>

        {/* Influence Score */}
        <div className="bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-4">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
               Điểm ảnh hưởng <Info className="w-3.5 h-3.5 text-slate-500 dark:text-gray-400" />
             </h3>
           </div>
           <div className="px-2">
             <input
               type="range"
               min="0"
               max="10"
               value={filters.min_influence_score || 0}
               onChange={(e) => {
                 setFilters({ ...filters, min_influence_score: parseInt(e.target.value) });
                 setPage(1);
               }}
               className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
             />
             <div className="flex justify-between text-[10px] text-gray-600 dark:text-slate-500 dark:text-gray-400 mt-2 font-medium">
               <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span>
             </div>
           </div>
        </div>

      </div>

      {/* Scan Confirm Modal */}
      {scanConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#050A15] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Xác nhận quét</h2>
              <p className="text-gray-600 dark:text-slate-500 dark:text-gray-400 mb-6 leading-relaxed">
                Từ khóa bạn đang tìm kiếm (<span className="font-bold text-blue-600">{scanConfirm.keyword}</span>) khác với tên project hiện tại (<span className="font-bold">{activeProject?.name}</span>). Bạn có chắc chắn muốn quét từ khóa này vào project hiện tại không?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setScanConfirm({ isOpen: false, keyword: '' })}
                  className="px-5 py-2 rounded-xl text-sm font-bold text-gray-600 dark:text-slate-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={() => executeScan(scanConfirm.keyword)}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  Tiếp tục quét
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MentionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Đang tải dữ liệu...</div>}>
      <MentionsPageContent />
    </Suspense>
  );
}
