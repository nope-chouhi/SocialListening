'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Play, Link as LinkIcon, History, AlertTriangle, CheckCircle, XCircle,
  Clock, RefreshCw, Loader2, Activity, Sparkles, Radar, Plus,
  Filter, Eye, EyeOff, CheckSquare, Square, Rss, Globe, FlaskConical,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import { crawl, keywords as keywordsApi, sources as sourcesApi } from '@/lib/api';
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

type SourceFilter = 'all' | 'rss' | 'website' | 'active';

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
  const [scanning, setScanning] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [crawlJobs, setCrawlJobs] = useState<CrawlJob[]>([]);
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null);

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
        result = result.filter((s) => (s.source_type || '').toLowerCase() !== 'rss');
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

  const fetchData = async () => {
    try {
      const [groupsData, sourcesData] = await Promise.all([
        keywordsApi.listGroups(),
        sourcesApi.list(),
      ]);
      setKeywordGroups(groupsData);
      setSources(sourcesData);
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

  // ── Quick Add + Scan ──
  const handleQuickAddAndScan = async () => {
    if (!quickKeyword.trim()) {
      toast.error('Vui lòng nhập từ khóa');
      return;
    }
    const validSources = selectedSources.filter(id => {
      const source = sources.find(s => s.id === id);
      return source && ['rss', 'website'].includes((source.source_type || '').toLowerCase());
    });
    
    if (validSources.length < selectedSources.length) {
      toast('Đã bỏ qua nguồn chưa tích hợp.', { icon: 'ℹ️' });
      setSelectedSources(validSources);
    }

    if (validSources.length === 0 && !customUrl) {
      toast.error('Vui lòng chọn ít nhất 1 nguồn hợp lệ để quét.');
      return;
    }
    
    try {
      setScanning(true);
      const loadingToast = toast.loading('Đang xử lý từ khóa và scan...');
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

      try {
        await keywordsApi.createKeyword({
          keyword: quickKeyword,
          group_id: targetGroupId,
          keyword_type: 'general',
        });
      } catch (error: any) {
        if (error.response?.status === 409) {
          toast('Từ khóa đã tồn tại, sử dụng từ khóa hiện có.', { icon: 'ℹ️' });
        } else {
          throw error;
        }
      }
      
      await fetchData();
      
      const result = await crawl.manualScan({
        keyword_group_ids: [targetGroupId],
        source_ids: validSources.length > 0 ? validSources : undefined,
        url: customUrl || undefined,
      });
      
      toast.dismiss(loadingToast);
      toast.success(`Scan thành công! Tìm thấy ${result.total_mentions_found} mentions mới`);
      
      setQuickKeyword('');
      setSelectedGroups((prev) => Array.from(new Set([...prev, targetGroupId])));
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

  // ── Manual Scan ──
  const handleScan = async () => {
    if (selectedGroups.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 nhóm từ khóa');
      return;
    }
    const validSources = selectedSources.filter(id => {
      const source = sources.find(s => s.id === id);
      return source && ['rss', 'website'].includes((source.source_type || '').toLowerCase());
    });

    if (validSources.length < selectedSources.length) {
      toast('Đã bỏ qua nguồn chưa tích hợp.', { icon: 'ℹ️' });
      setSelectedSources(validSources);
    }

    if (validSources.length === 0 && !customUrl) {
      toast.error('Vui lòng chọn nguồn hoặc nhập URL');
      return;
    }
    try {
      setScanning(true);
      const loadingToast = toast.loading('Đang scan...');
      const result = await crawl.manualScan({
        keyword_group_ids: selectedGroups,
        source_ids: validSources.length > 0 ? validSources : undefined,
        url: customUrl || undefined,
      });
      toast.dismiss(loadingToast);
      toast.success(`Scan thành công! Tìm thấy ${result.total_mentions_found} mentions mới`);
      setSelectedGroups([]);
      setSelectedSources([]);
      setCustomUrl('');
      setShowHistory(true);
      fetchCrawlJobs();
      fetchWorkerStatus();
    } catch (error: any) {
      toast.dismiss();
      toast.error('Lỗi khi scan: ' + (error.response?.data?.detail || error.message));
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
  
  const canScan = selectedGroups.length > 0 && (hasValidSources || isUrlValid);

  // Disable reason text
  const getDisableReason = () => {
    if (selectedGroups.length === 0) return 'Chưa chọn nhóm từ khóa';
    if (selectedSources.length > 0 && validSelectedSources.length === 0) return 'Nguồn đã chọn chưa tích hợp';
    if (customUrl.length > 0 && !isUrlValid) return 'URL tùy chỉnh không hợp lệ';
    return 'Chưa chọn nguồn hợp lệ';
  };

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

  // ── Source filter tabs ──
  const filterTabs: { key: SourceFilter; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'Tất cả', icon: <Globe className="w-3 h-3" /> },
    { key: 'rss', label: 'RSS', icon: <Rss className="w-3 h-3" /> },
    { key: 'website', label: 'Website', icon: <LinkIcon className="w-3 h-3" /> },
    { key: 'active', label: 'Active', icon: <CheckCircle className="w-3 h-3" /> },
  ];

  // Count of valid selectable sources in filtered view
  const selectableCount = filteredSources.filter(
    (s) => ['rss', 'website'].includes((s.source_type || '').toLowerCase())
  ).length;

  // Recent completed job (for quick result display)
  const latestJob = crawlJobs.length > 0 ? crawlJobs[0] : null;

  return (
    <div className="space-y-4 max-w-[1400px]">
      <Toaster position="top-right" />

      {/* ═══════════════════════════════════════════════════════════════════
          1. PAGE HEADER — Compact
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Radar className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide leading-tight">Scan Center</h1>
            <p className="text-xs text-gray-500 mt-0.5">Quét nguồn dữ liệu để thu thập mentions theo nhóm từ khóa.</p>
          </div>
        </div>
        <button
          onClick={() => { fetchWorkerStatus(); fetchCrawlJobs(); fetchData(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 bg-[#111827] hover:bg-[#1E293B] border border-gray-800 rounded-lg transition-all hover:text-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin text-indigo-400' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          2. WORKER STATUS BAR — Compact horizontal
         ═══════════════════════════════════════════════════════════════════ */}
      {workerStatus && (
        <div className={`rounded-lg px-4 py-2.5 border flex flex-wrap items-center gap-x-4 gap-y-1.5 ${
          workerStatus.worker_running
            ? 'bg-emerald-500/5 border-emerald-500/15'
            : 'bg-amber-500/5 border-amber-500/15'
        }`}>
          {/* Status icon + label */}
          <div className="flex items-center gap-2">
            {workerStatus.worker_running ? (
              <Activity className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )}
            <span className={`text-xs font-semibold ${workerStatus.worker_running ? 'text-emerald-400' : 'text-amber-400'}`}>
              {workerStatus.worker_running
                ? (workerStatus.worker_mode === 'embedded' ? 'Worker hoạt động — Embedded' : 'Worker hoạt động')
                : 'Worker không hoạt động'}
            </span>
          </div>

          {/* Embedded warning — compact */}
          {workerStatus.worker_mode === 'embedded' && (
            <span className="text-[10px] text-amber-400/70 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Web Service sleep → RSS không quét 24/7
            </span>
          )}

          {/* Metrics inline — separated by dot */}
          <div className="flex items-center gap-3 ml-auto text-[11px] text-gray-500 font-medium">
            <span>Nguồn: <strong className="text-gray-300">{workerStatus.active_sources}</strong></span>
            <span className="text-gray-800">|</span>
            <span>Chờ scan: <strong className="text-gray-300">{workerStatus.due_sources}</strong></span>
            <span className="text-gray-800">|</span>
            <span>Job: <strong className="text-gray-300">{workerStatus.running_jobs}</strong></span>
            {workerStatus.last_worker_heartbeat && (
              <>
                <span className="text-gray-800">|</span>
                <span>Heartbeat: <strong className="text-gray-300">{formatDate(workerStatus.last_worker_heartbeat)}</strong></span>
              </>
            )}
          </div>

          {/* Error line */}
          {workerStatus.last_error && (
            <div className="w-full mt-1">
              <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/15 inline-block truncate max-w-full" title={workerStatus.last_error}>
                Lỗi: {workerStatus.last_error.substring(0, 120)}{workerStatus.last_error.length > 120 ? '...' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          3. QUICK KEYWORD ADD BAR — Single row
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#111827] rounded-xl border border-gray-800 px-4 py-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="whitespace-nowrap">Thêm nhanh từ khóa</span>
          </div>
          <div className="flex flex-1 flex-col sm:flex-row gap-2">
            <input
              id="quick-keyword-input"
              type="text"
              value={quickKeyword}
              onChange={(e) => setQuickKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
              placeholder="Nhập từ khóa (VD: Vinfast, iPhone 16...)"
              className="flex-1 min-w-0 px-3 py-2 bg-[#1E293B] border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white text-sm placeholder-gray-500"
            />
            <select
              id="quick-keyword-group"
              value={quickGroupId}
              onChange={(e) => setQuickGroupId(e.target.value ? Number(e.target.value) : '')}
              className="sm:w-44 px-3 py-2 bg-[#1E293B] border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white text-xs"
            >
              <option value="">-- Nhóm mặc định --</option>
              {keywordGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleQuickAdd}
                disabled={addingKeyword || !quickKeyword.trim()}
                className="px-3 py-2 bg-[#1E293B] text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center text-xs font-medium whitespace-nowrap transition-colors"
              >
                {addingKeyword ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                Thêm vào nhóm
              </button>
              <button
                onClick={handleQuickAddAndScan}
                disabled={scanning || !quickKeyword.trim()}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center text-xs font-medium whitespace-nowrap transition-colors shadow-sm shadow-indigo-500/20"
              >
                {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Radar className="w-3.5 h-3.5 mr-1.5" />}
                Thêm và quét
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          4. MANUAL SCAN CONTROL PANEL — Compact unified card
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#111827] rounded-xl border border-gray-800 overflow-hidden">

        {/* ── 4A. Keyword Groups ───────────────────────────────────────── */}
        <div className="px-4 py-3 border-b border-gray-800/80">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              Nhóm từ khóa <span className="text-rose-500">*</span>
            </label>
            {selectedGroups.length > 0 && (
              <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {selectedGroups.length} nhóm đã chọn
              </span>
            )}
          </div>
          {keywordGroups.length === 0 ? (
            <p className="text-xs text-gray-500 bg-gray-800/50 p-2.5 rounded-lg border border-gray-700">
              Chưa có nhóm từ khóa. Hãy tạo nhóm từ khóa trước!
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {keywordGroups.map((group) => (
                <label
                  key={group.id}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer transition-all text-xs font-medium ${
                    selectedGroups.includes(group.id)
                      ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                      : 'bg-[#1E293B] hover:bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(group.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedGroups([...selectedGroups, group.id]);
                      } else {
                        setSelectedGroups(selectedGroups.filter((id) => id !== group.id));
                      }
                    }}
                    className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-gray-800 h-3.5 w-3.5"
                  />
                  {group.name}
                  <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{group.keyword_count || 0} kw</span>
                </label>
              ))}
            </div>
          )}
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
                  const isSupported = ['rss', 'website'].includes((source.source_type || '').toLowerCase());
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
                              {source.name}
                              {test && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-orange-500/10 text-orange-400 border border-orange-500/15 flex-shrink-0">
                                  <FlaskConical className="w-2.5 h-2.5" />
                                  test
                                </span>
                              )}
                              {isUnsupported && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/15 flex-shrink-0">
                                  Chưa tích hợp
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-600 truncate max-w-xs mt-0.5">{source.url}</div>
                            {source.last_error && (
                              <div className="text-[10px] text-rose-400 mt-1 truncate max-w-sm" title={source.last_error}>
                                ⚠ {source.last_error.substring(0, 80)}{source.last_error.length > 80 ? '...' : ''}
                              </div>
                            )}
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

        {/* ── 4E. Start Scan Button ─────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-gray-800/80 bg-[#0B1220]/50">
          <button
            id="start-scan-btn"
            onClick={handleScan}
            disabled={scanning || !canScan}
            className={`w-full flex items-center justify-center px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
              canScan
                ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.98]'
                : 'bg-gray-800/80 text-gray-500 cursor-not-allowed border border-gray-700/50'
            }`}
          >
            {scanning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {scanning
              ? 'Đang Scan...'
              : canScan
                ? `Bắt đầu Scan (${validSelectedSources.length > 0 ? validSelectedSources.length + ' nguồn' : '1 URL'}, ${selectedGroups.length} nhóm)`
                : getDisableReason()
            }
          </button>
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
