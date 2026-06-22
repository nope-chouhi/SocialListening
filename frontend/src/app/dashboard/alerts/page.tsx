'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, X, Plus, FileText, RefreshCw, Play, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import { alerts as alertsApi, getErrorMessage } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import { useProject } from '@/contexts/ProjectContext';

const SEVERITIES = [
  { value: 'low', label: 'Thấp' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'high', label: 'Cao' },
  { value: 'critical', label: 'Nghiêm trọng' },
];

const RULE_TYPES = [
  { value: 'mention_spike', label: 'Mention Spike', description: 'Alert when mentions exceed threshold' },
  { value: 'negative_spike', label: 'Negative Spike', description: 'Alert when negative sentiment exceeds threshold' },
  { value: 'high_risk', label: 'High Risk', description: 'Alert when risk score exceeds threshold' },
];

export default function AlertsPage() {
  const { activeProject } = useProject();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showRuleCheck, setShowRuleCheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingRules, setCheckingRules] = useState(false);
  const [form, setForm] = useState({
    title: '',
    severity: 'high',
    message: '',
    mention_id: '',
  });
  const [ruleForm, setRuleForm] = useState({
    name: '',
    rule_type: 'mention_spike',
    threshold: 10,
    window_hours: 24,
    is_active: true,
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

  const handleCheckRules = async () => {
    try {
      setCheckingRules(true);
      const result = await alertsApi.checkRules({
        project_id: activeProject?.id,
        name: ruleForm.name || 'Manual Check',
        rule_type: ruleForm.rule_type,
        threshold: ruleForm.threshold,
        window_hours: ruleForm.window_hours,
        is_active: ruleForm.is_active,
      });
      toast.success(`Đã kiểm tra rules. Tạo ${result.alerts_created || 0} cảnh báo mới.`);
      fetchAlerts();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi kiểm tra rules');
    } finally {
      setCheckingRules(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    if (severity === 'critical') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (severity === 'high') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    if (severity === 'medium') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
  };

  const getSeverityBorder = (severity: string) => {
    if (severity === 'critical') return 'border-l-rose-500';
    if (severity === 'high') return 'border-l-orange-500';
    if (severity === 'medium') return 'border-l-amber-500';
    return 'border-l-indigo-500';
  };

  const getSeverityLabel = (s: string) =>
    SEVERITIES.find((x) => x.value === s)?.label || s;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-500 dark:text-gray-400 font-medium tracking-wide">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Cảnh Báo</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Quản lý các cảnh báo từ hệ thống</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRuleCheck(true)}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-500/20 font-medium"
          >
            <Play className="w-4 h-4" />
            <span>Manual Check</span>
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20 font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo cảnh báo</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['all', 'new', 'acknowledged', 'resolved'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f 
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 border border-indigo-500/50' 
                : 'bg-white dark:bg-[#111827] text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-800 hover:text-white hover:bg-white dark:bg-[#1E293B]'
            }`}
          >
            {f === 'all' ? 'Tất cả' : f === 'new' ? 'Mới' : f === 'acknowledged' ? 'Đã xác nhận' : 'Đã giải quyết'}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-xl bg-white dark:bg-[#1E293B] flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-gray-800 shadow-sm">
              <AlertTriangle className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-slate-500 dark:text-gray-400 font-medium tracking-wide">Không có cảnh báo nào</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`bg-white dark:bg-[#111827] rounded-xl shadow-sm p-5 sm:p-6 border-y border-r border-slate-200 dark:border-gray-800 border-l-[3px] hover:bg-white dark:bg-[#1E293B]/30 transition-colors ${getSeverityBorder(alert.severity)}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <AlertTriangle className={`w-5 h-5 ${
                      alert.severity === 'critical' ? 'text-rose-500' :
                      alert.severity === 'high' ? 'text-orange-500' :
                      alert.severity === 'medium' ? 'text-amber-500' : 'text-indigo-500'
                    }`} />
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{alert.title}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${getSeverityBadge(alert.severity)}`}>
                      {getSeverityLabel(alert.severity)}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-gray-700">
                      {alert.status}
                    </span>
                  </div>
                  {alert.message && <p className="text-sm text-slate-500 dark:text-gray-400 mt-3 leading-relaxed">{alert.message}</p>}
                  {alert.mention_id && (
                    <div className="mt-4">
                      <Link
                        href={`/dashboard/mentions/${alert.mention_id}`}
                        className="inline-flex items-center text-xs font-semibold tracking-wide text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        Xem Mention Gốc (#{alert.mention_id})
                      </Link>
                    </div>
                  )}
                  <div className="text-xs font-medium text-gray-500 mt-4">
                    {new Date(alert.created_at).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="flex items-center space-x-2 sm:ml-4 flex-shrink-0">
                  {alert.status === 'new' && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="flex items-center justify-center px-3 py-1.5 text-sm font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg transition-colors"
                      title="Xác nhận"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Xác nhận
                    </button>
                  )}
                  {alert.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="flex items-center justify-center px-3 py-1.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
                      title="Giải quyết"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Giải quyết
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
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setShowCreate(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#1E293B]/30">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tạo Cảnh Báo</h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-slate-700 dark:text-gray-300 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Tiêu đề <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Nhập tiêu đề cảnh báo..."
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
                  />
                </div>
                {/* Severity */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Mức độ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Nội dung
                  </label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    rows={4}
                    placeholder="Mô tả chi tiết cảnh báo..."
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 resize-none"
                  />
                </div>
                {/* Mention ID (optional) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    ID Mention (tùy chọn)
                  </label>
                  <input
                    type="number"
                    value={form.mention_id}
                    onChange={(e) => setForm({ ...form, mention_id: e.target.value })}
                    placeholder="Nhập ID mention liên quan..."
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1E293B]/30 flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-5 py-2.5 text-slate-700 dark:text-gray-300 bg-white dark:bg-[#111827] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting || !form.title.trim()}
                  className="px-5 py-2.5 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-500/20 font-medium"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo cảnh báo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Rule Check Modal */}
      {showRuleCheck && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setShowRuleCheck(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#1E293B]/30">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Play className="w-5 h-5 text-emerald-400" />
                  Manual Rule Check
                </h2>
                <button onClick={() => setShowRuleCheck(false)} className="text-gray-500 hover:text-slate-700 dark:text-gray-300 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
                  Kiểm tra thủ công các rules để tạo cảnh báo dựa trên ngưỡng đã cấu hình.
                </p>
                {/* Rule Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Loại Rule
                  </label>
                  <select
                    value={ruleForm.rule_type}
                    onChange={(e) => setRuleForm({ ...ruleForm, rule_type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  >
                    {RULE_TYPES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">{RULE_TYPES.find(r => r.value === ruleForm.rule_type)?.description}</p>
                </div>
                {/* Threshold */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Ngưỡng (Threshold)
                  </label>
                  <input
                    type="number"
                    value={ruleForm.threshold}
                    onChange={(e) => setRuleForm({ ...ruleForm, threshold: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>
                {/* Window Hours */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Khoảng thời gian (giờ)
                  </label>
                  <input
                    type="number"
                    value={ruleForm.window_hours}
                    onChange={(e) => setRuleForm({ ...ruleForm, window_hours: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>
                {/* Active Toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300">
                    Kích hoạt rule
                  </label>
                  <button
                    onClick={() => setRuleForm({ ...ruleForm, is_active: !ruleForm.is_active })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      ruleForm.is_active ? 'bg-indigo-600' : 'bg-gray-700'
                    }`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      ruleForm.is_active ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1E293B]/30 flex justify-end space-x-3">
                <button
                  onClick={() => setShowRuleCheck(false)}
                  className="px-5 py-2.5 text-slate-700 dark:text-gray-300 bg-white dark:bg-[#111827] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCheckRules}
                  disabled={checkingRules}
                  className="px-5 py-2.5 text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-all shadow-sm shadow-emerald-500/20 font-medium flex items-center gap-2"
                >
                  {checkingRules ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang kiểm tra...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Chạy Kiểm Tra
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
