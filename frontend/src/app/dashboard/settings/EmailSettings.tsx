'use client';

import { useState, useEffect } from 'react';
import { Mail, Save, Send } from 'lucide-react';
import toast from 'react-hot-toast';

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
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/admin/settings/email', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
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
      }
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
      const token = localStorage.getItem('access_token');
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

      const response = await fetch('https://social-listening-backend.onrender.com/api/admin/settings/email', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setIsConfigured(data.is_configured);
        toast.success('Đã lưu cấu hình email');
        // Clear password field after save
        setSettings({ ...settings, smtpPassword: '' });
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Không thể lưu cấu hình');
      }
    } catch (error) {
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
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/admin/settings/email/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Email test thành công');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Test email thất bại');
      }
    } catch (error) {
      console.error('Failed to test email:', error);
      toast.error('Không thể test email');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Cấu hình Email</h2>
        <p className="text-sm text-gray-600 mt-1">Cấu hình SMTP để gửi email thông báo</p>
      </div>

      {/* Status Badge */}
      {isConfigured && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">
            ✅ Email đã được cấu hình. Hệ thống có thể gửi email thông báo.
          </p>
        </div>
      )}

      {/* SMTP Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Mail className="w-5 h-5 mr-2" />
          Cấu hình SMTP
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              SMTP Host *
            </label>
            <input
              type="text"
              value={settings.smtpHost}
              onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="smtp.gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              SMTP Port *
            </label>
            <input
              type="number"
              value={settings.smtpPort}
              onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="587"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              SMTP Username *
            </label>
            <input
              type="text"
              value={settings.smtpUsername}
              onChange={(e) => setSettings({ ...settings, smtpUsername: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your-email@gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              SMTP Password {isConfigured && '(để trống nếu không đổi)'}
            </label>
            <input
              type="password"
              value={settings.smtpPassword}
              onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={isConfigured ? '••••••••' : 'Mật khẩu SMTP'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              From Email *
            </label>
            <input
              type="email"
              value={settings.fromEmail}
              onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="noreply@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              From Name
            </label>
            <input
              type="text"
              value={settings.fromName}
              onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nope"
            />
          </div>
        </div>

        {/* TLS/SSL Options */}
        <div className="flex items-center space-x-6 pt-4 border-t border-gray-100">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.useTls}
              onChange={(e) => setSettings({ ...settings, useTls: e.target.checked, useSsl: false })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-900">Use TLS (Port 587)</span>
          </label>

          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.useSsl}
              onChange={(e) => setSettings({ ...settings, useSsl: e.target.checked, useTls: false })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-900">Use SSL (Port 465)</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            onClick={handleTest}
            disabled={testing || !isConfigured}
            className="flex items-center px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4 mr-2" />
            {testing ? 'Đang test...' : 'Test Email'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Lưu ý:</strong> Mật khẩu SMTP được mã hóa trước khi lưu vào database. 
          Nếu sử dụng Gmail, bạn cần tạo App Password thay vì dùng mật khẩu thường.
        </p>
      </div>
    </div>
  );
}
