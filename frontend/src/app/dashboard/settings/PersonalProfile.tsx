'use client';

import { useState, useEffect, useRef } from 'react';
import { User as UserIcon, Save, Upload } from 'lucide-react';
import { auth } from '@/lib/api';
import { getRoleDisplayName, getRoleBadgeColor } from '@/lib/permissions';
import toast from 'react-hot-toast';

export default function PersonalProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    role: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const user = await auth.getCurrentUser();
      setProfile({
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        department: user.department || '',
        role: user.role || 'viewer'
      });
      // Load avatar if exists
      if (user.avatar_url) {
        setAvatarUrl(user.avatar_url);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      toast.error('Không thể tải thông tin cá nhân');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return; // Prevent double-click
    
    if (!profile.full_name || profile.full_name.trim() === '') {
      toast.error('Vui lòng nhập họ và tên');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/auth/me/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: profile.full_name.trim(),
          phone: profile.phone?.trim() || null,
          department: profile.department?.trim() || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update profile');
      }

      toast.success('✅ Đã lưu thông tin cá nhân');
      await loadProfile(); // Reload to verify
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Lỗi khi lưu thông tin');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh (JPG, PNG)');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 2MB');
      return;
    }

    setUploading(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      // TODO: Upload to server when avatar endpoint is ready
      // For now, just show preview
      toast.success('✅ Đã tải ảnh lên (chức năng lưu ảnh đang phát triển)');
      
      // Uncomment when backend avatar endpoint is ready:
      /*
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('https://social-listening-backend.onrender.com/api/auth/me/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      const data = await response.json();
      setAvatarUrl(data.avatar_url);
      toast.success('✅ Đã cập nhật ảnh đại diện');
      */
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || 'Lỗi khi tải ảnh lên');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-wide">Hồ sơ cá nhân</h2>
        <p className="text-sm text-gray-400 mt-1">Quản lý thông tin cá nhân của bạn</p>
      </div>

      {/* Avatar */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center space-x-6">
          <div className="w-24 h-24 bg-[#1E293B] border border-gray-700 rounded-full flex items-center justify-center overflow-hidden shadow-inner">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-12 h-12 text-gray-500" />
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handleFileChange}
              className="hidden"
            />
            <button 
              onClick={handleUploadClick}
              disabled={uploading}
              className="flex items-center px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20 font-medium"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Đang tải...' : 'Tải ảnh lên'}
            </button>
            <p className="text-xs text-gray-500 mt-2 font-medium">JPG, PNG. Tối đa 2MB</p>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Họ và tên *
            </label>
            <input
              type="text"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-4 py-2.5 bg-[#1E293B]/50 border border-gray-800 rounded-xl text-gray-500 cursor-not-allowed opacity-70"
            />
            <p className="text-xs text-gray-500 mt-1.5 font-medium">Email không thể thay đổi</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Số điện thoại
            </label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
              placeholder="+84 xxx xxx xxx"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Phòng ban
            </label>
            <input
              type="text"
              value={profile.department}
              onChange={(e) => setProfile({ ...profile, department: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
              placeholder="Ví dụ: Marketing"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Vai trò
            </label>
            <div className="flex items-center space-x-3 mt-1">
              <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${getRoleBadgeColor(profile.role)}`}>
                {getRoleDisplayName(profile.role)}
              </span>
              <span className="text-xs font-medium text-gray-500">(Chỉ admin có thể thay đổi)</span>
            </div>
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
