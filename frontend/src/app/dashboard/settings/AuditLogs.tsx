'use client';

import { useState, useEffect } from 'react';
import { FileText, Search, Filter, Download, Calendar, User, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '@/lib/api';

interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface FilterParams {
  user_id: string;
  action: string;
  resource_type: string;
  start_date: string;
  end_date: string;
  limit: number;
  offset: number;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterParams>({
    user_id: '',
    action: '',
    resource_type: '',
    start_date: '',
    end_date: '',
    limit: 100,
    offset: 0
  });
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadLogs();
    loadStats();
  }, []);

  const loadLogs = async () => {
    try {
      // Build query params
      const params = new URLSearchParams();
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.action) params.append('action', filters.action);
      if (filters.resource_type) params.append('resource_type', filters.resource_type);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('limit', filters.limit.toString());
      params.append('offset', filters.offset.toString());

      const response = await api.get(`/api/admin/audit/?${params}`);
      setLogs(response.data);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      toast.error('Không thể tải audit logs');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/api/admin/audit/stats/summary');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = () => {
    setLoading(true);
    loadLogs();
  };

  const handleReset = () => {
    setFilters({
      user_id: '',
      action: '',
      resource_type: '',
      start_date: '',
      end_date: '',
      limit: 100,
      offset: 0
    });
    setTimeout(() => {
      setLoading(true);
      loadLogs();
    }, 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN');
  };

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
    if (action.includes('update')) return 'text-blue-400 bg-blue-500/10 border border-blue-500/20';
    if (action.includes('delete')) return 'text-rose-400 bg-rose-500/10 border border-rose-500/20';
    return 'text-slate-500 dark:text-gray-400 bg-gray-800 border border-slate-300 dark:border-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">Audit Logs</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Lịch sử hoạt động và thay đổi trong hệ thống</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center px-4 py-2.5 text-slate-700 dark:text-gray-300 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 transition-colors font-medium"
        >
          <Filter className="w-4 h-4 mr-2" />
          {showFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-gray-400">Tổng số logs</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide mt-1">{stats.total_logs}</p>
              </div>
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <Activity className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-gray-400">Loại hành động</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide mt-1">{stats.by_action?.length || 0}</p>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <FileText className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-gray-400">Hiển thị</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide mt-1">{logs.length}</p>
              </div>
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                <Search className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide mb-6">Bộ lọc</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">User ID</label>
              <input
                type="number"
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 transition-shadow"
                placeholder="ID người dùng"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Hành động</label>
              <input
                type="text"
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 transition-shadow"
                placeholder="e.g., user.create"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Loại tài nguyên</label>
              <input
                type="text"
                value={filters.resource_type}
                onChange={(e) => setFilters({ ...filters, resource_type: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 transition-shadow"
                placeholder="e.g., user, source"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Từ ngày</label>
              <input
                type="datetime-local"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white [color-scheme:dark] transition-shadow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Đến ngày</label>
              <input
                type="datetime-local"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white [color-scheme:dark] transition-shadow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Số lượng</label>
              <select
                value={filters.limit}
                onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white [color-scheme:dark] transition-shadow"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-slate-200 dark:border-gray-800">
            <button
              onClick={handleReset}
              className="px-6 py-2.5 text-slate-700 dark:text-gray-300 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 transition-colors font-medium"
            >
              Đặt lại
            </button>
            <button
              onClick={handleSearch}
              className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm shadow-indigo-500/20"
            >
              <Search className="w-4 h-4 mr-2" />
              Tìm kiếm
            </button>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto text-gray-600 mb-3" />
            <p className="text-slate-500 dark:text-gray-400 font-medium tracking-wide">Không có audit logs</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white dark:bg-[#1E293B]/50 border-b border-slate-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Thời gian</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Hành động</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Tài nguyên</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white dark:bg-[#1E293B]/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-200 font-medium whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-gray-400">
                      {log.user_id ? (
                        <span className="flex items-center text-slate-700 dark:text-gray-300">
                          <User className="w-4 h-4 mr-2 text-indigo-400" />
                          ID: {log.user_id}
                        </span>
                      ) : (
                        <span className="text-gray-500 font-medium">System</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-md tracking-wide ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-gray-400 font-medium">
                      {log.resource_type && (
                        <span>
                          {log.resource_type}
                          {log.resource_id && <span className="text-gray-500 ml-1">#{log.resource_id}</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono tracking-wider">
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {logs.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500 dark:text-gray-400">
            Hiển thị <span className="text-slate-900 dark:text-white">{filters.offset + 1} - {filters.offset + logs.length}</span> logs
          </p>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) });
                setTimeout(loadLogs, 100);
              }}
              disabled={filters.offset === 0}
              className="px-5 py-2.5 text-slate-700 dark:text-gray-300 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Trước
            </button>
            <button
              onClick={() => {
                setFilters({ ...filters, offset: filters.offset + filters.limit });
                setTimeout(loadLogs, 100);
              }}
              disabled={logs.length < filters.limit}
              className="px-5 py-2.5 text-slate-700 dark:text-gray-300 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sau
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
        <p className="text-sm text-indigo-200">
          <strong className="text-indigo-300">Lưu ý:</strong> Audit logs ghi lại tất cả hoạt động quan trọng trong hệ thống. 
          Dữ liệu này được lưu trữ vĩnh viễn để đảm bảo tính minh bạch và truy vết.
        </p>
      </div>
    </div>
  );
}
