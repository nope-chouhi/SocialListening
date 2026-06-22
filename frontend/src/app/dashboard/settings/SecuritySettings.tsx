'use client';

import { useState } from 'react';
import { Lock, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SecuritySettings() {
  const [saving, setSaving] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const handleChangePassword = async () => {
    if (saving) return; // Prevent double-click

    // Validation
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      toast.error('❌ Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (passwords.new !== passwords.confirm) {
      toast.error('❌ Mật khẩu mới không khớp');
      return;
    }

    if (passwords.new.length < 8) {
      toast.error('❌ Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/auth/me/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_password: passwords.current,
          new_password: passwords.new,
          confirm_password: passwords.confirm
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to change password');
      }

      toast.success('✅ Đã đổi mật khẩu thành công');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(`❌ ${error.message || 'Lỗi khi đổi mật khẩu'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">Bảo mật tài khoản</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Quản lý mật khẩu và bảo mật</p>
      </div>

      {/* Change Password */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6 space-y-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
          <Lock className="w-5 h-5 mr-2 text-indigo-400" />
          Đổi mật khẩu
        </h3>

        <div className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Mật khẩu hiện tại *
            </label>
            <input
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Mật khẩu mới *
            </label>
            <input
              type="password"
              value={passwords.new}
              onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
              placeholder="••••••••"
            />
            <p className="text-xs text-gray-500 mt-1.5 font-medium">Tối thiểu 8 ký tự</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Xác nhận mật khẩu mới *
            </label>
            <input
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-gray-800">
          <button
            onClick={handleChangePassword}
            disabled={saving}
            className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20 font-medium"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </div>

      {/* Security Info */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
        <p className="text-sm text-indigo-200">
          <strong className="text-indigo-300">Lưu ý:</strong> Sau khi đổi mật khẩu, bạn sẽ cần đăng nhập lại trên tất cả thiết bị.
        </p>
      </div>
    </div>
  );
}
