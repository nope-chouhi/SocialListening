'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Palette, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export default function AppearanceSettings() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState({
    theme: 'system',
    language: 'vi',
    sidebarCollapsed: false,
    itemsPerPage: 20
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/api/auth/me/preferences');
      const data = response.data;
      const newSettings = {
        theme: data.theme,
        language: data.language,
        sidebarCollapsed: data.sidebar_collapsed,
        itemsPerPage: data.items_per_page
      };
      setSettings(newSettings);
      // Apply theme immediately
      applyTheme(data.theme);
    } catch (error) {
      console.error('Failed to load preferences:', error);
      toast.error('Không thể tải cài đặt giao diện');
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (theme: string) => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System theme
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const handleSave = async () => {
    console.log('🔵 [AppearanceSettings] handleSave called');
    console.log('🔵 [AppearanceSettings] Current settings:', settings);
    
    setSaving(true);
    try {
      const payload = {
        theme: settings.theme,
        language: settings.language,
        sidebar_collapsed: settings.sidebarCollapsed,
        items_per_page: settings.itemsPerPage
      };
      console.log('🔵 [AppearanceSettings] Payload:', payload);
      
      const response = await api.put('/api/auth/me/preferences', payload);
      const data = response.data;
      console.log('✅ [AppearanceSettings] Success:', data);
      // Apply theme immediately
      applyTheme(settings.theme);
      toast.success('✅ Đã lưu cài đặt giao diện');
    } catch (error: any) {
      console.error('❌ [AppearanceSettings] Exception:', error);
      toast.error(error.response?.data?.detail || 'Không thể lưu cài đặt giao diện');
    } finally {
      setSaving(false);
      console.log('🔵 [AppearanceSettings] handleSave finished');
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
        <h2 className="text-xl font-semibold text-gray-900">Giao diện</h2>
        <p className="text-sm text-gray-600 mt-1">Tùy chỉnh giao diện ứng dụng</p>
      </div>

      {/* Appearance Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        {/* Theme */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-3">
            Chủ đề
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'light', label: 'Sáng', icon: '☀️' },
              { value: 'dark', label: 'Tối', icon: '🌙' },
              { value: 'system', label: 'Hệ thống', icon: '💻' }
            ].map((theme) => (
              <button
                key={theme.value}
                onClick={() => {
                  console.log(`🔴 THEME BUTTON CLICKED - ${theme.value}`);
                  console.log(`🔵 [AppearanceSettings] Theme changed to:`, theme.value);
                  setSettings({ ...settings, theme: theme.value });
                  // Apply theme immediately
                  applyTheme(theme.value);
                }}
                className={`p-4 border-2 rounded-lg transition-colors ${
                  settings.theme === theme.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">{theme.icon}</div>
                <div className="text-sm font-medium text-gray-900">{theme.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Ngôn ngữ
          </label>
          <select
            value={settings.language}
            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Items per page */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Số mục mỗi trang
          </label>
          <select
            value={settings.itemsPerPage}
            onChange={(e) => setSettings({ ...settings, itemsPerPage: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>

        {/* Sidebar Collapsed */}
        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-900">Thu gọn sidebar</p>
            <p className="text-xs text-gray-500 mt-1">Sidebar sẽ thu gọn mặc định</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.sidebarCollapsed}
              onChange={(e) => setSettings({ ...settings, sidebarCollapsed: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={() => {
              console.log('🔴 SAVE BUTTON CLICKED');
              console.log('🔴 Current settings:', settings);
              handleSave();
            }}
            disabled={saving}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? t('common.saving') : t('settings.saveSettings')}
          </button>
        </div>
      </div>
    </div>
  );
}
