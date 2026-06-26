'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Search, ChevronLeft, ChevronRight, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

interface DeliveryLog {
  id: number;
  event_type: string;
  channel: string;
  destination: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  payload: string | null;
}

export default function NotificationDeliveries() {
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<DeliveryLog | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '20'
      });
      if (statusFilter) params.append('status', statusFilter);
      if (channelFilter) params.append('channel', channelFilter);

      const response = await api.get(`/api/admin/settings/notifications/deliveries?${params}`);
      const data = response.data;
      setLogs(data.items);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error(error);
      toast.error('Không thể kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, statusFilter, channelFilter]);

  const handleRetry = async (logId: number) => {
    setRetryingId(logId);
    try {
      await api.post(`/api/admin/settings/notifications/deliveries/${logId}/retry`);
      toast.success('Đã xếp hàng thử lại');
      fetchLogs();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.detail || 'Lỗi khi thử lại');
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">Sent</span>;
      case 'failed':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">Failed</span>;
      case 'retrying':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">Retrying</span>;
      case 'skipped':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">Skipped</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">Lịch sử thông báo</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Lịch sử gửi email và webhook</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-lg text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="retrying">Retrying</option>
          </select>
          <select 
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-lg text-sm"
          >
            <option value="">Tất cả kênh</option>
            <option value="email">Email</option>
            <option value="webhook">Webhook</option>
          </select>
          <button onClick={fetchLogs} className="p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 dark:text-gray-400 uppercase bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4">Loại sự kiện</th>
                <th className="px-6 py-4">Kênh</th>
                <th className="px-6 py-4">Đích đến</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Số lần</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-500">Không có dữ liệu</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="border-b border-slate-200 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800/30">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 dark:text-gray-300">{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{log.event_type}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-gray-300 uppercase text-xs font-bold tracking-wider">{log.channel}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-gray-300 max-w-[200px] truncate" title={log.destination}>{log.destination}</td>
                    <td className="px-6 py-4">{getStatusBadge(log.status)}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-gray-300">{log.attempt_count}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="text-xs text-indigo-500 hover:text-indigo-400 font-medium"
                      >
                        Chi tiết
                      </button>
                      {log.status === 'failed' && (
                        <button 
                          onClick={() => handleRetry(log.id)}
                          disabled={retryingId === log.id}
                          className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {retryingId === log.id ? 'Đang gửi...' : 'Thử lại'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-gray-800 flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-gray-400">Trang {page} / {totalPages}</span>
          <div className="flex gap-2">
            <button 
              disabled={page <= 1} 
              onClick={() => setPage(p => p - 1)}
              className="p-1 border border-slate-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              disabled={page >= totalPages} 
              onClick={() => setPage(p => p + 1)}
              className="p-1 border border-slate-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111827] border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Chi tiết gửi <span className="text-sm font-normal text-gray-400">#{selectedLog.id}</span>
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-gray-400">Kênh:</span> <span className="text-white font-medium ml-2">{selectedLog.channel}</span></div>
                <div><span className="text-gray-400">Đích đến:</span> <span className="text-white font-medium ml-2">{selectedLog.destination}</span></div>
                <div><span className="text-gray-400">Trạng thái:</span> <div className="inline-block ml-2">{getStatusBadge(selectedLog.status)}</div></div>
                <div><span className="text-gray-400">Số lần thử:</span> <span className="text-white font-medium ml-2">{selectedLog.attempt_count}</span></div>
              </div>
              
              {selectedLog.last_error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3 text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <pre className="whitespace-pre-wrap font-mono text-xs overflow-x-auto">{selectedLog.last_error}</pre>
                </div>
              )}

              {selectedLog.payload && (
                <div>
                  <h4 className="text-gray-400 mb-2 font-medium">Payload / Data:</h4>
                  <div className="bg-[#0B1120] border border-gray-800 p-4 rounded-xl overflow-x-auto">
                    <pre className="text-gray-300 font-mono text-xs">{JSON.stringify(JSON.parse(selectedLog.payload), null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
