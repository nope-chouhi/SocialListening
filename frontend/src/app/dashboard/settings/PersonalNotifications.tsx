'use client';

import { useState, useEffect } from 'react';
import { Bell, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PersonalNotifications() {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    inAppNotifications: true,
    alertNotifications: true,
    incidentNotifications: true,
    reportNotifications: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/auth/me/notification-settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSettings({
          emailNotifications: data.email_notifications,
          inAppNotifications: data.in_app_notifications,
          alertNotifications: data.alert_notifications,
          incidentNotifications: data.incident_notifications,
          reportNotifications: data.report_notifications
        });
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      toast.error('Không thể tải cài đặt thông báo');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    console.log('🔵 [PersonalNotifications] handleSave called');
    console.log('🔵 [PersonalNotifications] Current settings:', settings);
    
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      console.log('🔵 [PersonalNotifications] Token:', token ? 'exists' : 'missing');
      
      const payload = {
        email_notifications: settings.emailNotifications,
        in_app_notifications: settings.inAppNotifications,
        alert_notifications: settings.alertNotifications,
        incident_notifications: settings.incidentNotifications,
        report_notifications: settings.reportNotifications
      };
      console.log('🔵 [PersonalNotifications] Payload:', payload);
      
      const response = await fetch('https://social-listening-backend.onrender.com/api/auth/me/notification-settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('🔵 [PersonalNotifications] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [PersonalNotifications] Success:', data);
        toast.success('✅ Đã lưu cài đặt thông báo');
      } else {
        const error = await response.json();
        console.error('❌ [PersonalNotifications] Error:', error);
        toast.error(error.detail || 'Không thể lưu cài đặt');
      }
    } catch (error) {
      console.error('❌ [PersonalNotifications] Exception:', error);
      toast.error('Không thể lưu cài đặt thông báo');
    } finally {
      setSaving(false);
      console.log('🔵 [PersonalNotifications] handleSave finished');
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
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">Thông báo cá nhân</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Quản lý thông báo bạn nhận được</p>
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6 space-y-4">
        <div className="space-y-4">
          {[
            { key: 'emailNotifications', label: 'Email notifications', description: 'Nhận thông báo qua email' },
            { key: 'inAppNotifications', label: 'In-app notifications', description: 'Hiển thị thông báo trong ứng dụng' },
            { key: 'alertNotifications', label: 'Cảnh báo', description: 'Thông báo khi có cảnh báo mới' },
            { key: 'incidentNotifications', label: 'Sự cố', description: 'Thông báo khi được gán sự cố' },
            { key: 'reportNotifications', label: 'Báo cáo', description: 'Nhận báo cáo định kỳ' }
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-gray-800 last:border-0">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={settings[item.key as keyof typeof settings]}
                  onChange={(e) => {
                    console.log(`🔴 TOGGLE - ${item.key}:`, e.target.checked);
                    setSettings({ ...settings, [item.key]: e.target.checked });
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white dark:bg-[#1E293B] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-gray-800">
          <button
            onClick={() => {
              console.log('🔴 SAVE BUTTON CLICKED');
              console.log('🔴 Current settings:', settings);
              handleSave();
            }}
            disabled={saving}
            className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20 font-medium"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
      </div>
    </div>
  );
}
