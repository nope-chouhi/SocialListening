'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Play, Link as LinkIcon, History, AlertTriangle, CheckCircle, XCircle,
  Clock, RefreshCw, Loader2, Activity, Sparkles, Radar, Plus,
  Filter, Eye, EyeOff, CheckSquare, Square, Rss, Globe, FlaskConical
} from 'lucide-react';
import { crawl, keywords as keywordsApi, sources as sourcesApi } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';

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

  // ── Badge helpers ──
  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
      completed: { bg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', icon: <CheckCircle className="w-3 h-3 mr-1.5" />, label: 'Hoàn thành' },
      running: { bg: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20', icon: <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />, label: 'Đang chạy' },
      failed: { bg: 'bg-rose-500/10 text-rose-400 border border-rose-500/20', icon: <XCircle className="w-3 h-3 mr-1.5" />, label: 'Thất bại' },
      pending: { bg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', icon: <Clock className="w-3 h-3 mr-1.5" />, label: 'Đang chờ' },
      cancelled: { bg: 'bg-[#1E293B] text-gray-400 border border-gray-700', icon: <XCircle className="w-3 h-3 mr-1.5" />, label: 'Đã hủy' },
    };
    const s = map[status] || { bg: 'bg-[#1E293B] text-gray-400 border border-gray-700', icon: null, label: status };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase shadow-sm ${s.bg}`}>
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
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase shadow-sm ${styles[jobType] || 'bg-[#1E293B] text-gray-400 border border-gray-700'}`}>
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
    { key: 'all', label: 'Tất cả', icon: <Globe className="w-3.5 h-3.5" /> },
    { key: 'rss', label: 'RSS', icon: <Rss className="w-3.5 h-3.5" /> },
    { key: 'website', label: 'Website', icon: <LinkIcon className="w-3.5 h-3.5" /> },
    { key: 'active', label: 'Active', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Scan Center</h1>
          <p className="text-sm text-gray-400 mt-1">
            Quét nguồn dữ liệu để thu thập mentions theo nhóm từ khóa.
          </p>
        </div>
        <button
          onClick={() => { fetchWorkerStatus(); fetchCrawlJobs(); fetchData(); }}
          className="flex items-center px-4 py-2.5 text-sm text-gray-300 bg-[#0B1220] hover:bg-[#1E293B] border border-gray-800 rounded-lg transition-all duration-200 active:scale-95 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin text-indigo-400' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* ═══ Worker Status Banner ═══ */}
      {workerStatus && (
        <div className={`rounded-xl p-5 border shadow-sm ${
          workerStatus.worker_running
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div className="flex items-start">
            {workerStatus.worker_running ? (
              <div className="p-2 bg-emerald-500/10 rounded-lg mr-4 mt-0.5 border border-emerald-500/20">
                <Activity className="w-5 h-5 text-emerald-400" />
              </div>
            ) : (
              <div className="p-2 bg-amber-500/10 rounded-lg mr-4 mt-0.5 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
            )}
            <div className="flex-1">
              <h3 className={`text-base font-semibold ${
                workerStatus.worker_running ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {workerStatus.worker_running
                  ? (workerStatus.worker_mode === 'embedded'
                      ? 'Worker đang hoạt động — Embedded Scheduler'
                      : 'Worker đang hoạt động — Standalone')
                  : 'Worker không hoạt động'}
              </h3>
              {workerStatus.worker_mode === 'embedded' && (
                <p className="text-sm text-amber-400/80 mt-1.5 flex items-center bg-amber-500/10 inline-flex px-2 py-1 rounded border border-amber-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  Scheduler chạy chung với Web Service. Nếu Web Service sleep, RSS sẽ không quét 24/7.
                </p>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-sm">
                <span className="flex items-center text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 mr-2"></span>
                  Nguồn tự động: <strong className="ml-1.5 text-gray-200">{workerStatus.active_sources}</strong>
                </span>
                <span className="flex items-center text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></span>
                  Đang chờ scan: <strong className="ml-1.5 text-gray-200">{workerStatus.due_sources}</strong>
                </span>
                <span className="flex items-center text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2"></span>
                  Job đang chạy: <strong className="ml-1.5 text-gray-200">{workerStatus.running_jobs}</strong>
                </span>
                {workerStatus.last_worker_heartbeat && (
                  <span className="flex items-center text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>
                    Heartbeat: <strong className="ml-1.5 text-gray-200">{new Date(workerStatus.last_worker_heartbeat).toLocaleString('vi-VN')}</strong>
                  </span>
                )}
              </div>
              {workerStatus.last_error && (
                <p className="text-sm text-rose-400 mt-2 bg-rose-500/10 px-3 py-1.5 rounded border border-rose-500/20 inline-block">
                  Lỗi gần nhất: {workerStatus.last_error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Thêm nhanh từ khóa ═══ */}
      <div className="bg-[#111827] rounded-xl shadow-sm border border-gray-800 p-6">
        <h2 className="text-lg font-semibold flex items-center mb-5 text-white">
          <Sparkles className="w-5 h-5 mr-2 text-indigo-400" />
          Thêm nhanh từ khóa theo dõi
        </h2>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={quickKeyword}
              onChange={(e) => setQuickKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
              placeholder="Nhập từ khóa (VD: Vinfast, iPhone 16...)"
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
            />
          </div>
          <div className="md:w-56">
            <select
              value={quickGroupId}
              onChange={(e) => setQuickGroupId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white text-sm"
            >
              <option value="">-- Nhóm mặc định --</option>
              {keywordGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleQuickAdd}
              disabled={addingKeyword || !quickKeyword.trim()}
              className="px-4 py-2.5 bg-[#1E293B] text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm font-medium whitespace-nowrap transition-colors"
            >
              {addingKeyword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Thêm vào nhóm
            </button>
            <button
              onClick={handleQuickAddAndScan}
              disabled={scanning || !quickKeyword.trim()}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm font-medium whitespace-nowrap transition-colors shadow-sm shadow-indigo-500/20"
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Radar className="w-4 h-4 mr-2" />}
              Thêm và quét
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Scan Thủ Công ═══ */}
      <div className="bg-[#111827] rounded-xl shadow-sm border border-gray-800 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Scan thủ công</h2>

        {/* Keyword Groups */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Chọn Nhóm Từ Khóa <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {keywordGroups.map((group) => (
              <label
                key={group.id}
                className={`flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition-all duration-200 ${
                  selectedGroups.includes(group.id)
                    ? 'bg-indigo-500/10 border-indigo-500/30'
                    : 'bg-[#1E293B] hover:bg-gray-800 border-gray-700'
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
                  className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-gray-800 h-4 w-4"
                />
                <span className="font-medium text-sm text-gray-200">{group.name}</span>
                <span className="text-xs text-gray-500 ml-auto bg-gray-800 px-2 py-0.5 rounded-md">{group.keyword_count} kw</span>
              </label>
            ))}
          </div>
          {keywordGroups.length === 0 && (
            <p className="text-sm text-gray-500 mt-2 bg-gray-800/50 p-3 rounded-lg border border-gray-700">Chưa có nhóm từ khóa. Hãy tạo nhóm từ khóa trước!</p>
          )}
        </div>

        {/* Source Selection with Filters */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <label className="block text-sm font-medium text-gray-300">
              Chọn Nguồn
              <span className="text-xs text-gray-500 ml-2">
                ({filteredSources.length} hiển thị / {sources.length} tổng)
              </span>
            </label>

            {/* Filter tabs + toggle */}
            <div className="flex items-center gap-2 flex-wrap">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSourceFilter(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    sourceFilter === tab.key
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      : 'bg-[#1E293B] text-gray-400 hover:text-gray-200 border border-gray-700'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
              <button
                onClick={() => setHideTestSources(!hideTestSources)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ml-2 ${
                  hideTestSources
                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                    : 'bg-[#1E293B] text-gray-400 hover:text-gray-200 border border-gray-700'
                }`}
                title={hideTestSources ? 'Test sources đang ẩn' : 'Hiện tất cả sources'}
              >
                {hideTestSources ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {hideTestSources ? 'Ẩn test' : 'Hiện test'}
              </button>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={selectAllVisible}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-md hover:bg-indigo-500/20 transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Chọn tất cả ({filteredSources.length})
            </button>
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 bg-[#1E293B] border border-gray-700 rounded-md hover:text-gray-200 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              Bỏ chọn ({selectedSources.length})
            </button>
          </div>

          {/* Source list */}
          {filteredSources.length === 0 ? (
            <div className="text-center py-10 bg-[#1E293B]/50 rounded-xl border border-dashed border-gray-700">
              <div className="w-12 h-12 rounded-full bg-gray-800 mx-auto flex items-center justify-center mb-3">
                <Globe className="w-6 h-6 text-gray-500" />
              </div>
              <p className="text-sm text-gray-400 font-medium">
                {realSourceCount === 0
                  ? 'Chưa có nguồn thật để quét. Hãy thêm nguồn RSS/Web trước.'
                  : 'Không có nguồn nào phù hợp bộ lọc.'}
              </p>
            </div>
          ) : (
            <div className="border border-gray-800 rounded-xl overflow-hidden bg-[#0B1220]/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1E293B] text-left text-xs text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3 w-8 font-medium"></th>
                    <th className="px-4 py-3 font-medium">Nguồn</th>
                    <th className="px-4 py-3 hidden md:table-cell font-medium">Loại</th>
                    <th className="px-4 py-3 hidden lg:table-cell font-medium">Trạng thái</th>
                    <th className="px-4 py-3 hidden lg:table-cell font-medium">Crawl gần nhất</th>
                    <th className="px-4 py-3 hidden lg:table-cell font-medium">Crawl tiếp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredSources.map((source: any) => {
                    const test = isTestSource(source);
                    const isSupported = ['rss', 'website'].includes((source.source_type || '').toLowerCase());
                    const isUnsupported = !isSupported && source.source_type;
                    
                    return (
                      <tr
                        key={source.id}
                        className={`transition-colors ${
                          !isSupported ? 'bg-gray-900/50 opacity-60' : 'hover:bg-[#1E293B]/80 cursor-pointer'
                        } ${selectedSources.includes(source.id) ? 'bg-indigo-500/5' : ''}`}
                        onClick={() => {
                          if (!isSupported) return;
                          if (selectedSources.includes(source.id)) {
                            setSelectedSources(selectedSources.filter((id) => id !== source.id));
                          } else {
                            setSelectedSources([...selectedSources, source.id]);
                            setCustomUrl('');
                          }
                        }}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedSources.includes(source.id)}
                            disabled={!isSupported}
                            onChange={() => {}}
                            className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-gray-800 pointer-events-none disabled:opacity-50"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-gray-200 truncate flex items-center gap-2 flex-wrap">
                                {source.name}
                                {test && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20 flex-shrink-0">
                                    <FlaskConical className="w-3 h-3" />
                                    test
                                  </span>
                                )}
                                {isUnsupported && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 flex-shrink-0">
                                    Chưa tích hợp
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 truncate max-w-xs mt-0.5">{source.url}</div>
                              {source.last_error && (
                                <div className="text-xs text-rose-400 mt-1.5 p-1.5 bg-rose-500/10 rounded border border-rose-500/20" title={source.last_error}>
                                  Lỗi: {source.last_error.substring(0, 100)}{source.last_error.length > 100 ? '...' : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${
                            (source.source_type || '').toLowerCase() === 'rss'
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                              : isUnsupported ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                          }`}>
                            {(source.source_type || '').toLowerCase() === 'rss' ? (
                              <Rss className="w-3 h-3" />
                            ) : (
                              <Globe className="w-3 h-3" />
                            )}
                            {source.source_type || 'web'}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="flex items-center">
                            <span className={`inline-block w-2 h-2 rounded-full ${source.is_active ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'bg-gray-600'}`} />
                            <span className="text-xs text-gray-400 ml-2">{source.is_active ? 'Active' : 'Off'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                          {formatDate(source.last_crawled_at)}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                          {formatDate(source.next_crawl_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Custom URL divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-4 bg-[#111827] text-gray-500 font-medium tracking-widest uppercase">Hoặc nhập URL tùy chỉnh</span>
            </div>
          </div>

          <div className="relative">
            <LinkIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input
              type="url"
              value={customUrl}
              onChange={(e) => {
                setCustomUrl(e.target.value);
                if (e.target.value) setSelectedSources([]);
              }}
              placeholder="https://example.com hoặc https://example.com/rss"
              className="w-full pl-11 pr-4 py-3 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white text-sm placeholder-gray-500 transition-shadow"
            />
          </div>
        </div>

        {/* Scan Button — right below sources */}
        <button
          onClick={handleScan}
          disabled={scanning || !canScan}
          className={`w-full flex items-center justify-center px-6 py-3.5 rounded-xl font-semibold transition-all duration-300 shadow-sm ${
            canScan
              ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/25 hover:shadow-indigo-500/40'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
          } disabled:opacity-80`}
        >
          {scanning ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Play className="w-5 h-5 mr-2" />
          )}
          {scanning
            ? 'Đang Scan...'
            : canScan
              ? `Bắt Đầu Scan (${validSelectedSources.length > 0 ? validSelectedSources.length + ' nguồn' : '1 custom URL'}, ${selectedGroups.length} nhóm)`
              : selectedGroups.length === 0
                ? 'Chưa chọn nhóm từ khóa'
                : selectedSources.length > 0 && validSelectedSources.length === 0
                  ? 'Nguồn đã chọn chưa tích hợp'
                  : customUrl.length > 0 && !isUrlValid
                    ? 'URL tùy chỉnh không hợp lệ'
                    : 'Chưa chọn nguồn hợp lệ'}
        </button>
      </div>

      {/* ═══ Crawl Jobs History ═══ */}
      <div className="bg-[#111827] rounded-xl shadow-sm border border-gray-800">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center">
            <History className="w-5 h-5 mr-3 text-indigo-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">Lịch Sử Crawl Jobs</h2>
          </div>
          <span className="text-sm text-gray-400 font-medium tracking-wide">{crawlJobs.length} jobs</span>
        </div>
        <div className="divide-y divide-gray-800/80">
          {crawlJobs.length === 0 ? (
            <p className="text-gray-400 text-center py-8 font-medium tracking-wide">Chưa có lịch sử scan</p>
          ) : (
            crawlJobs.map((job) => (
              <div key={job.id} className="p-5 hover:bg-[#1E293B]/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getJobTypeBadge(job.job_type)}
                    {getStatusBadge(job.status)}
                    <span className="text-xs text-gray-500 font-mono tracking-wider ml-2">#{job.id}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-300 font-medium">{job.mentions_found} mentions</span>
                    {(job.status === 'failed' || job.status === 'cancelled') && (
                      <button
                        onClick={() => handleRetry(job.id)}
                        disabled={retryingJobId === job.id}
                        className="flex items-center px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {retryingJobId === job.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Retry
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-gray-400">
                  <span className="text-gray-300">Nguồn: {job.processed_sources}/{job.total_sources}</span>
                  {job.status === 'completed' && job.total_sources > job.processed_sources && (
                    <span className="text-rose-400">Thất bại: {job.total_sources - job.processed_sources} nguồn</span>
                  )}
                  {job.created_at && <span>Tạo: {formatDate(job.created_at)}</span>}
                  {job.completed_at && <span>Xong: {formatDate(job.completed_at)}</span>}
                  {job.retry_count > 0 && <span className="text-amber-400">Retry #{job.retry_count}</span>}
                </div>
                {job.error_message && (
                  <p className="mt-2 text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg border border-rose-500/20 truncate" title={job.error_message}>
                    ❌ {job.error_message}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
