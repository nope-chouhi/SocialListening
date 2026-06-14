'use client';
// Force Vercel build 2

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
  Scan, ChevronLeft, ChevronRight, Info, LayoutDashboard
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
  canonical_url?: string | null;
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
  { value: 'negative', label: 'Tiêu cực', dot: 'bg-rose-500', bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400' },
];

const SOURCE_TYPE_OPTIONS = [
  { value: 'website', label: 'Web', icon: Globe, color: 'text-blue-400', disabled: false },
  { value: 'news', label: 'News', icon: FileText, color: 'text-gray-400', disabled: false },
  { value: 'forum', label: 'Blogs/Forums', icon: FileText, color: 'text-green-400', disabled: false },
  { value: 'youtube_video', label: 'Videos (YouTube)', icon: Youtube, color: 'text-red-400', disabled: false },
  { value: 'rss', label: 'RSS', icon: Rss, color: 'text-orange-400', disabled: false },
  { value: 'facebook_page', label: 'Facebook', icon: Facebook, color: 'text-blue-500', disabled: true, msg: 'Connect required' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-fuchsia-500', disabled: true, msg: 'Connect required' },
  { value: 'twitter', label: 'X/Twitter', icon: Twitter, color: 'text-sky-400', disabled: true, msg: 'Coming soon' },
  { value: 'reddit', label: 'Reddit', icon: Globe, color: 'text-orange-400', disabled: true, msg: 'Coming soon' },
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

function getSafeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const tUrl = url.trim();
  if (tUrl === '') return null;
  
  const lowerUrl = tUrl.toLowerCase();
  
  // Block dangerous schemes
  if (lowerUrl.startsWith('javascript:') || 
      lowerUrl.startsWith('data:') || 
      lowerUrl.startsWith('file:') || 
      lowerUrl.startsWith('vbscript:')) {
    return null;
  }
  
  // Accept explicitly allowed schemes
  if (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
    return tUrl;
  }
  
  // Try parsing as URL to catch weird cases like jAvascript:
  try {
    const parsed = new URL(tUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch (e) {
    // If URL parse fails but it looks like a domain without scheme, add https://
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/.test(tUrl)) {
      return `https://${tUrl}`;
    }
  }
  return null;
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
  const { activeProject, setActiveProject, projects, fetchProjects } = useProject();
  const { confirm, prompt } = useDialog();
  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(initialSearch || '');
  const [searchInput, setSearchInput] = useState(initialSearch || '');
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
      // Reset scanned keywords when query changes so new scan triggers
      if (q) {
        scannedKeywordsRef.current?.clear();
        setSearchState('SEARCHING_DB');
      } else {
        setSearchState('IDLE');
      }
    } else {
      setSearchState(prev => prev === 'TYPING' ? (q ? 'LOCAL_RESULTS_FOUND' : 'IDLE') : prev);
    }
  }, [searchParams, searchTerm]);
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
      console.error('Error summarizing:', error);
      toast.error(error?.response?.data?.detail || 'Lỗi khi tạo tóm tắt AI. Có thể AI chưa được cấu hình.');
    } finally {
      setSummarizing(false);
    }
  };

  /* ─── DATA FETCHING ─────────────────────────────────────────────────── */

  const fetchMentions = useCallback(async () => {
    if (!activeProject) {
      setMentionsList([]);
      setTotalMentions(0);
      setTotalPages(1);
      setSearchState('IDLE');
      return;
    }
    
    const fetchId = ++currentFetchIdRef.current;
    try {
      setLoading(true);
      // Khi page = 1 (tá»©c lÃ  query/filter thay Ä‘á»•i), clear dá»¯ liá»‡u cÅ© Ä‘á»ƒ hiá»ƒn thá»‹ loading chÃ­nh xÃ¡c
      if (page === 1) {
        setMentionsList([]);
      }
      
      const params: any = {
        page,
        page_size: 20,
        sort_by: filters.sort_by,
      };
      if (initialJobId) {
        params.job_id = initialJobId;
      } else {
        // Apply q instead of keyword to allow searching across title, snippet, content, url, domain
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
      
      // Deduplicate results based on URL and Title to avoid filling the page with spam
      const seen = new Set();
      const dedupedItems = data.items.filter((item: any) => {
        const urlStr = typeof item.url === 'string' ? item.url : '';
        const canonicalUrl = urlStr.split('?')[0].split('#')[0].replace(/\/$/, '').toLowerCase() || '';
        const titleKey = (item.title || '').trim().toLowerCase();
        // Fallback to title + source + date if URL is missing
        const fallbackKey = `fallback:${titleKey}:${item.source_type}:${item.published_at || item.collected_at}`;
        
        const key = canonicalUrl ? `url:${canonicalUrl}` : (titleKey ? `title:${titleKey}` : fallbackKey);
        
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      setMentionsList(dedupedItems);
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
            try {
              const res = await crawl.manualScan({
                project_id: activeProject.id,
                query: searchTerm,
                expand_keywords: true,
                mode: 'AUTO_DISCOVERY',
                source_types: filters.source_type ? [filters.source_type] : [],
                max_results: 20,
                auto_triggered: true,
                reason: 'live_search_low_results',
                current_result_count: data.total
              });
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
            } catch (err) {
              console.error('Scan error:', err);
              setSearchState(data.total > 0 ? 'LOCAL_RESULTS_FOUND' : 'AUTO_SCAN_FAILED');
              scannedKeywordsRef.current?.delete(keywordLower);
            }
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
      toast.error(error.response?.data?.detail || 'Lỗi khi tải mentions');
      setSearchState('NO_LOCAL_RESULTS');
    } finally {
      setLoading(false);
    }
  }, [page, filters, initialJobId, searchTerm, activeProject, dateRange]);

  const fetchChartData = async () => {
    setChartLoading(true);
    try {
      let range = '30d';
      if (dateRange === '1d') range = 'today';
      else if (dateRange === '7d') range = '7d';
      
      const res = await dashboard.trends(range, activeProject?.id);
      if (res && res.items) {
        const mappedData = res.items.map((item: any) => {
          const dateObj = new Date(item.date);
          const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          return {
            date: formattedDate,
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

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions, activeProject]);

  useEffect(() => {
    fetchChartData();
  }, [activeProject?.id]);

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
            fetchMentions();
          } else if (status === 'COMPLETED_NO_RESULTS') {
            setSearchState('AUTO_SCAN_NO_RESULTS');
          } else {
            setSearchState('AUTO_SCAN_FAILED');
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
    const deletedId = deleteConfirm.mentionId;
    
    // Optimistic update
    setMentionsList(prev => prev.filter(m => m.id !== deletedId));
    setDeleteConfirm({ isOpen: false, mentionId: null, mentionTitle: '' });
    
    try {
      await mentionsApi.delete(deletedId);
      toast.success('Xóa mention thành công!');
    } catch (error: any) {
      toast.error('Lỗi khi xóa mention');
      // Rollback if error
      fetchMentions();
    }
  };

  const handleAction = async (mentionId: number, action: string, apiCall: () => Promise<any>, successMsg: string, optimisticData?: Partial<any>) => {
    setActionLoading((prev) => ({ ...prev, [`${mentionId}_${action}`]: true }));
    
    if (optimisticData) {
      setMentionsList(prev => prev.map(m => m.id === mentionId ? { ...m, ...optimisticData } : m));
    }

    try {
      await apiCall();
      toast.success(successMsg);
      if (!optimisticData) {
        fetchMentions();
      }
    } catch (error: any) {
      // Rollback on error if we updated optimistically
      if (optimisticData) {
        fetchMentions();
      }
      const errorData = error?.response?.data;
      const errorMessage = errorData?.message || errorData?.detail || 'Có lỗi xảy ra';
      
      if (errorData?.code === 'AI_PROVIDER_NOT_CONFIGURED') {
        toast.error(errorMessage, { 
          icon: '⚠️',
          duration: 5000,
          className: 'dark:bg-gray-800 dark:text-white dark:border-gray-700'
        });
      } else {
        toast.error(errorMessage, {
          className: 'dark:bg-gray-800 dark:text-white dark:border-gray-700'
        });
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [`${mentionId}_${action}`]: false }));
    }
  };

  const handleVisit = async (mention: MentionItem) => {
    const safeUrl = getSafeUrl(mention.url) || getSafeUrl(mention.canonical_url);
    if (!safeUrl) return;
    
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
    // Optimistic update
    setMentionsList(prev => prev.map(m => m.id === mentionId ? { ...m, add_to_report: !currentStatus } : m));
    
    try {
      await mentionsApi.addToReport(mentionId, !currentStatus);
      toast.success(!currentStatus ? 'Đã thêm vào báo cáo' : 'Đã xóa khỏi báo cáo');
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Có lỗi xảy ra');
      // Rollback
      fetchMentions();
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
        { label: 'Trung lập', value: sentimentSummary.neutral || 0, icon: Minus, color: 'text-gray-400', bg: 'bg-gray-500/10' },
      ]
    : [];

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto min-h-screen">
      
      {!activeProject && projects.length === 0 ? (
        <div className="flex-1 w-full flex flex-col items-center justify-center min-h-[60vh] bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-8 text-center">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
            <LayoutDashboard className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Chưa có Project nào</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
            Bạn chưa có project. Tạo project đầu tiên để bắt đầu theo dõi các đề cập trên mạng xã hội.
          </p>
          <button 
            disabled 
            className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 font-bold rounded-lg cursor-not-allowed border border-gray-200 dark:border-gray-700"
          >
            Tạo project (Chưa tích hợp)
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 w-full lg:w-[75%] min-w-0 flex flex-col gap-6">
            
            {/* Header & Filter Controls */}
        <div className="flex flex-col gap-3 bg-white dark:bg-[#050A15] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
           <div className="flex flex-wrap items-center justify-between gap-4">
             <div className="flex items-center gap-3">
               <div className="relative" ref={sortRef}>
                 <button onClick={() => setSortOpen(!sortOpen)} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-gray-800 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors">
                   {SORT_OPTIONS.find((o) => o.value === filters.sort_by)?.label || 'By relevance'}
                   <ChevronDown className="w-4 h-4" />
                 </button>
                 {sortOpen && (
                   <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-[#050A15] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl z-20 py-1">
                     {SORT_OPTIONS.map((opt) => (
                       <button
                         key={opt.value}
                         onClick={() => { setFilters({ ...filters, sort_by: opt.value }); setSortOpen(false); setPage(1); }}
                         className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                           filters.sort_by === opt.value
                             ? 'bg-blue-50 text-blue-600'
                             : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#0a0f1c] dark:bg-[#0a0f1c]'
                         }`}
                       >
                         {opt.label}
                       </button>
                     ))}
                   </div>
       
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

               </div>
               
               {hasActiveFilters && (
                 <button onClick={() => { setFilters({ ...filters, sentiment: null, source_type: null, min_risk_score: null, min_influence_score: null }); setPage(1); }} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 dark:text-gray-100 font-medium transition-colors">
                   <RefreshCw className="w-3.5 h-3.5" /> Clear filters
                 </button>
     
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

               
               <button onClick={openSaveFilterModal} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-bold transition-colors">
                 <SlidersHorizontal className="w-3.5 h-3.5" /> Save filters
               </button>
             </div>
             
             <div className="flex items-center gap-3">
                <button onClick={() => { fetchMentions(); fetchChartData(); }} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={handleExportCsv} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                  <Download className="w-4 h-4" />
                </button>
                <button 
                   onClick={handleScanClick}
                   disabled={activeScanJobId !== null}
                   className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                 >
                   {activeScanJobId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                   {activeScanJobId ? 'Đang quét...' : 'Scan Now'}
                 </button>
             </div>
           </div>
           
           {/* Scan / Search Status */}
           {(searchTerm || activeScanJobId || scanJobStatus) && (
             <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-white/5 text-sm text-gray-600 dark:text-gray-400">
               {searchTerm && (
                 <span className="font-medium">
                   Tìm thấy <span className="font-bold text-gray-900 dark:text-white">{totalMentions}</span> kết quả cho <span className="text-blue-600 font-bold">'{searchTerm}'</span>
                 </span>
     
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

               
               {activeScanJobId && (
                 <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md">
                   <Loader2 className="w-3.5 h-3.5 animate-spin" />
                   Đang quét thêm nguồn mới để mở rộng kết quả...
                 </span>
     
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

               
               {!activeScanJobId && scanJobStatus && scanJobStatus.status === 'COMPLETED' && (
                 <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md">
                   <CheckCircle2 className="w-3.5 h-3.5" />
                   Quét xong: tìm thấy {scanJobStatus.meta_data?.actual_raw_results_count || 0}, thêm mới {scanJobStatus.meta_data?.created_mentions_count || 0}, bỏ qua {scanJobStatus.meta_data?.duplicate_mentions_count || 0} trùng lặp.
                 </span>
     
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

               {!activeScanJobId && scanJobStatus && scanJobStatus.status === 'PARTIAL_FAILED' && (
                 <span className="flex items-center gap-1.5 text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-md">
                   <AlertTriangle className="w-3.5 h-3.5" />
                   Quét xong (có lỗi 1 phần): tìm thấy {scanJobStatus.meta_data?.actual_raw_results_count || 0}, thêm mới {scanJobStatus.meta_data?.created_mentions_count || 0}.
                 </span>
     
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

             </div>
 
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

        </div>

        {/* Chart Section */}
        <div className="bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className="flex items-center border-b border-gray-100 dark:border-white/5">
            <button 
              onClick={() => setActiveChartTab('reach')}
              className={`px-6 py-3 border-b-2 text-sm font-bold ${activeChartTab === 'reach' ? 'border-blue-600 text-gray-900 dark:text-white' : 'border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Mentions & Reach
            </button>
            <button 
              onClick={() => setActiveChartTab('sentiment')}
              className={`px-6 py-3 border-b-2 text-sm font-bold ${activeChartTab === 'sentiment' ? 'border-blue-600 text-gray-900 dark:text-white' : 'border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Sentiment
            </button>
            <div className="ml-auto pr-4 flex items-center gap-2">
               <div className="flex bg-gray-100 dark:bg-white/10 p-0.5 rounded-lg border border-gray-200 dark:border-white/10">
                 <button 
                   onClick={() => setChartTimeRange('days')}
                   className={`px-3 py-1 text-xs font-medium rounded shadow-sm ${chartTimeRange === 'days' ? 'bg-white dark:bg-[#050A15] text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                 >Days</button>
                 <button 
                   onClick={() => setChartTimeRange('weeks')}
                   className={`px-3 py-1 text-xs font-medium rounded shadow-sm ${chartTimeRange === 'weeks' ? 'bg-white dark:bg-[#050A15] text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                 >Weeks</button>
                 <button 
                   onClick={() => setChartTimeRange('months')}
                   className={`px-3 py-1 text-xs font-medium rounded shadow-sm ${chartTimeRange === 'months' ? 'bg-white dark:bg-[#050A15] text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                 >Months</button>
               </div>
            </div>
          </div>
          
          <div className="p-4 h-64">
            {chartLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '12px', color: '#111827' }} />
                  {activeChartTab === 'reach' ? (
                    <Bar dataKey="mentions" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  ) : (
                    <>
                      <Bar dataKey="positive" stackId="a" fill="#10B981" maxBarSize={40} />
                      <Bar dataKey="neutral" stackId="a" fill="#9CA3AF" maxBarSize={40} />
                      <Bar dataKey="negative" stackId="a" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </>
        
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
                Không có dữ liệu biểu đồ
              </div>
  
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
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
   
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

          </div>
        </div>

        {/* Pagination Bar Top */}
        <div className="flex items-center justify-between bg-white dark:bg-[#050A15] px-4 py-3 rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
           <div className="text-sm font-medium text-gray-500 dark:text-gray-500">
             {loading && !mentionsList.length ? 'Đang tải...' : totalMentions >= 0 ? `${totalMentions.toLocaleString()} kết quả ${searchTerm ? `cho '${searchTerm}'` : ''}` : 'Đang tải...'}
           </div>
           
           {totalPages > 1 && (
             <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
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
     
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

               <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-white/10 rounded-md disabled:opacity-50 text-blue-600">
                 <ChevronRight className="w-5 h-5" />
               </button>
             </div>
 
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

        </div>

        {/* MENTIONS LIST */}
        <div className="space-y-4">
          {loading && !mentionsList.length ? (
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
            searchState === 'TYPING' ? (
              <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
              </div>
            ) : searchState === 'SEARCHING_DB' ? (
              <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-500 dark:text-gray-500">Đang tìm mentions hiện có liên quan đến '{searchTerm}'...</p>
              </div>
            ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
              <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</h3>
                <p className="text-gray-500 dark:text-gray-500 mb-4">Hệ thống đang quét Web Search, YouTube và các nguồn đã cấu hình.</p>
                {activeProject && searchTerm.toLowerCase().trim() !== activeProject.name.toLowerCase().trim() && !activeProject.name.toLowerCase().trim().includes(searchTerm.toLowerCase().trim()) && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-xs px-3 py-1.5 rounded-md mb-4 border border-yellow-200 dark:border-yellow-800/30">
                    <span className="font-semibold">Lưu ý:</span> Đang tìm '{searchTerm}' trong project '{activeProject.name}'
                  </div>
                )}
                {scanJobStatus?.status && (
                   <div className="flex flex-col items-center text-sm text-gray-400 gap-1">
                     <span>Trạng thái: {scanJobStatus.status} {activeScanJobId && `(Lượt quét #${activeScanJobId})`}</span>
                   </div>
                )}
              </div>
            ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
              <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-4 mb-6 text-sm text-gray-500 dark:text-gray-400 max-w-md text-left w-full space-y-2">
                   <p className="font-semibold text-gray-700 dark:text-gray-300">Kết quả quét ({scanJobStatus?.job_id}):</p>
                   <p>• Web Search: {scanJobStatus?.summary?.web?.called ? `${scanJobStatus.summary.web.raw_results_count} kết quả thô, ${scanJobStatus.summary.web.results_after_keyword_match} phù hợp` : 'Bỏ qua'}</p>
                   <p>• YouTube: {scanJobStatus?.summary?.youtube?.called ? `${scanJobStatus.summary.youtube.raw_results_count} video` : 'Bỏ qua'}</p>
                   <p>• Trùng lặp đã bỏ qua: {scanJobStatus?.summary?.duplicates_skipped || 0}</p>
                </div>
                <div className="flex gap-3">
                   <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                   <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
                </div>
              </div>
            ) : searchState === 'NO_LOCAL_RESULTS' ? (
              <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
                {searchTerm.length < 2 && (
                  <p className="text-gray-500 dark:text-gray-500 mb-6 max-w-sm">Từ khóa quá ngắn để tự động quét internet (cần ít nhất 2 ký tự).</p>
                )}
                <button 
                  onClick={handleScanClick}
                  disabled={activeScanJobId !== null || searchTerm.length < 2}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  Scan Now
                </button>
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
                <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
              </div>
            )
          ) : (
            <div className="space-y-4">
              {loading && (
                <div className="flex items-center justify-center py-2 text-blue-500 text-sm font-medium gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang tải dữ liệu...
                </div>
              )}
              {searchState === 'TYPING' && !loading && (
                <div className="flex items-center justify-center py-2 text-gray-500 text-sm font-medium gap-2">
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
    
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

              {mentionsList.map((mention) => (
              <div key={mention.id} className="bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden group hover:border-gray-300 transition-colors">
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Source Avatar/Logo */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                      mention.source_type?.startsWith('facebook') ? 'bg-blue-100 text-blue-600' :
                      mention.source_type?.startsWith('youtube') || mention.source_type === 'video' ? 'bg-red-100 text-red-600' :
                      mention.source_type === 'tiktok' ? 'bg-black text-white' :
                      'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                    }`}>
                      <SourceIcon type={mention.source_type} className="w-6 h-6" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                             <h3 className="text-base font-bold text-gray-900 dark:text-white truncate" title={mention.title || mention.author || 'Unknown Author'}>
                               {highlightText(mention.title || mention.author || 'Unknown Author', searchTerm)}
                             </h3>
                             {activeScanJobId && mention.job_id === activeScanJobId && (
                               <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-sm shrink-0 border border-blue-200 dark:border-blue-800">New</span>
                   
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

                           </div>
                           {searchTerm && (
                              <div className="flex items-center gap-2 mt-1 mb-1 flex-wrap">
                                {mention.matched_in && mention.matched_in.length > 0 ? (
                                  <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex gap-1.5 items-center bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800/30">
                                    <Search className="w-3 h-3" /> 
                                    Matched in: {mention.matched_in.join(', ')}
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium flex gap-1.5 items-center bg-gray-50 dark:bg-white/5 px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10">
                                    <Search className="w-3 h-3" /> 
                                    Semantic / AI Match
                                  </div>
                      
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

                                {mention.match_strength && (
                                  <div className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    mention.match_strength === 'exact' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                    mention.match_strength === 'strong' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                  }`}>
                                    {mention.match_strength} match
                                  </div>
                      
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

                              </div>
                  
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

                           <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 mt-1">
                             <span>{mention.domain || mention.source_type}</span>
                             <span>•</span>
                             <span>Influence score: {mention.influence_score || 'N/A'}/10</span>
                             <span>•</span>
                             <span>{mention.published_at ? new Date(mention.published_at).toLocaleString() : new Date(mention.collected_at!).toLocaleString()}</span>
                           </div>
                        </div>
                        {/* Sentiment Badge */}
                        <div className={`px-2 py-0.5 rounded-md text-xs font-bold flex items-center whitespace-nowrap ${
                           mention.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-600' :
                           mention.sentiment === 'negative' ? 'bg-rose-50 text-rose-600' :
                           'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                        }`}>
                           <select
                             value={mention.sentiment === 'positive' ? 'positive' : mention.sentiment === 'negative' ? 'negative' : 'neutral'}
                             onChange={(e) => handleAction(mention.id, 'sentiment', () => mentionsApi.updateSentiment(mention.id, e.target.value), 'Đã cập nhật sentiment', { sentiment: e.target.value })}
                             className="bg-transparent border-none outline-none font-bold cursor-pointer appearance-none pr-1"
                           >
                             <option value="positive" className="text-emerald-600">Positive</option>
                             <option value="neutral" className="text-gray-600">Neutral</option>
                             <option value="negative" className="text-rose-600">Negative</option>
                           </select>
                           <ChevronDown className="w-3 h-3 pointer-events-none" />
                        </div>
                      </div>
                      
                      {/* Body */}
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-3 line-clamp-3 leading-relaxed">
                        {highlightText(mention.snippet || mention.content?.substring(0, 300) || '', searchTerm)}
                      </p>
                      
                      {/* Media Rendering */}
                      {(() => {
                        const meta = mention.metadata || (mention as any).meta_data;
                        if (!meta) return null;
                        
                        const mediaUrl = meta.media_url;
                        const imageUrl = meta.image_url || meta.media_thumbnail;
                        
                        if (mediaUrl) {
                          // Check if it's a video file (mp4, webm, etc)
                          if (mediaUrl.match(/\.(mp4|webm|ogg)$/i)) {
                            return (
                              <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black max-w-md">
                                <video controls className="w-full h-auto max-h-64 object-cover" poster={imageUrl}>
                                  <source src={mediaUrl} type="video/mp4" />
                                  Trình duyệt không hỗ trợ video.
                                </video>
                              </div>
                            );
                          }
                          // Otherwise assume audio or other media, provide a link or iframe if needed.
                          // VnE GO mostly uses audio or video.
                          if (mediaUrl.match(/\.(mp3|wav|m4a)$/i)) {
                             return (
                               <div className="mt-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/5 max-w-md">
                                 <audio controls className="w-full h-10">
                                   <source src={mediaUrl} type="audio/mpeg" />
                                 </audio>
                               </div>
                             );
                          }
                        }
                        
                        if (imageUrl) {
                          return (
                            <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 max-w-sm">
                              <img src={imageUrl} alt="Media thumbnail" className="w-full h-auto max-h-48 object-cover" loading="lazy" />
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {/* Tags & Hashtags */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {mention.tags && Array.isArray(mention.tags) && mention.tags.length > 0 && mention.tags.map((tag: string, i: number) => (
                          <span key={`tag-${i}`} className="text-[11px] font-bold text-white bg-indigo-500 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                            <Tag className="w-3 h-3" /> {tag}
                          </span>
                        ))}
                        {mention.tags && typeof mention.tags === 'string' && mention.tags.split(',').filter(Boolean).map((tag: string, i: number) => (
                          <span key={`tag-str-${i}`} className="text-[11px] font-bold text-white bg-indigo-500 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                            <Tag className="w-3 h-3" /> {tag.trim()}
                          </span>
                        ))}
                        {(mention.matched_keywords || []).map((kw, i) => (
                           <span key={`kw-${i}`} className="text-[11px] font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">#{kw.keyword}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Actions Footer */}
                <div className="bg-gray-50 dark:bg-[#0a0f1c]/50 px-5 py-3 border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
                   <div className="flex flex-wrap items-center gap-2">
                     {(() => {
                       const safeUrl = getSafeUrl(mention.url);
                       if (!safeUrl) {
                         return (
                           <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-400 bg-gray-100 dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-lg cursor-not-allowed group/tooltip relative">
                             <Link2Off className="w-3.5 h-3.5" /> Visit
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/tooltip:block px-2 py-1 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap z-10">Không có link bài gốc</div>
                           </div>
                         );
                       }
                       return (
                         <button onClick={() => handleVisit(mention)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                           <ExternalLink className="w-3.5 h-3.5" /> Visit
                         </button>
                       );
                     })()}
                     
                     {mention.is_visited && (
                       <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                         <CheckCircle2 className="w-3 h-3" /> Đã mở
                         {(mention.visit_count ?? 0) > 0 && <span className="text-emerald-500">({mention.visit_count})</span>}
                       </div>
           
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}


                     <button 
                       onClick={() => handleAction(mention.id, 'review', () => mentionsApi.markReviewed(mention.id), 'Đã đánh dấu xem', { is_reviewed: true })}
                       disabled={actionLoading[`${mention.id}_review`]}
                       className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border disabled:opacity-50 ${
                         mention.is_reviewed 
                           ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40' 
                           : 'bg-white dark:bg-[#111827] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                       }`}
                       title="Đánh dấu đã xem"
                     >
                       {actionLoading[`${mention.id}_review`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} 
                       Đã xem
                     </button>
                     {(!mention.sentiment || !mention.risk_score) && (
                       <button 
                         onClick={() => handleAction(mention.id, 'analyze', () => mentionsApi.analyze(mention.id), 'Đã phân tích xong')}
                         disabled={actionLoading[`${mention.id}_analyze`]}
                         className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 text-purple-600 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                         title="Phân tích AI"
                       >
                         {actionLoading[`${mention.id}_analyze`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />} 
                         Phân tích AI
                       </button>
           
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

                     {(mention.risk_score !== undefined && mention.risk_score >= 50) && (
                       <button 
                         onClick={() => handleAction(mention.id, 'alert', () => mentionsApi.createAlert(mention.id), 'Đã tạo cảnh báo rủi ro')}
                         disabled={actionLoading[`${mention.id}_alert`]}
                         className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 text-rose-600 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                         title="Tạo cảnh báo"
                       >
                         {actionLoading[`${mention.id}_alert`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />} 
                         Tạo cảnh báo
                       </button>
           
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

                     <button 
                       onClick={async () => {
                         const currentTagsArray = Array.isArray(mention.tags) ? mention.tags : (mention.tags ? mention.tags.split(',') : []);
                         const input = await prompt({
                           title: 'Cập nhật tags',
                           message: 'Nhập các tags, cách nhau bằng dấu phẩy.',
                           placeholder: 'tag1, tag2, tag3...',
                           defaultValue: currentTagsArray.join(', '),
                           confirmText: 'Lưu tags',
                         });
                         if (input !== null) {
                           const newTags = input.split(',').map((t) => t.trim()).filter(Boolean);
                           const uniqueTags = Array.from(new Set(newTags));
                           handleAction(mention.id, 'tags', () => mentionsApi.updateTags(mention.id, uniqueTags), 'Đã cập nhật tags', { tags: uniqueTags });
                         }
                       }}
                       disabled={actionLoading[`${mention.id}_tags`]}
                       className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                     >
                       {actionLoading[`${mention.id}_tags`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />} 
                       Tags
                     </button>
                     <button 
                       onClick={() => handleToggleAddToReport(mention.id, mention.add_to_report)} 
                       disabled={actionLoading[`${mention.id}_add_to_report`]}
                       className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-lg transition-colors disabled:opacity-50 ${mention.add_to_report ? 'text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                     >
                       {actionLoading[`${mention.id}_add_to_report`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} 
                       {mention.add_to_report ? 'Remove from PDF' : 'Add to PDF'}
                     </button>
                     <button 
                       disabled={!mention.author || actionLoading[`${mention.id}_mute_author`]}
                       onClick={() => handleAction(mention.id, 'mute_author', () => mentionsApi.muteAuthor(mention.author!, activeProject!.id), `Đã ẩn tác giả ${mention.author}`)} 
                       className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                     >
                       {actionLoading[`${mention.id}_mute_author`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} 
                       Mute author
                     </button>
                     <button 
                       disabled={!mention.domain || actionLoading[`${mention.id}_mute_domain`]}
                       onClick={() => handleAction(mention.id, 'mute_domain', () => mentionsApi.muteDomain(mention.domain!, activeProject!.id), `Đã ẩn nguồn ${mention.domain}`)} 
                       className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                     >
                       {actionLoading[`${mention.id}_mute_domain`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} 
                       Mute site
                     </button>
                     <button 
                       onClick={() => setDeleteConfirm({ isOpen: true, mentionId: mention.id, mentionTitle: mention.title || '' })} 
                       className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-[#111827] border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                       title="Xóa mention"
                     >
                       <Trash2 className="w-3.5 h-3.5" /> Delete
                     </button>
                   </div>
                   <input
                      type="checkbox"
                      checked={selectedIds.has(mention.id)}
                      onChange={() => toggleSelect(mention.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                </div>
               </div>
            ))
            }
            </div>

          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

        </div>

        {/* Pagination Bar Bottom */}
        {totalPages > 1 && (
           <div className="flex items-center justify-end bg-white dark:bg-[#050A15] px-4 py-3 rounded-xl shadow-sm border border-gray-200 dark:border-white/10 mt-2 mb-8">
             <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
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
     
          ) : searchState === 'AUTO_SCAN_NO_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Không tìm thấy bài viết/web/video phù hợp với từ khóa '{searchTerm}'.</h3>
              <div className="flex gap-3 mt-4">
                 <button onClick={handleScanClick} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Thử quét lại</button>
                 <button onClick={() => { setSearchTerm(''); router.push('/dashboard/mentions'); }} className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors">Xóa bộ lọc</button>
              </div>
            </div>
          ) : ['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có kết quả trong dữ liệu đã lưu. Hệ thống đang quét thêm nguồn mới...</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-4">Đang tìm các bài viết/web/video liên quan đến '{searchTerm}'...</p>
            </div>
          ) : searchState === 'TYPING' ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-500">Đang nhập từ khóa...</p>
            </div>
          ) : searchState === 'NO_LOCAL_RESULTS' ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có dữ liệu trong DB cho '{searchTerm}'</h3>
              <button 
                onClick={handleScanClick}
                disabled={activeScanJobId !== null || searchTerm.length < 2}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mt-4 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Chưa có đề cập nào</h3>
              <p className="text-gray-500 dark:text-gray-500 max-w-sm mb-6">Dự án của bạn chưa thu thập được đề cập nào, hoặc dữ liệu không khớp với bộ lọc.</p>
            </div>
          )}

             </div>
           </div>
        )}
      </div>

      {/* ─── RIGHT SIDEBAR (FILTERS - 25%) ───────────────────────────────── */}
      <div className="hidden lg:block w-[300px] xl:w-[320px] shrink-0 space-y-4 pb-8">
        
        {/* Date Filter */}
        <div className="bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-4">
           <div className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100">
             <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-500" />
             <select 
               value={dateRange}
               onChange={(e) => setDateRange(e.target.value)}
               className="bg-transparent border-none outline-none cursor-pointer flex-1 font-bold dark:text-gray-100"
             >
               <option value="all" className="dark:bg-gray-800">Tất cả thời gian</option>
               <option value="1d" className="dark:bg-gray-800">Hôm nay</option>
               <option value="7d" className="dark:bg-gray-800">7 ngày qua</option>
               <option value="30d" className="dark:bg-gray-800">30 ngày qua</option>
               <option value="90d" className="dark:bg-gray-800">90 ngày qua</option>
             </select>
           </div>
        </div>

        {/* Sources Filter */}
        <div className="bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-4">
           <div className="flex items-center justify-between mb-3">
             <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
               Sources
             </h3>
           </div>

           {/* Available sources */}
           <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">Available</p>
           <div className="space-y-2 mb-4">
             {SOURCE_TYPE_OPTIONS.filter(src => !src.disabled).map((src) => {
               const currentSources = filters.source_type ? filters.source_type.split(',') : [];
               const isSelected = currentSources.includes(src.value);
               return (
                 <label key={src.value} className="flex items-center gap-2 cursor-pointer group">
                   <input 
                     type="checkbox" 
                     checked={isSelected}
                     onChange={() => {
                       let next = [...currentSources];
                       if (isSelected) {
                         next = next.filter(s => s !== src.value);
                       } else {
                         next.push(src.value);
                       }
                       setFilters({ ...filters, source_type: next.length ? next.join(',') : null });
                       setPage(1);
                     }}
                     className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" 
                   />
                   <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                     <div className={`w-4 h-4 rounded-full flex items-center justify-center bg-gray-100 dark:bg-white/10 ${src.color}`}>
                       <src.icon className="w-2.5 h-2.5" />
                     </div>
                     {src.label}
                   </span>
                 </label>
               );
             })}
           </div>

           {/* Disabled sources */}
           <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Cần kết nối / Coming soon</p>
           <div className="space-y-2">
             {SOURCE_TYPE_OPTIONS.filter(src => src.disabled).map((src) => {
               const isConnectRequired = src.msg?.toLowerCase().includes('connect');
               return (
                 <div key={src.value} className="flex items-center gap-2 opacity-50 cursor-not-allowed" title={isConnectRequired ? 'Cần kết nối nguồn trước khi sử dụng' : 'Tính năng đang phát triển'}>
                   <input 
                     type="checkbox" 
                     disabled 
                     checked={false}
                     onChange={() => {}}
                     className="rounded border-gray-300 cursor-not-allowed" 
                   />
                   <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-500">
                     <div className={`w-4 h-4 rounded-full flex items-center justify-center bg-gray-100 dark:bg-white/10 ${src.color}`}>
                       <src.icon className="w-2.5 h-2.5" />
                     </div>
                     {src.label}
                   </span>
                   <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider leading-none ${
                     isConnectRequired
                       ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
                       : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                   }`}>
                     {isConnectRequired ? 'Connect' : 'Soon'}
                   </span>
                 </div>
               );
             })}
           </div>
        </div>

        {/* Sentiment Filter */}
        <div className="bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-4">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
               Sentiment <Info className="w-3.5 h-3.5 text-gray-400" />
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
                  className="rounded border-gray-300 text-gray-500 dark:text-gray-500 focus:ring-gray-500" 
               />
               <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Neutral</span>
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
               Influence score <Info className="w-3.5 h-3.5 text-gray-400" />
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
             <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-500 mt-2 font-medium">
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Xác nhận quét</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                Từ khóa bạn đang tìm kiếm (<span className="font-bold text-blue-600">{scanConfirm.keyword}</span>) khác với tên project hiện tại (<span className="font-bold">{activeProject?.name}</span>). Bạn có chắc chắn muốn quét từ khóa này vào project hiện tại không?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setScanConfirm({ isOpen: false, keyword: '' })}
                  className="px-5 py-2 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
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
      
      {/* Delete Confirm Modal */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Xác nhận xóa"
        message="Bạn có chắc muốn xóa mention này không? Hành động này không thể hoàn tác."
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirm({ isOpen: false, mentionId: null, mentionTitle: '' })}
      />
      </>
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
