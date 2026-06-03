'use client';

import { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle2, RefreshCcw, Clock, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'nope_email_report_schedule';

interface Schedule {
  id: string;
  emails: string;
  frequency: string;
  report_type: string;
  created_at: string;
}

export default function EmailReportsPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [form, setForm] = useState({ emails: '', frequency: 'daily', report_type: 'executive' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSchedules(JSON.parse(stored));
    } catch {}
  }, []);

  const saveSchedules = (list: Schedule[]) => {
    setSchedules(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const handleSave = async () => {
    const emails = form.emails.trim();
    if (!emails) {
      toast.error('Vui lòng nhập ít nhất 1 email nhận báo cáo');
      return;
    }
    const emailList = emails.split(',').map(e => e.trim()).filter(Boolean);
    const invalid = emailList.filter(e => !e.includes('@'));
    if (invalid.length > 0) {
      toast.error(`Email không hợp lệ: ${invalid.join(', ')}`);
      return;
    }
    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      const newSchedule: Schedule = {
        id: Date.now().toString(),
        emails: emails,
        frequency: form.frequency,
        report_type: form.report_type,
        created_at: new Date().toISOString(),
      };
      saveSchedules([...schedules, newSchedule]);
      setForm({ emails: '', frequency: 'daily', report_type: 'executive' });
      toast.success('Đã lưu lịch gửi báo cáo!\n(Lưu ý: Tính năng gửi email thật đang Coming soon — cấu hình SMTP chưa được kích hoạt)');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    saveSchedules(schedules.filter(s => s.id !== id));
    toast.success('Đã xóa lịch gửi');
  };

  const FREQ_LABELS: Record<string, string> = {
    daily: 'Hàng ngày (8:00 AM)',
    weekly: 'Hàng tuần (Thứ 2)',
    monthly: 'Hàng tháng (Ngày 1)',
  };
  const TYPE_LABELS: Record<string, string> = {
    executive: 'Executive Summary (Tóm tắt nhanh)',
    full: 'Full Analytics (Chi tiết)',
    crisis: 'Crisis Alert (Chỉ cảnh báo sự cố)',
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-wide flex items-center gap-2">
          <Mail className="w-6 h-6 text-indigo-400" />
          Email Reports Setup
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Lên lịch nhận báo cáo tự động qua Email định kỳ.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400 font-medium">
        ⚠️ <strong>Coming soon (email delivery):</strong> Tính năng gửi email thật cần cấu hình SMTP trên server. Bạn có thể đặt lịch và cấu hình ngay bây giờ — email sẽ được gửi sau khi SMTP được kích hoạt.
      </div>

      <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-8">
        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-gray-100 dark:border-white/10">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center">
            <Send className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Thêm lịch gửi báo cáo</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hệ thống sẽ tổng hợp số liệu và gửi thẳng vào hộp thư.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-600 dark:text-gray-300">Tần suất gửi</label>
              <select
                value={form.frequency}
                onChange={e => setForm({ ...form, frequency: e.target.value })}
                className="w-full bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="daily">Hàng ngày (8:00 AM)</option>
                <option value="weekly">Hàng tuần (Thứ 2)</option>
                <option value="monthly">Hàng tháng (Ngày 1)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-600 dark:text-gray-300">Loại báo cáo</label>
              <select
                value={form.report_type}
                onChange={e => setForm({ ...form, report_type: e.target.value })}
                className="w-full bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="executive">Executive Summary (Tóm tắt nhanh)</option>
                <option value="full">Full Analytics (Chi tiết)</option>
                <option value="crisis">Crisis Alert (Chỉ cảnh báo sự cố)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-600 dark:text-gray-300">Email nhận báo cáo (cách nhau bởi dấu phẩy)</label>
            <input
              type="text"
              value={form.emails}
              onChange={e => setForm({ ...form, emails: e.target.value })}
              placeholder="admin@company.com, marketing@company.com"
              className="w-full bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              onClick={() => setForm({ emails: '', frequency: 'daily', report_type: 'executive' })}
              className="px-6 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white rounded-lg font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Lưu cấu hình
            </button>
          </div>
        </div>
      </div>

      {/* Saved schedules */}
      {schedules.length > 0 && (
        <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-6">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" /> Lịch đã cấu hình ({schedules.length})
          </h2>
          <div className="space-y-3">
            {schedules.map(s => (
              <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{FREQ_LABELS[s.frequency] || s.frequency}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{TYPE_LABELS[s.report_type] || s.report_type}</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">{s.emails}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold px-2 py-1 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded uppercase tracking-wider">
                    Pending SMTP
                  </span>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    title="Xóa lịch"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
