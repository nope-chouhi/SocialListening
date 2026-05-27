'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, X, Plus, FileText } from 'lucide-react';
import { alerts as alertsApi, getErrorMessage } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

const SEVERITIES = [
  { value: 'low', label: 'Thấp' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'high', label: 'Cao' },
  { value: 'critical', label: 'Nghiêm trọng' },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    severity: 'high',
    message: '',
    mention_id: '',
  });

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, page_size: 50 };
      if (filter !== 'all') params.status = filter;
      const data = await alertsApi.list(params);
      setAlerts(data.items || []);
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
      toast.error(getErrorMessage(error) || 'Lỗi khi tải danh sách cảnh báo');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error('Vui lòng nhập tiêu đề cảnh báo');
      return;
    }
    setSubmitting(true);
    try {
      await alertsApi.create({
        title: form.title,
        severity: form.severity,
        message: form.message || undefined,
        mention_id: form.mention_id ? parseInt(form.mention_id) : undefined,
      });
      toast.success('Tạo cảnh báo thành công!');
      setShowCreate(false);
      setForm({ title: '', severity: 'high', message: '', mention_id: '' });
      fetchAlerts();
    } catch (error: any) {
      console.error('Error creating alert:', error);
      toast.error(getErrorMessage(error) || 'Lỗi khi tạo cảnh báo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      await alertsApi.acknowledge(id);
      toast.success('Đã xác nhận cảnh báo');
      fetchAlerts();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi xác nhận cảnh báo');
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await alertsApi.resolve(id);
      toast.success('Đã giải quyết cảnh báo');
      fetchAlerts();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi giải quyết cảnh báo');
    }
  };

  const getSeverityColor = (severity: string) => {
    if (severity === 'critical') return 'bg-red-100 text-red-800 border-red-200';
    if (severity === 'high') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (severity === 'medium') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getSeverityLabel = (s: string) =>
    SEVERITIES.find((x) => x.value === s)?.label || s;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cảnh Báo</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý các cảnh báo từ hệ thống</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo cảnh báo</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex space-x-2">
        {['all', 'new', 'acknowledged', 'resolved'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
            }`}
          >
            {f === 'all' ? 'Tất cả' : f === 'new' ? 'Mới' : f === 'acknowledged' ? 'Đã xác nhận' : 'Đã giải quyết'}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Không có cảnh báo nào
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`bg-white rounded-lg shadow p-6 border-l-4 ${getSeverityColor(alert.severity)}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(alert.severity)}`}>
                      {getSeverityLabel(alert.severity)}
                    </span>
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                      {alert.status}
                    </span>
                  </div>
                  {alert.message && <p className="text-sm text-gray-600 mt-2">{alert.message}</p>}
                  {alert.mention_id && (
                    <div className="mt-3">
                      <Link
                        href={`/dashboard/mentions/${alert.mention_id}`}
                        className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        Xem Mention Gốc (#{alert.mention_id})
                      </Link>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(alert.created_at).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="flex space-x-2 ml-4">
                  {alert.status === 'new' && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Xác nhận"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                  {alert.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      title="Giải quyết"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Alert Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Tạo Cảnh Báo</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tiêu đề <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Nhập tiêu đề cảnh báo..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* Severity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mức độ <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nội dung
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={3}
                  placeholder="Mô tả chi tiết cảnh báo..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* Mention ID (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID Mention (tùy chọn)
                </label>
                <input
                  type="number"
                  value={form.mention_id}
                  onChange={(e) => setForm({ ...form, mention_id: e.target.value })}
                  placeholder="Nhập ID mention liên quan..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end space-x-3">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !form.title.trim()}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? 'Đang tạo...' : 'Tạo cảnh báo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
