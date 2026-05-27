'use client';

import { useEffect, useState } from 'react';
import { Play, Link as LinkIcon, History, AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw, Loader2, Activity, Sparkles, Radar } from 'lucide-react';
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

  const [quickKeyword, setQuickKeyword] = useState('');
  const [quickGroupId, setQuickGroupId] = useState<number | ''>('');

  const handleQuickAddAndScan = async () => {
    if (!quickKeyword.trim()) {
      toast.error('Vui lòng nhập từ khóa');
      return;
    }

    if (sources.length === 0) {
      toast.error('Chưa có nguồn quét. Hãy thêm nguồn RSS/Web trước.');
      return;
    }

    try {
      setScanning(true);
      const loadingToast = toast.loading('Đang thêm từ khóa và scan...');

      let targetGroupId = quickGroupId as number;

      // Auto-create default group if none selected
      if (!targetGroupId) {
        if (keywordGroups.length > 0) {
          targetGroupId = keywordGroups[0].id;
        } else {
          const newGroup = await keywordsApi.createGroup({ name: 'Nhóm Mặc Định', description: 'Tự động tạo từ Scan Center' });
          targetGroupId = newGroup.id;
        }
      }

      // Create keyword
      await keywordsApi.createKeyword({
        keyword: quickKeyword,
        group_id: targetGroupId,
        keyword_type: 'general',
      });

      // Refresh groups to get the new keyword count
      await fetchData();

      // Trigger scan with this group and all available sources
      const sourceIdsToScan = selectedSources.length > 0 ? selectedSources : sources.map(s => s.id);

      const result = await crawl.manualScan({
        keyword_group_ids: [targetGroupId],
        source_ids: sourceIdsToScan,
      });

      toast.dismiss(loadingToast);
      toast.success(`Đã thêm từ khóa và scan! Tìm thấy ${result.total_mentions_found} mentions mới`);
      
      setQuickKeyword('');
      setSelectedGroups(prev => Array.from(new Set([...prev, targetGroupId])));
      
      fetchCrawlJobs();
      fetchWorkerStatus();
    } catch (error: any) {
      console.error('Error in quick add and scan:', error);
      toast.dismiss();
      toast.error('Lỗi: ' + (error.response?.data?.detail || error.message));
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchWorkerStatus();
    fetchCrawlJobs();
  }, []);

  const fetchData = async () => {
    try {
      const [groupsData, sourcesData] = await Promise.all([
        keywordsApi.listGroups(),
        sourcesApi.list()
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

  const handleScan = async () => {
    if (selectedGroups.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 nhóm từ khóa');
      return;
    }

    if (selectedSources.length === 0 && !customUrl) {
      toast.error('Vui lòng chọn nguồn hoặc nhập URL');
      return;
    }

    try {
      setScanning(true);
      const loadingToast = toast.loading('Đang scan...');
      
      const result = await crawl.manualScan({
        keyword_group_ids: selectedGroups,
        source_ids: selectedSources.length > 0 ? selectedSources : undefined,
        url: customUrl || undefined
      });
      
      toast.dismiss(loadingToast);
      toast.success(`Scan thành công! Tìm thấy ${result.total_mentions_found} mentions mới`);
      
      // Reset form
      setSelectedGroups([]);
      setSelectedSources([]);
      setCustomUrl('');
      
      // Refresh data
      fetchCrawlJobs();
      fetchWorkerStatus();
    } catch (error: any) {
      console.error('Error scanning:', error);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Hoàn thành
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Đang chạy
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Thất bại
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Đang chờ
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <XCircle className="w-3 h-3 mr-1" />
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getJobTypeBadge = (jobType: string) => {
    const styles: Record<string, string> = {
      manual: 'bg-indigo-100 text-indigo-800',
      scheduled: 'bg-purple-100 text-purple-800',
      retry: 'bg-orange-100 text-orange-800',
    };
    const labels: Record<string, string> = {
      manual: 'Thủ công',
      scheduled: 'Tự động',
      retry: 'Retry',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[jobType] || 'bg-gray-100 text-gray-800'}`}>
        {labels[jobType] || jobType}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scan Center</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quét nguồn dữ liệu để thu thập mentions
          </p>
        </div>
        <button
          onClick={() => { fetchWorkerStatus(); fetchCrawlJobs(); }}
          className="flex items-center px-3 py-2 text-sm text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Làm mới
        </button>
      </div>

      {/* Worker Status Banner */}
      {workerStatus && (
        <div className={`rounded-lg p-4 border ${
          workerStatus.worker_running 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-start">
            {workerStatus.worker_running ? (
              <Activity className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className={`text-sm font-semibold ${
                workerStatus.worker_running ? 'text-green-800' : 'text-yellow-800'
              }`}>
                {workerStatus.worker_running 
                  ? (workerStatus.worker_mode === 'embedded' ? 'Worker đang hoạt động — Embedded Scheduler' : 'Worker đang hoạt động — Standalone')
                  : 'Worker không hoạt động'}
              </h3>
              {workerStatus.worker_mode === 'embedded' && (
                <p className="text-sm text-yellow-700 mt-1">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Scheduler chạy chung với Web Service. Nếu Web Service sleep, RSS sẽ không quét 24/7.
                </p>
              )}
              <div className="flex flex-wrap gap-4 mt-2 text-xs">
                <span className={workerStatus.worker_running ? 'text-green-700' : 'text-yellow-700'}>
                  Nguồn tự động: <strong>{workerStatus.active_sources}</strong>
                </span>
                <span className={workerStatus.worker_running ? 'text-green-700' : 'text-yellow-700'}>
                  Đang chờ scan: <strong>{workerStatus.due_sources}</strong>
                </span>
                <span className={workerStatus.worker_running ? 'text-green-700' : 'text-yellow-700'}>
                  Job đang chạy: <strong>{workerStatus.running_jobs}</strong>
                </span>
                {workerStatus.last_worker_heartbeat && (
                  <span className={workerStatus.worker_running ? 'text-green-700' : 'text-yellow-700'}>
                    Heartbeat: <strong>{new Date(workerStatus.last_worker_heartbeat).toLocaleString('vi-VN')}</strong>
                  </span>
                )}
              </div>
              {workerStatus.last_error && (
                <p className="text-xs text-red-600 mt-1">Lỗi gần nhất: {workerStatus.last_error}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thêm nhanh từ khóa theo dõi */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center">
          <Sparkles className="w-5 h-5 mr-2 text-blue-600" />
          Thêm nhanh từ khóa theo dõi
        </h2>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Từ khóa cần theo dõi
            </label>
            <input
              type="text"
              value={quickKeyword}
              onChange={(e) => setQuickKeyword(e.target.value)}
              placeholder="Nhập từ khóa (VD: Vinfast, iPhone 16...)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:w-1/3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nhóm từ khóa
            </label>
            <select
              value={quickGroupId}
              onChange={(e) => setQuickGroupId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Tự động tạo nhóm mới --</option>
              {keywordGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:w-auto flex items-end">
            <button
              onClick={handleQuickAddAndScan}
              disabled={scanning}
              className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium"
            >
              {scanning ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Radar className="w-5 h-5 mr-2" />
              )}
              {scanning ? 'Đang xử lý...' : 'Thêm và quét'}
            </button>
          </div>
        </div>
      </div>

      {/* Scan Form */}
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 className="text-lg font-semibold">Scan Thủ Công</h2>

        {/* Select Keyword Groups */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chọn Nhóm Từ Khóa *
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {keywordGroups.map((group) => (
              <label key={group.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(group.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedGroups([...selectedGroups, group.id]);
                    } else {
                      setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                    }
                  }}
                  className="rounded"
                />
                <div className="flex-1">
                  <div className="font-medium">{group.name}</div>
                  <div className="text-xs text-gray-500">{group.keyword_count} từ khóa</div>
                </div>
              </label>
            ))}
          </div>
          {keywordGroups.length === 0 && (
            <p className="text-sm text-gray-500">Chưa có nhóm từ khóa. Hãy tạo nhóm từ khóa trước!</p>
          )}
        </div>

        {/* Select Sources OR Custom URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chọn Nguồn
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {sources.map((source: any) => (
              <label key={source.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSources.includes(source.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSources([...selectedSources, source.id]);
                      setCustomUrl(''); // Clear custom URL
                    } else {
                      setSelectedSources(selectedSources.filter(id => id !== source.id));
                    }
                  }}
                  className="rounded"
                />
                <div className="flex-1">
                  <div className="font-medium">{source.name}</div>
                  <div className="text-xs text-gray-500 truncate">{source.url}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">HOẶC</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nhập URL Tùy Chỉnh
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="url"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  if (e.target.value) {
                    setSelectedSources([]); // Clear selected sources
                  }
                }}
                placeholder="https://example.com hoặc https://example.com/rss"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Hỗ trợ: Website, RSS Feed, Blog
            </p>
          </div>
        </div>

        {/* Scan Button */}
        <button
          onClick={handleScan}
          disabled={scanning}
          className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scanning ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Play className="w-5 h-5 mr-2" />
          )}
          {scanning ? 'Đang Scan...' : 'Bắt Đầu Scan'}
        </button>
      </div>

      {/* Crawl Jobs History */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center">
            <History className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold">Lịch Sử Crawl Jobs</h2>
          </div>
          <span className="text-sm text-gray-500">{crawlJobs.length} jobs</span>
        </div>
        <div className="divide-y">
          {crawlJobs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Chưa có lịch sử scan</p>
          ) : (
            crawlJobs.map((job) => (
              <div key={job.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getJobTypeBadge(job.job_type)}
                    {getStatusBadge(job.status)}
                    <span className="text-sm text-gray-600">
                      #{job.id}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-500">
                      {job.mentions_found} mentions
                    </span>
                    {(job.status === 'failed' || job.status === 'cancelled') && (
                      <button
                        onClick={() => handleRetry(job.id)}
                        disabled={retryingJobId === job.id}
                        className="flex items-center px-2 py-1 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100 disabled:opacity-50"
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
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>
                    Nguồn: {job.processed_sources}/{job.total_sources}
                  </span>
                  {job.created_at && (
                    <span>
                      Tạo: {new Date(job.created_at).toLocaleString('vi-VN')}
                    </span>
                  )}
                  {job.completed_at && (
                    <span>
                      Xong: {new Date(job.completed_at).toLocaleString('vi-VN')}
                    </span>
                  )}
                  {job.retry_count > 0 && (
                    <span className="text-orange-600">Retry #{job.retry_count}</span>
                  )}
                </div>
                {job.error_message && (
                  <p className="mt-1 text-xs text-red-600 truncate" title={job.error_message}>
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
