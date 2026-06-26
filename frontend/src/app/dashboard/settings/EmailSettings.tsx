'use client';

import { useState, useEffect } from 'react';
import { Mail, Save, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export default function EmailSettings() {
  const [settings, setSettings] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: '',
    useTls: true,
    useSsl: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/api/admin/settings/email');
      const data = response.data;
      setSettings({
        smtpHost: data.smtp_host || '',
        smtpPort: data.smtp_port || 587,
        smtpUsername: data.smtp_username || '',
        smtpPassword: '', // Never load password from backend
        fromEmail: data.from_email || '',
        fromName: data.from_name || '',
        useTls: data.use_tls !== undefined ? data.use_tls : true,
        useSsl: data.use_ssl !== undefined ? data.use_ssl : false
      });
      setIsConfigured(data.is_configured || false);
    } catch (error) {
      console.error('Failed to load email settings:', error);
      toast.error('Không thể tải cấu hình email');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.smtpHost || !settings.smtpUsername || !settings.fromEmail) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        smtp_host: settings.smtpHost,
        smtp_port: settings.smtpPort,
        smtp_username: settings.smtpUsername,
        from_email: settings.fromEmail,
        from_name: settings.fromName,
        use_tls: settings.useTls,
        use_ssl: settings.useSsl
      };

      // Only include password if it was changed
      if (settings.smtpPassword) {
        payload.smtp_password = settings.smtpPassword;
      }

      const response = await api.put('/api/admin/settings/email', payload);
      const data = response.data;
      
      setIsConfigured(data.is_configured);
      toast.success('Đã lưu cấu hình email');
      // Clear password field after save
      setSettings({ ...settings, smtpPassword: '' });
    } catch (error: any) {
      console.error('Failed to save email settings:', error);
      toast.error('Không thể lưu cấu hình email');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!isConfigured) {
      toast.error('Vui lòng lưu cấu hình trước khi test');
      return;
    }

    setTesting(true);
    try {
      const response = await api.post('/api/admin/settings/email/test');
      const data = response.data;
      
      toast.success(data.message || 'Email test thành công');
    } catch (error: any) {
      console.error('Failed to test email:', error);
      toast.error('Không thể test email');
    } finally {
      setTesting(false);
    }
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
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">Cấu hình Email</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Cấu hình SMTP để gửi email thông báo</p>
      </div>

      {/* Status Badge */}
      {isConfigured && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-sm font-medium text-emerald-400 flex items-center">
            <span className="mr-2">✅</span> Email đã được cấu hình. Hệ thống có thể gửi email thông báo.
          </p>
        </div>
      )}

      {/* SMTP Settings */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6 space-y-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide flex items-center">
          <Mail className="w-5 h-5 mr-2 text-indigo-400" />
          Cấu hình SMTP
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              SMTP Host *
            </label>
            <input
              type="text"
              value={settings.smtpHost}
              onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 transition-shadow"
              placeholder="smtp.gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              SMTP Port *
            </label>
            <input
              type="number"
              value={settings.smtpPort}
              onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 transition-shadow"
              placeholder="587"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              SMTP Username *
            </label>
            <input
              type="text"
              value={settings.smtpUsername}
              onChange={(e) => setSettings({ ...settings, smtpUsername: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 transition-shadow"
              placeholder="your-email@gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              SMTP Password {isConfigured && <span className="text-gray-500 font-normal">(để trống nếu không đổi)</span>}
            </label>
            <input
              type="password"
              value={settings.smtpPassword}
              onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 transition-shadow"
              placeholder={isConfigured ? '••••••••' : 'Mật khẩu SMTP'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              From Email *
            </label>
            <input
              type="email"
              value={settings.fromEmail}
              onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 transition-shadow"
              placeholder="noreply@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              From Name
            </label>
            <input
              type="text"
              value={settings.fromName}
              onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 transition-shadow"
              placeholder="Nope"
            />
          </div>
        </div>

        {/* TLS/SSL Options */}
        <div className="flex items-center space-x-8 pt-6 border-t border-slate-200 dark:border-gray-800">
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={settings.useTls}
              onChange={(e) => setSettings({ ...settings, useTls: e.target.checked, useSsl: false })}
              className="w-4 h-4 rounded bg-white dark:bg-[#111827] border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900 transition-colors"
            />
            <span className="ml-3 text-sm font-medium text-slate-700 dark:text-gray-300 group-hover:text-slate-900 dark:text-white transition-colors">Use TLS (Port 587)</span>
          </label>

          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={settings.useSsl}
              onChange={(e) => setSettings({ ...settings, useSsl: e.target.checked, useTls: false })}
              className="w-4 h-4 rounded bg-white dark:bg-[#111827] border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900 transition-colors"
            />
            <span className="ml-3 text-sm font-medium text-slate-700 dark:text-gray-300 group-hover:text-slate-900 dark:text-white transition-colors">Use SSL (Port 465)</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-slate-200 dark:border-gray-800">
          <button
            onClick={handleTest}
            disabled={testing || !isConfigured}
            className="flex items-center px-6 py-2.5 border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <Send className="w-4 h-4 mr-2" />
            {testing ? 'Đang test...' : 'Test Email'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20 font-medium"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
        <p className="text-sm text-indigo-200">
          <strong className="text-indigo-300">Lưu ý:</strong> Mật khẩu SMTP được mã hóa trước khi lưu vào database. 
          Nếu sử dụng Gmail, bạn cần tạo App Password thay vì dùng mật khẩu thường.
        </p>
      </div>
    </div>
  );
}
