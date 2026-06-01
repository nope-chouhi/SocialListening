'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Play, Link as LinkIcon, History, AlertTriangle, CheckCircle, XCircle,
  Clock, RefreshCw, Loader2, Activity, Sparkles, Radar, Plus,
  Filter, Eye, EyeOff, CheckSquare, Square, Rss, Globe, FlaskConical,
  ChevronDown, ChevronUp, ExternalLink, Search, Globe2, Network,
} from 'lucide-react';
import { crawl, keywords as keywordsApi, sources as sourcesApi, discovery as discoveryApi, getErrorMessage } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

interface WorkerStatus {
  scheduler_enabled: boolean;
  worker_mode: string;
  worker_running: boolean;
  last_worker_heartbeat: string | null;
  active_sources: number;
  due_sources: number;
  running_jobs: number;
  last_error: string | null;
}

interface CrawlJob {
  id: number;
  job_type: string;
  source_ids: number[] | null;
  status: string;
  total_sources: number;
  processed_sources: number;
  mentions_found: number;
  error_message: string | null;
  retry_count: number;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

type SourceFilter = 'all' | 'rss' | 'website' | 'global_search' | 'active';

const TEST_SOURCE_PATTERNS = [
  'example.com',
  'daily source',
  'weekly source',
  'monthly source',
  'yearly source',
];

function isTestSource(source: any): boolean {
  const url = (source.url || '').toLowerCase();
  const name = (source.name || '').toLowerCase();
  return TEST_SOURCE_PATTERNS.some(
    (p) => url.includes(p) || name.includes(p)
  );
}

export default function ScanPage() {
  const [keywordGroups, setKeywordGroups] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [selectedSources, setSelectedSources] = useState<number[]>([]);
  const [customUrl, setCustomUrl] = useState('');
  const [scanMode, setScanMode] = useState<string>('AUTO_DISCOVERY');
  const [scanCapabilities, setScanCapabilities] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [crawlJobs, setCrawlJobs] = useState<CrawlJob[]>([]);
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null);

  // Auto Discovery state
  const [discoveryLimit, setDiscoveryLimit] = useState(20);
  const [discoveryDateRange, setDiscoveryDateRange] = useState('last_30_days');
  const [discoveryLanguage, setDiscoveryLanguage] = useState('vi');
  const [discoveryCountry, setDiscoveryCountry] = useState('vn');
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<any>(null);

  // Quick keyword states
  const [quickKeyword, setQuickKeyword] = useState('');
  const [quickGroupId, setQuickGroupId] = useState<number | ''>('');
  const [addingKeyword, setAddingKeyword] = useState(false);

  // Source filter states
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [hideTestSources, setHideTestSources] = useState(true);

  // UI state
  const [showCustomUrl, setShowCustomUrl] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Filtered sources
  const filteredSources = useMemo(() => {
    let result = sources;

    // Hide test sources
    if (hideTestSources) {
      result = result.filter((s) => !isTestSource(s));
    }

    // Apply type filter
    switch (sourceFilter) {
      case 'rss':
        result = result.filter((s) => (s.source_type || '').toLowerCase() === 'rss');
        break;
      case 'website':
        result = result.filter((s) => ['website', 'manual_url', 'forum'].includes((s.source_type || '').toLowerCase()));
        break;
      case 'global_search':
        result = result.filter((s) => (s.source_type || '').toLowerCase() === 'global_search');
        break;
      case 'active':
        result = result.filter((s) => s.is_active);
        break;
    }

    return result;
  }, [sources, sourceFilter, hideTestSources]);

  const realSourceCount = useMemo(
    () => sources.filter((s) => !isTestSource(s)).length,
    [sources]
  );

  useEffect(() => {
    fetchData();
    fetchWorkerStatus();
    fetchCrawlJobs();
  }, []);

  // Poll for job updates if any job is running
  useEffect(() => {
    const hasRunningJob = crawlJobs.some(j => j.status === 'running' || j.status === 'pending');
    if (hasRunningJob) {
      const interval = setInterval(() => {
        fetchWorkerStatus();
        fetchCrawlJobs();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [crawlJobs]);

  const fetchData = async () => {
    try {
      const [groupsData, sourcesData, capsData] = await Promise.all([
        keywordsApi.listGroups(),
        sourcesApi.list(),
        crawl.getCapabilities(),
      ]);
      setKeywordGroups(groupsData);
      setSources(sourcesData);
      setScanCapabilities(capsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchWorkerStatus = async () => {
    try {
      const data = await crawl.getWorkerStatus();
      setWorkerStatus(data);
    } catch (error) {
      console.error('Error fetching worker status:', error);
    }
  };

  const fetchCrawlJobs = async () => {
    try {
      const data = await crawl.getJobs(1, 20);
      setCrawlJobs(data.items || []);
    } catch (error) {
      console.error('Error fetching crawl jobs:', error);
    }
  };

  // ── Quick Add keyword (no scan) ──
  const handleQuickAdd = async () => {
    if (!quickKeyword.trim()) {
      toast.error('Vui lòng nhập từ khóa');
      return;
    }
    try {
      setAddingKeyword(true);
      let targetGroupId = quickGroupId as number;
      if (!targetGroupId) {
        if (keywordGroups.length > 0) {
          targetGroupId = keywordGroups[0].id;
        } else {
          const newGroup = await keywordsApi.createGroup({
            name: 'Nhóm Mặc Định',
            description: 'Tự động tạo từ Scan Center',
          });
          targetGroupId = newGroup.id;
        }
      }
      await keywordsApi.createKeyword({
        keyword: quickKeyword,
        group_id: targetGroupId,
        keyword_type: 'general',
      });
      toast.success(`Đã thêm từ khóa "${quickKeyword}" vào nhóm`);
      setQuickKeyword('');
      await fetchData();
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast('Từ khóa đã tồn tại trong nhóm này', { icon: 'ℹ️' });
        setQuickKeyword('');
        return;
      }
      toast.error('Lỗi: ' + (error.response?.data?.detail || error.message));
    } finally {
      setAddingKeyword(false);
    }
  };

  // ── Unified Scan Handler ──
  const handleScanSubmit = async () => {
    const hasKeyword = quickKeyword.trim().length > 0 || selectedGroups.length > 0;
    if (!hasKeyword) {
      toast.error('Vui lòng nhập hoặc chọn ít nhất 1 từ khóa.');
      return;
    }

    const validSources = selectedSources.filter(id => {
      const source = sources.find(s => s.id === id);
      return source && ['rss', 'website', 'global_search'].includes((source.source_type || '').toLowerCase());
    });
    
    if (validSources.length < selectedSources.length) {
      toast('Đã bỏ qua nguồn chưa tích hợp.', { icon: 'ℹ️' });
      setSelectedSources(validSources);
    }

    if (scanMode === 'SELECTED_SOURCES' && validSources.length === 0 && !customUrl) {
      toast.error('Vui lòng chọn ít nhất 1 nguồn để quét.');
      return;
    }
    
    try {
      setScanning(true);
      const loadingToast = toast.loading('Đang xử lý và quét dữ liệu...');
      
      let finalKeywordGroups = [...selectedGroups];
      let finalKeywords = [];

      if (quickKeyword.trim()) {
        finalKeywords.push(quickKeyword.trim());
        if (quickGroupId) {
          try {
            await keywordsApi.createKeyword({
              keyword: quickKeyword.trim(),
              group_id: quickGroupId as number,
              keyword_type: 'general',
            });
            if (!finalKeywordGroups.includes(quickGroupId as number)) {
              finalKeywordGroups.push(quickGroupId as number);
            }
          } catch (error: any) {
            if (error.response?.status !== 409) {
              console.error('Error creating quick keyword:', error);
            }
          }
        }
      }

      await fetchData();
      
      const payload: any = {
        keyword_group_ids: finalKeywordGroups,
        mode: scanMode,
        source_ids: validSources,
      };

      if (finalKeywords.length > 0) {
        payload.keywords = finalKeywords;
      }
      
      if (customUrl) {
        payload.url = customUrl;
      }
      
      const result = await crawl.manualScan(payload);
      
      toast.dismiss(loadingToast);
      toast.success(result.message || 'Đã tạo job scan. Hệ thống đang quét trong nền.');
      
      setQuickKeyword('');
      setShowHistory(true);
      fetchCrawlJobs();
      fetchWorkerStatus();
    } catch (error: any) {
      toast.dismiss();
      toast.error('Lỗi: ' + (error.response?.data?.detail || error.message));
    } finally {
      setScanning(false);
    }
  };

  const handleRetry = async (jobId: number) => {
    try {
      setRetryingJobId(jobId);
      const result = await crawl.retryJob(jobId);
      toast.success(`Retry thành công! Tìm thấy ${result.mentions_found} mentions`);
      fetchCrawlJobs();
      fetchWorkerStatus();
    } catch (error: any) {
      toast.error('Retry thất bại: ' + (error.response?.data?.detail || error.message));
    } finally {
      setRetryingJobId(null);
    }
  };



  // ── Quick actions for sources ──
  const selectAllVisible = () => {
    const ids = filteredSources
      .filter((s) => ['rss', 'website'].includes((s.source_type || '').toLowerCase()))
      .map((s) => s.id);
    setSelectedSources((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearSelection = () => {
    setSelectedSources([]);
  };

  const validSelectedSources = selectedSources.filter(id => {
    const s = sources.find(src => src.id === id);
    return s && ['rss', 'website'].includes((s.source_type || '').toLowerCase());
  });
  
  const hasValidSources = validSelectedSources.length > 0;
  const isUrlValid = customUrl.trim().length > 0;
  const isAutoDiscoveryConfigured = scanCapabilities?.auto_discovery?.configured;
  
  const hasKeyword = quickKeyword.trim().length > 0 || selectedGroups.length > 0;

  const canScan = hasKeyword && 
    (scanMode !== 'SELECTED_SOURCES' || hasValidSources || isUrlValid) && 
    (scanMode !== 'AUTO_DISCOVERY' || isAutoDiscoveryConfigured);

  // Disable reason text
  const getDisableReason = () => {
    if (!hasKeyword) return 'Vui lòng nhập hoặc chọn ít nhất 1 từ khóa';
    if (scanMode === 'AUTO_DISCOVERY' && !isAutoDiscoveryConfigured) return 'Cần cấu hình SERPAPI_API_KEY để tự tìm nguồn';
    if (scanMode === 'SELECTED_SOURCES') {
      if (selectedSources.length > 0 && validSelectedSources.length === 0) return 'Nguồn đã chọn chưa tích hợp';
      if (customUrl.length > 0 && !isUrlValid) return 'URL tùy chỉnh không hợp lệ';
      return 'Vui lòng chọn ít nhất 1 nguồn để quét';
    }
    return '';
  };

  // Update scanMode when selectedSources change
  useEffect(() => {
    if (selectedSources.length > 0 && scanMode === 'AUTO_DISCOVERY') {
      setScanMode('HYBRID');
    } else if (selectedSources.length === 0 && scanMode === 'HYBRID') {
      setScanMode(isAutoDiscoveryConfigured === false ? 'ALL_ACTIVE_SOURCES' : 'AUTO_DISCOVERY');
    }
  }, [selectedSources, isAutoDiscoveryConfigured]);

  useEffect(() => {
    if (isAutoDiscoveryConfigured === false && scanMode === 'AUTO_DISCOVERY') {
      setScanMode('ALL_ACTIVE_SOURCES');
    }
  }, [isAutoDiscoveryConfigured]);

  // ── Badge helpers ──
  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
      completed: { bg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', icon: <CheckCircle className="w-3 h-3 mr-1" />, label: 'Xong' },
      running: { bg: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20', icon: <Loader2 className="w-3 h-3 mr-1 animate-spin" />, label: 'Đang chạy' },
      failed: { bg: 'bg-rose-500/10 text-rose-400 border border-rose-500/20', icon: <XCircle className="w-3 h-3 mr-1" />, label: 'Thất bại' },
      pending: { bg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', icon: <Clock className="w-3 h-3 mr-1" />, label: 'Chờ' },
      cancelled: { bg: 'bg-[#1E293B] text-gray-400 border border-gray-700', icon: <XCircle className="w-3 h-3 mr-1" />, label: 'Hủy' },
    };
    const s = map[status] || { bg: 'bg-[#1E293B] text-gray-400 border border-gray-700', icon: null, label: status };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${s.bg}`}>
        {s.icon}{s.label}
      </span>
    );
  };

  const getJobTypeBadge = (jobType: string) => {
    const styles: Record<string, string> = {
      manual: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
      scheduled: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
      retry: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    };
    const labels: Record<string, string> = {
      manual: 'Thủ công',
      scheduled: 'Tự động',
      retry: 'Retry',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${styles[jobType] || 'bg-[#1E293B] text-gray-400 border border-gray-700'}`}>
        {labels[jobType] || jobType}
      </span>
    );
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  const filterTabs: { key: SourceFilter; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'Tất cả', icon: <Globe className="w-3 h-3" /> },
    { key: 'rss', label: 'RSS', icon: <Rss className="w-3 h-3" /> },
    { key: 'website', label: 'Website', icon: <LinkIcon className="w-3 h-3" /> },
    { key: 'global_search', label: 'Global Search', icon: <Sparkles className="w-3 h-3" /> },
    { key: 'active', label: 'Active', icon: <CheckCircle className="w-3 h-3" /> },
  ];

  // Count of valid selectable sources in filtered view
  const selectableCount = filteredSources.filter(
    (s) => ['rss', 'website', 'global_search'].includes((s.source_type || '').toLowerCase())
  ).length;

  // Recent completed job (for quick result display)
  const latestJob = crawlJobs.length > 0 ? crawlJobs[0] : null;

  return (
    <div className="space-y-4 max-w-[1400px]">
      <Toaster position="top-right" />

      {/* ═══════════════════════════════════════════════════════════════════
          1. PAGE HEADER
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-12 h-12">
            <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-md" />
            <Radar className="w-6 h-6 text-emerald-400 relative z-10" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-100 tracking-wide">
              Trung tâm quét dữ liệu
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Quét theo từ khóa, tự tìm nguồn hoặc quét các nguồn đã cấu hình
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 rounded text-xs font-medium border ${isAutoDiscoveryConfigured ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`} title={!isAutoDiscoveryConfigured ? 'Cần cấu hình SERPAPI_API_KEY' : undefined}>
            Tự tìm nguồn: {isAutoDiscoveryConfigured ? 'Sẵn sàng' : 'Chưa cấu hình'}
          </span>
          <button
            onClick={() => { fetchWorkerStatus(); fetchCrawlJobs(); fetchData(); }}
            className="group relative flex items-center gap-2 px-4 py-2 text-xs font-medium text-emerald-400 bg-gray-900 border border-emerald-500/30 rounded-lg transition-all hover:bg-emerald-900 hover:border-emerald-400"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            Đồng bộ
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          2. WORKER STATUS BAR — Terminal horizontal
         ═══════════════════════════════════════════════════════════════════ */}
      {workerStatus && (
        <div className={`rounded font-mono px-4 py-3 border shadow-inner flex flex-wrap items-center gap-x-4 gap-y-1.5 ${
          workerStatus.worker_running
            ? 'bg-[#021008] border-emerald-500/30 text-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]'
            : 'bg-[#150a0a] border-rose-500/30 text-rose-400 shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]'
        }`}>
          {/* Status icon + label */}
          <div className="flex items-center gap-2">
            {workerStatus.worker_running ? (
              <Activity className="w-4 h-4 animate-pulse flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="text-[11px] font-bold tracking-wider">
              {workerStatus.worker_running
                ? (workerStatus.worker_mode === 'embedded' ? 'SYS.WORKER // EMBEDDED_MODE' : 'SYS.WORKER // ONLINE')
                : 'SYS.WORKER // OFFLINE'}
            </span>
          </div>

          {/* Embedded warning */}
          {workerStatus.worker_mode === 'embedded' && (
            <span className="text-[10px] text-amber-500/80 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              <AlertTriangle className="w-3 h-3" />
              BACKGROUND_CRON_DISABLED
            </span>
          )}

          {/* Metrics inline */}
          <div className="flex items-center gap-3 ml-auto text-[11px] font-medium opacity-80">
            <span>TARGETS: <strong>{workerStatus.active_sources}</strong></span>
            <span className="opacity-30">|</span>
            <span>QUEUE: <strong>{workerStatus.due_sources}</strong></span>
            <span className="opacity-30">|</span>
            <span>ACTIVE_JOBS: <strong>{workerStatus.running_jobs}</strong></span>
            {workerStatus.last_worker_heartbeat && (
              <>
                <span className="opacity-30">|</span>
                <span>PING: <strong>{formatDate(workerStatus.last_worker_heartbeat)}</strong></span>
              </>
            )}
          </div>

          {/* Error line */}
          {workerStatus.last_error && (
            <div className="w-full mt-2 pt-2 border-t border-rose-500/20">
              <span className="text-[10px] text-rose-400 font-bold tracking-wider inline-block truncate max-w-full">
                [ERR] {workerStatus.last_error}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          3. MAIN SCAN INPUT CARD
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#0f172a] rounded-xl border border-gray-800 p-6 shadow-lg mb-6 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-5">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Từ khóa cần quét
              </label>
              <div className="flex gap-3">
                <input
                  id="quick-keyword-input"
                  type="text"
                  value={quickKeyword}
                  onChange={(e) => setQuickKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScanSubmit()}
                  placeholder="Nhập từ khóa cần theo dõi, ví dụ: Bệnh viện TTH"
                  className="flex-1 bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                />
                <select
                  id="quick-keyword-group"
                  value={quickGroupId}
                  onChange={(e) => setQuickGroupId(e.target.value ? Number(e.target.value) : '')}
                  className="w-48 bg-[#1e293b] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Dự án / Nhãn hiệu --</option>
                  {keywordGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Chế độ quét</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'AUTO_DISCOVERY', label: 'Tự tìm nguồn', disabled: !isAutoDiscoveryConfigured },
                  { id: 'HYBRID', label: 'Kết hợp' },
                  { id: 'SELECTED_SOURCES', label: 'Nguồn đã chọn' },
                  { id: 'ALL_ACTIVE_SOURCES', label: 'Tất cả nguồn đang bật' }
                ].map(mode => (
                  <div key={mode.id} className="group relative">
                    <label
                      className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-all text-sm font-medium ${
                        mode.disabled
                          ? 'bg-gray-900/50 border-gray-800 text-gray-600 cursor-not-allowed'
                          : scanMode === mode.id
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 cursor-pointer'
                            : 'bg-[#1e293b] hover:bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 cursor-pointer'
                      }`}
                      title={mode.disabled ? "Chưa cấu hình Web Search provider" : undefined}
                    >
                      <input
                        type="radio"
                        name="scanMode"
                        value={mode.id}
                        checked={scanMode === mode.id}
                        onChange={() => {
                          if (!mode.disabled) setScanMode(mode.id);
                        }}
                        disabled={mode.disabled}
                        className={`rounded-full border-gray-600 focus:ring-emerald-500 bg-gray-800 h-4 w-4 ${mode.disabled ? 'opacity-50 cursor-not-allowed' : 'text-emerald-500'}`}
                      />
                      {mode.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-4 flex flex-col justify-end gap-3 lg:border-l lg:border-gray-800 lg:pl-6">
            <div className="mb-auto">
               <p className="text-xs text-gray-400 leading-relaxed">
                 {getDisableReason() ? (
                   <span className="text-rose-400 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4"/> {getDisableReason()}</span>
                 ) : (
                   <span className="text-emerald-400 flex items-center gap-1.5"><CheckCircle className="w-4 h-4"/> Sẵn sàng quét</span>
                 )}
               </p>
            </div>
            <button
              onClick={handleScanSubmit}
              disabled={scanning || !canScan}
              className="w-full px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all"
            >
              {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Radar className="w-5 h-5" />}
              Bắt đầu quét
            </button>
            <button
              onClick={handleQuickAdd}
              disabled={addingKeyword || !quickKeyword.trim()}
              className="w-full px-6 py-2.5 bg-gray-800 text-gray-300 font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-700 transition-all"
            >
              {addingKeyword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Chỉ thêm từ khóa
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          4. SOURCE SELECTION CARD (Optional)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#0f172a] border border-gray-800 rounded-xl mb-6">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-gray-100 flex items-center gap-2">
            Nguồn tùy chọn
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Chỉ cần chọn nguồn khi muốn giới hạn phạm vi quét. Nếu không chọn, hệ thống sẽ tự tìm nguồn theo từ khóa.
          </p>
        </div>

        {/* ── 4B. Source Filters + Quick Actions ─────────────────────── */}
        <div className="px-4 py-2.5 border-b border-gray-800/80 flex flex-wrap items-center gap-2">
          {/* Filter tabs */}
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mr-1">Nguồn:</span>
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSourceFilter(tab.key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                sourceFilter === tab.key
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25'
                  : 'bg-[#0B1220] text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => setHideTestSources(!hideTestSources)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              hideTestSources
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/15'
                : 'bg-[#0B1220] text-gray-500 hover:text-gray-300 border border-gray-800'
            }`}
            title={hideTestSources ? 'Test sources đang ẩn' : 'Hiện tất cả sources'}
          >
            {hideTestSources ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {hideTestSources ? 'Ẩn test' : 'Hiện test'}
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={selectAllVisible}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <CheckSquare className="w-3 h-3" />
              Chọn tất cả
            </button>
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Square className="w-3 h-3" />
              Bỏ chọn
            </button>
            <span className="text-[10px] text-gray-600 font-medium border-l border-gray-800 pl-2 ml-1">
              <span className="text-indigo-400">{validSelectedSources.length}</span>/{selectableCount} nguồn hợp lệ
            </span>
          </div>
        </div>

        {/* ── 4C. Source Table — scrollable ──────────────────────────── */}
        <div className="max-h-[340px] overflow-y-auto scrollbar-hide">
          {filteredSources.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Globe className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-medium">
                {realSourceCount === 0
                  ? 'Chưa có nguồn thật để quét. Hãy thêm nguồn RSS/Web trước.'
                  : 'Không có nguồn nào phù hợp bộ lọc.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#0B1220] text-left text-[10px] text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2 w-8 font-medium"></th>
                  <th className="px-3 py-2 font-medium">Nguồn</th>
                  <th className="px-3 py-2 hidden md:table-cell font-medium w-20">Loại</th>
                  <th className="px-3 py-2 hidden lg:table-cell font-medium w-16">Status</th>
                  <th className="px-3 py-2 hidden xl:table-cell font-medium w-24">Crawl gần nhất</th>
                  <th className="px-3 py-2 hidden xl:table-cell font-medium w-24">Crawl tiếp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredSources.map((source: any) => {
                  const test = isTestSource(source);
                  const isSupported = ['rss', 'website', 'global_search'].includes((source.source_type || '').toLowerCase());
                  const isUnsupported = !isSupported && source.source_type;
                  const isSelected = selectedSources.includes(source.id);

                  return (
                    <tr
                      key={source.id}
                      className={`transition-colors ${
                        !isSupported ? 'opacity-50' : 'hover:bg-[#1E293B]/60 cursor-pointer'
                      } ${isSelected ? 'bg-indigo-500/5' : ''}`}
                      onClick={() => {
                        if (!isSupported) return;
                        if (isSelected) {
                          setSelectedSources(selectedSources.filter((id) => id !== source.id));
                        } else {
                          setSelectedSources([...selectedSources, source.id]);
                          setCustomUrl('');
                        }
                      }}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isSupported}
                          onChange={() => {}}
                          className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-gray-800 pointer-events-none disabled:opacity-40 h-3.5 w-3.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-300 truncate flex items-center gap-1.5 flex-wrap text-xs">
                              <span title={source.name}>{source.name}</span>
                              {(() => {
                                if (isUnsupported) {
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-gray-500/10 text-gray-400 border border-gray-500/20">
                                      Chưa hỗ trợ
                                    </span>
                                  );
                                }
                                if (test) {
                                  return (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-gray-500/10 text-gray-400 border border-gray-500/20">
                                      <FlaskConical className="w-2.5 h-2.5" />
                                      Nguồn test
                                    </span>
                                  );
                                }
                                const error = source.last_error;
                                const isInvalidRss = error && (error.includes('invalid_rss_feed') || 
                                                     error.includes('Feed parse error') || 
                                                     error.includes('not well-formed') ||
                                                     error.includes('invalid token') ||
                                                     (source.source_type === 'rss' && error.includes('not well-formed')));
                                const isAiConfigError = error && (error.includes('ai_provider_not_configured') || 
                                                        error.includes('openai_dependency_missing') || 
                                                        error.includes('AI chưa cấu hình') ||
                                                        error.includes('thiếu package openai') ||
                                                        error.includes('openai package not installed'));
                                
                                if (isInvalidRss) {
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 flex-shrink-0">
                                      RSS không hợp lệ
                                    </span>
                                  );
                                } else if (error && !isAiConfigError) {
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 flex-shrink-0">
                                      Lỗi crawl
                                    </span>
                                  );
                                } else if (source.last_crawled_at) {
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                                      Quét thành công
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-gray-500/10 text-gray-400 border border-gray-500/20 flex-shrink-0">
                                      Chưa crawl
                                    </span>
                                  );
                                }
                              })()}
                            </div>
                            <div className="text-[10px] text-gray-600 truncate max-w-xs mt-0.5">{source.url}</div>
                            {(() => {
                              if (isUnsupported || test) return null;
                              
                              const error = source.last_error;
                              const isAiConfigError = error && (error.includes('ai_provider_not_configured') || 
                                                      error.includes('openai_dependency_missing') || 
                                                      error.includes('AI chưa cấu hình') ||
                                                      error.includes('thiếu package openai') ||
                                                      error.includes('openai package not installed'));
                              
                              if (isAiConfigError) {
                                 return (
                                   <div className="mt-1 flex items-center gap-1">
                                     <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                       AI chưa cấu hình
                                     </span>
                                     <span className="text-[10px] text-gray-500 truncate" title="Mention đã thu thập, nhưng AI chưa phân tích do thiếu package.">
                                       Mention đã thu thập, thiếu package.
                                     </span>
                                   </div>
                                 );
                              } else if (source.last_crawled_at && (!error || error === '')) {
                                 return (
                                   <div className="mt-1 flex items-center gap-1">
                                     <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                       AI đã phân tích
                                     </span>
                                   </div>
                                 );
                              }
                              return null;
                            })()}
                            
                            {source.last_error && (() => {
                              const error = source.last_error;
                              const isInvalidRss = error.includes('invalid_rss_feed') || 
                                                   error.includes('Feed parse error') || 
                                                   error.includes('not well-formed') ||
                                                   error.includes('invalid token') ||
                                                   ((source.source_type || '').toLowerCase() === 'rss' && error.includes('not well-formed'));
                              if (isInvalidRss) {
                                return (
                                  <div className="text-[10px] text-rose-400 mt-1 truncate max-w-sm" title="URL này là trang web, không phải RSS feed. Hãy đổi loại nguồn sang Website.">
                                    ⚠ RSS không hợp lệ: URL hiện tại là trang web.
                                  </div>
                                );
                              }
                              
                              // Check if AI error, if so, DO NOT display as crawl error!
                              const isAiConfigError = error.includes('ai_provider_not_configured') || 
                                                      error.includes('openai_dependency_missing') || 
                                                      error.includes('AI chưa cấu hình') ||
                                                      error.includes('thiếu package openai') ||
                                                      error.includes('openai package not installed');
                              if (isAiConfigError) {
                                return null;
                              }
                              
                              let cleanMsg = error;
                              if (error.includes(': ')) {
                                const parts = error.split(': ');
                                if (parts.length > 1) {
                                  cleanMsg = parts.slice(1).join(': ');
                                }
                              }
                              
                              if (test) {
                                return (
                                  <div className="text-[10px] text-gray-500 mt-1 truncate max-w-sm" title={error}>
                                    ⚠ {cleanMsg} (lỗi test)
                                  </div>
                                );
                              }
                              
                              return (
                                <div className="text-[10px] text-rose-400 mt-1 truncate max-w-sm" title={error}>
                                  ⚠ {cleanMsg}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                          (source.source_type || '').toLowerCase() === 'rss'
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/15'
                            : isUnsupported ? 'bg-gray-800 text-gray-500 border-gray-700' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/15'
                        }`}>
                          {(source.source_type || '').toLowerCase() === 'rss' ? (
                            <Rss className="w-2.5 h-2.5" />
                          ) : (
                            <Globe className="w-2.5 h-2.5" />
                          )}
                          {source.source_type || 'web'}
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${source.is_active ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]' : 'bg-gray-600'}`} />
                          <span className="text-[10px] text-gray-500">{source.is_active ? 'On' : 'Off'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden xl:table-cell text-[10px] text-gray-500">
                        {formatDate(source.last_crawled_at)}
                      </td>
                      <td className="px-3 py-2 hidden xl:table-cell text-[10px] text-gray-500">
                        {formatDate(source.next_crawl_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── 4D. Custom URL — Collapsible ──────────────────────────── */}
        <div className="px-4 py-2 border-t border-gray-800/80">
          <button
            onClick={() => setShowCustomUrl(!showCustomUrl)}
            className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 font-medium transition-colors"
          >
            {showCustomUrl ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <LinkIcon className="w-3 h-3" />
            Hoặc nhập URL tùy chỉnh
          </button>
          {showCustomUrl && (
            <div className="mt-2 relative animate-fadeIn">
              <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
              <input
                id="custom-url-input"
                type="url"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  if (e.target.value) setSelectedSources([]);
                }}
                placeholder="https://example.com hoặc https://example.com/rss"
                className="w-full pl-9 pr-3 py-2 bg-[#0B1220] border border-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white text-xs placeholder-gray-500 transition-shadow"
              />
            </div>
          )}
        </div>
      </div>



      {/* ═══════════════════════════════════════════════════════════════════
          5. LATEST SCAN RESULT — Compact card (only if exists)
         ═══════════════════════════════════════════════════════════════════ */}
      {latestJob && (
        <div className={`rounded-xl border px-4 py-3 flex flex-wrap items-center gap-3 ${
          latestJob.status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/15' :
          latestJob.status === 'failed' ? 'bg-rose-500/5 border-rose-500/15' :
          latestJob.status === 'running' ? 'bg-indigo-500/5 border-indigo-500/15' :
          'bg-gray-800/30 border-gray-800'
        }`}>
          <div className="flex items-center gap-2">
            {getStatusBadge(latestJob.status)}
            {getJobTypeBadge(latestJob.job_type)}
            <span className="text-[10px] text-gray-500 font-mono">#{latestJob.id}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
            <span>Nguồn: <strong className="text-gray-300">{latestJob.processed_sources}/{latestJob.total_sources}</strong></span>
            <span>Mentions: <strong className="text-gray-300">{latestJob.mentions_found}</strong></span>
            {latestJob.completed_at && <span>Xong: {formatDate(latestJob.completed_at)}</span>}
          </div>
          {latestJob.mentions_found > 0 && (
            <Link
              href="/dashboard/mentions"
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Xem mentions
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
          {latestJob.error_message && (
            <div className="w-full mt-1">
              <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/15 inline-block truncate max-w-full" title={latestJob.error_message}>
                ❌ {latestJob.error_message.substring(0, 120)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          6. CRAWL JOBS HISTORY — Collapsible
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#111827] rounded-xl border border-gray-800 overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1E293B]/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Lịch Sử Crawl Jobs</h2>
            <span className="text-[10px] text-gray-500 font-medium bg-gray-800 px-2 py-0.5 rounded">{crawlJobs.length}</span>
          </div>
          {showHistory ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>

        {showHistory && (
          <div className="border-t border-gray-800/80 divide-y divide-gray-800/60 max-h-[340px] overflow-y-auto scrollbar-hide">
            {crawlJobs.length === 0 ? (
              <p className="text-gray-500 text-center py-6 text-xs font-medium">Chưa có lịch sử scan</p>
            ) : (
              crawlJobs.map((job) => (
                <div key={job.id} className="px-4 py-3 hover:bg-[#1E293B]/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getJobTypeBadge(job.job_type)}
                      {getStatusBadge(job.status)}
                      <span className="text-[10px] text-gray-600 font-mono">#{job.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-300 font-medium">{job.mentions_found} mentions</span>
                      {(job.status === 'failed' || job.status === 'cancelled') && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          disabled={retryingJobId === job.id}
                          className="flex items-center px-2 py-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/15 rounded-md hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                        >
                          {retryingJobId === job.id ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3 mr-1" />
                          )}
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-medium text-gray-500">
                    <span>Nguồn: <strong className="text-gray-400">{job.processed_sources}/{job.total_sources}</strong></span>
                    {job.status === 'completed' && job.total_sources > job.processed_sources && (
                      <span className="text-rose-400">Thất bại: {job.total_sources - job.processed_sources} nguồn</span>
                    )}
                    {job.created_at && <span>Tạo: {formatDate(job.created_at)}</span>}
                    {job.completed_at && <span>Xong: {formatDate(job.completed_at)}</span>}
                    {job.retry_count > 0 && <span className="text-amber-400">Retry #{job.retry_count}</span>}
                  </div>
                  {job.error_message && (
                    <p className="mt-1.5 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/15 truncate" title={job.error_message}>
                      ❌ {job.error_message}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
