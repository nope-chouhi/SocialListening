'use client';

import { useEffect, useState } from 'react';
import { FileText, Eye, Plus, X, Check } from 'lucide-react';
import { incidents as incidentsApi, getErrorMessage } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Mới' },
  { value: 'verifying', label: 'Đang xác minh' },
  { value: 'responding', label: 'Đang xử lý' },
  { value: 'waiting_legal', label: 'Chờ pháp lý' },
  { value: 'waiting_platform', label: 'Chờ nền tảng' },
  { value: 'resolved', label: 'Đã giải quyết' },
  { value: 'closed', label: 'Đã đóng' },
];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    deadline: '',
    mention_id: '',
  });

  // Update status modal
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [updateForm, setUpdateForm] = useState({ status: '', resolution_notes: '' });

  // View logs modal
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [logIncidentId, setLogIncidentId] = useState<number | null>(null);
  const [newLog, setNewLog] = useState('');

  useEffect(() => {
    fetchIncidents();
  }, [filter]);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, page_size: 50 };
      if (filter !== 'all') params.status = filter;
      const data = await incidentsApi.list(params);
      setIncidents(data.items || []);
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi tải danh sách sự cố');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.title.trim()) {
      toast.error('Vui lòng nhập tiêu đề sự cố');
      return;
    }
    setSubmitting(true);
    try {
      await incidentsApi.create({
        title: createForm.title,
        description: createForm.description || undefined,
        mention_id: createForm.mention_id ? parseInt(createForm.mention_id) : undefined,
        deadline: createForm.deadline ? new Date(createForm.deadline).toISOString() : undefined,
      });
      toast.success('Tạo sự cố thành công!');
      setShowCreate(false);
      setCreateForm({ title: '', description: '', deadline: '', mention_id: '' });
      fetchIncidents();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi tạo sự cố');
    } finally {
      setSubmitting(false);
    }
  };

  const openUpdateStatus = (incident: any) => {
    setSelectedIncident(incident);
    setUpdateForm({ status: incident.status, resolution_notes: '' });
    setShowUpdateStatus(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedIncident) return;
    try {
      await incidentsApi.update(selectedIncident.id, {
        status: updateForm.status,
        resolution_notes: updateForm.resolution_notes || undefined,
      });
      toast.success('Cập nhật trạng thái thành công!');
      setShowUpdateStatus(false);
      fetchIncidents();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi cập nhật trạng thái');
    }
  };

  const openLogs = async (incident: any) => {
    setLogIncidentId(incident.id);
    setSelectedIncident(incident);
    try {
      const data = await incidentsApi.getLogs(incident.id);
      setLogs(data || []);
    } catch {
      setLogs([]);
    }
    setShowLogs(true);
  };

  const handleAddLog = async () => {
    if (!logIncidentId || !newLog.trim()) return;
    try {
      await incidentsApi.addLog(logIncidentId, { action: 'note', notes: newLog });
      toast.success('Đã thêm ghi chú');
      setNewLog('');
      const data = await incidentsApi.getLogs(logIncidentId);
      setLogs(data || []);
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi thêm ghi chú');
    }
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      verifying: 'bg-yellow-100 text-yellow-800',
      responding: 'bg-orange-100 text-orange-800',
      waiting_legal: 'bg-purple-100 text-purple-800',
      waiting_platform: 'bg-indigo-100 text-indigo-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (s: string) =>
    STATUS_OPTIONS.find((x) => x.value === s)?.label || s;

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
          <h1 className="text-2xl font-bold text-gray-900">Sự Cố</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý các sự cố cần xử lý</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo sự cố</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
        >
          Tất cả
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === s.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-4">
        {incidents.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Không có sự cố nào
          </div>
        ) : (
          incidents.map((incident) => (
            <div key={incident.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 flex-wrap gap-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">{incident.title}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(incident.status)}`}>
                      {getStatusLabel(incident.status)}
                    </span>
                    {incident.is_overdue && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        Quá hạn
                      </span>
                    )}
                  </div>
                    {incident.description && (
                      <p className="text-sm text-gray-600 mt-2">{incident.description}</p>
                    )}
                    {incident.mention_id && (
                      <div className="mt-3">
                        <Link
                          href={`/dashboard/mentions/${incident.mention_id}`}
                          className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1.5" />
                          Xem Mention Gốc (#{incident.mention_id})
                        </Link>
                      </div>
                    )}
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                    <span>Tạo: {new Date(incident.created_at).toLocaleString('vi-VN')}</span>
                    {incident.deadline && (
                      <span>Deadline: {new Date(incident.deadline).toLocaleString('vi-VN')}</span>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => openLogs(incident)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Xem lịch sử"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => openUpdateStatus(incident)}
                    className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                    title="Cập nhật trạng thái"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Incident Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Tạo Sự Cố</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tiêu đề <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="Nhập tiêu đề sự cố..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={3}
                  placeholder="Mô tả chi tiết sự cố..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                <input
                  type="datetime-local"
                  value={createForm.deadline}
                  onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID Mention liên quan (tùy chọn)
                </label>
                <input
                  type="number"
                  value={createForm.mention_id}
                  onChange={(e) => setCreateForm({ ...createForm, mention_id: e.target.value })}
                  placeholder="Nhập ID mention..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end space-x-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Hủy
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !createForm.title.trim()}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? 'Đang tạo...' : 'Tạo sự cố'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {showUpdateStatus && selectedIncident && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Cập Nhật Trạng Thái</h2>
              <button onClick={() => setShowUpdateStatus(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trạng thái <span className="text-red-500">*</span>
                </label>
                <select
                  value={updateForm.status}
                  onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ghi chú xử lý
                </label>
                <textarea
                  value={updateForm.resolution_notes}
                  onChange={(e) => setUpdateForm({ ...updateForm, resolution_notes: e.target.value })}
                  rows={3}
                  placeholder="Ghi chú về cách xử lý sự cố..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end space-x-3">
              <button onClick={() => setShowUpdateStatus(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Hủy
              </button>
              <button
                onClick={handleUpdateStatus}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Cập nhật
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogs && selectedIncident && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Lịch sử — {selectedIncident.title}
              </h2>
              <button onClick={() => setShowLogs(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {logs.length === 0 ? (
                <p className="text-gray-500 text-center">Chưa có lịch sử</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="border-l-2 border-blue-300 pl-3 py-1">
                    <div className="text-sm font-medium text-gray-800">{log.action}</div>
                    {log.notes && <div className="text-sm text-gray-600">{log.notes}</div>}
                    {(log.old_status || log.new_status) && (
                      <div className="text-xs text-gray-500">
                        {log.old_status} → {log.new_status}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t flex space-x-2">
              <input
                type="text"
                value={newLog}
                onChange={(e) => setNewLog(e.target.value)}
                placeholder="Thêm ghi chú..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAddLog()}
              />
              <button
                onClick={handleAddLog}
                disabled={!newLog.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm"
              >
                Thêm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
