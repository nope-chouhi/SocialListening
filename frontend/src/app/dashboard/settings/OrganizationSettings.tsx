'use client';

import { useState, useEffect } from 'react';
import { Building, Save, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OrganizationSettings() {
  const [settings, setSettings] = useState({
    organizationName: '',
    logoUrl: '',
    address: '',
    contactEmail: '',
    hotline: '',
    website: '',
    timezone: 'Asia/Ho_Chi_Minh',
    language: 'vi'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/admin/settings/organization', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSettings({
          organizationName: data.organization_name || '',
          logoUrl: data.logo_url || '',
          address: data.address || '',
          contactEmail: data.contact_email || '',
          hotline: data.hotline || '',
          website: data.website || '',
          timezone: data.timezone || 'Asia/Ho_Chi_Minh',
          language: data.language || 'vi'
        });
      }
    } catch (error) {
      console.error('Failed to load organization settings:', error);
      toast.error('Không thể tải thông tin tổ chức');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/admin/settings/organization', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organization_name: settings.organizationName,
          logo_url: settings.logoUrl,
          address: settings.address,
          contact_email: settings.contactEmail,
          hotline: settings.hotline,
          website: settings.website,
          timezone: settings.timezone,
          language: settings.language
        })
      });

      if (response.ok) {
        toast.success('Đã lưu thông tin tổ chức');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Không thể lưu thông tin');
      }
    } catch (error) {
      console.error('Failed to save organization settings:', error);
      toast.error('Không thể lưu thông tin tổ chức');
    } finally {
      setSaving(false);
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
        <h2 className="text-xl font-bold text-white tracking-wide">Thông tin tổ chức</h2>
        <p className="text-sm text-gray-400 mt-1">Cấu hình thông tin công ty</p>
      </div>

      {/* Logo Upload */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl shadow-sm p-6">
        <label className="block text-sm font-medium text-gray-300 mb-4">Logo công ty</label>
        <div className="flex items-center space-x-6">
          <div className="w-24 h-24 bg-[#1E293B] rounded-xl flex items-center justify-center border-2 border-dashed border-gray-700">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-xl p-2" />
            ) : (
              <Building className="w-10 h-10 text-gray-500" />
            )}
          </div>
          <div>
            <button className="flex items-center px-4 py-2.5 bg-[#1E293B] border border-gray-700 text-gray-300 rounded-xl hover:bg-gray-800 hover:text-white transition-colors font-medium shadow-sm">
              <Upload className="w-4 h-4 mr-2 text-gray-400" />
              Tải logo lên
            </button>
            <p className="text-xs text-gray-500 mt-2.5 font-medium">PNG, JPG. Tối đa 2MB. Khuyến nghị 200x200px</p>
          </div>
        </div>
      </div>

      {/* Organization Info */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tên tổ chức *
            </label>
            <input
              type="text"
              value={settings.organizationName}
              onChange={(e) => setSettings({ ...settings, organizationName: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
              placeholder="Ví dụ: Công ty TNHH ABC"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Địa chỉ
            </label>
            <textarea
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500 resize-none"
              placeholder="Địa chỉ văn phòng"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email liên hệ
            </label>
            <input
              type="email"
              value={settings.contactEmail}
              onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
              placeholder="contact@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Hotline
            </label>
            <input
              type="tel"
              value={settings.hotline}
              onChange={(e) => setSettings({ ...settings, hotline: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
              placeholder="1900 xxxx"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Website
            </label>
            <input
              type="url"
              value={settings.website}
              onChange={(e) => setSettings({ ...settings, website: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
              placeholder="https://company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Múi giờ
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
            >
              <option value="Asia/Ho_Chi_Minh">Việt Nam (GMT+7)</option>
              <option value="Asia/Bangkok">Bangkok (GMT+7)</option>
              <option value="Asia/Singapore">Singapore (GMT+8)</option>
              <option value="Asia/Tokyo">Tokyo (GMT+9)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ngôn ngữ mặc định
            </label>
            <select
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-800">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20 font-medium"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}
