'use client';

import { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, X, Check, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDialog } from '@/components/ui/Dialog';

interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

interface RoleFormData {
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
  is_active: boolean;
}

export default function RoleManagement() {
  const { confirm } = useDialog();
  const [roles, setRoles] = useState<Role[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    display_name: '',
    description: '',
    permissions: [],
    is_active: true
  });

  useEffect(() => {
    loadRoles();
    loadAvailablePermissions();
  }, []);

  const loadRoles = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/admin/roles/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load roles');
      
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error('Error loading roles:', error);
      toast.error('Không thể tải danh sách vai trò');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePermissions = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/admin/roles/permissions/available', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load permissions');
      
      const data = await response.json();
      setAvailablePermissions(data);
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  const handleCreate = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      display_name: '',
      description: '',
      permissions: [],
      is_active: true
    });
    setShowModal(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      display_name: role.display_name,
      description: role.description || '',
      permissions: role.permissions,
      is_active: role.is_active
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('access_token');
      const url = editingRole
        ? `https://social-listening-backend.onrender.com/api/admin/roles/${editingRole.id}`
        : 'https://social-listening-backend.onrender.com/api/admin/roles/';
      
      const method = editingRole ? 'PUT' : 'POST';
      
      // For system roles, only send permissions and is_active
      const payload = editingRole?.is_system
        ? { permissions: formData.permissions, is_active: formData.is_active }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save role');
      }

      toast.success(editingRole ? 'Cập nhật vai trò thành công' : 'Tạo vai trò thành công');
      setShowModal(false);
      loadRoles();
    } catch (error: any) {
      console.error('Error saving role:', error);
      toast.error(error.message || 'Không thể lưu vai trò');
    }
  };

  const handleDelete = async (role: Role) => {
    const ok = await confirm({
      title: 'Xóa vai trò',
      message: `Bạn có chắc muốn xóa vai trò "${role.display_name}"?`,
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`https://social-listening-backend.onrender.com/api/admin/roles/${role.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete role');
      }

      toast.success('Xóa vai trò thành công');
      loadRoles();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast.error(error.message || 'Không thể xóa vai trò');
    }
  };

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">Quản lý vai trò</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Định nghĩa vai trò và quyền hạn trong hệ thống</p>
        </div>
        <button 
          onClick={handleCreate}
          className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20 font-medium"
        >
          <Plus className="w-5 h-5 mr-2" />
          Thêm vai trò
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {roles.map((role) => (
          <div key={role.id} className={`bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow ${!role.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-xl border ${role.is_system ? 'bg-purple-500/10 border-purple-500/20' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
                  <Shield className={`w-6 h-6 ${role.is_system ? 'text-purple-400' : 'text-indigo-400'}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide">{role.display_name}</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 font-mono mt-0.5">{role.name}</p>
                  {role.is_system && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md">
                      Hệ thống
                    </span>
                  )}
                </div>
              </div>
              <div className="flex space-x-1">
                <button 
                  onClick={() => handleEdit(role)}
                  className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                  title="Chỉnh sửa"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {!role.is_system && (
                  <button 
                    onClick={() => handleDelete(role)}
                    className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Xóa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {role.description && (
              <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">{role.description}</p>
            )}

            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-gray-300 mb-2.5">Quyền hạn ({role.permissions.length}):</p>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(role.permissions) && role.permissions.slice(0, 5).map((perm, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 text-xs bg-white dark:bg-[#1E293B] text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-gray-700 rounded-md"
                  >
                    {perm}
                  </span>
                ))}
                {role.permissions.length > 5 && (
                  <span className="px-2.5 py-1 text-xs bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-gray-700 rounded-md">
                    +{role.permissions.length - 5} more
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide">
                {editingRole ? `Chỉnh sửa vai trò: ${editingRole.display_name}` : 'Tạo vai trò mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:text-gray-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {editingRole?.is_system && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-200">
                  <strong className="text-amber-300">Lưu ý:</strong> Vai trò hệ thống chỉ có thể chỉnh sửa quyền hạn và trạng thái.
                </div>
              )}

              {!editingRole?.is_system && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                      Mã vai trò <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white placeholder-gray-500"
                      placeholder="e.g., content_moderator"
                      required
                      disabled={!!editingRole}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                      Tên hiển thị <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white placeholder-gray-500"
                      placeholder="e.g., Người kiểm duyệt nội dung"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Mô tả</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white placeholder-gray-500"
                      rows={2}
                      placeholder="Mô tả vai trò này..."
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Quyền hạn <span className="text-rose-500">*</span>
                </label>
                <div className="border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1E293B] rounded-xl p-4 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3">
                    {availablePermissions.map((permission) => (
                      <label key={permission} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-800 p-2 rounded-lg transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(permission)}
                          onChange={() => togglePermission(permission)}
                          className="w-4 h-4 rounded bg-white dark:bg-[#111827] border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{permission}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-2 font-medium">
                  Đã chọn: <span className="text-indigo-400">{formData.permissions.length}</span> quyền
                </p>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded bg-white dark:bg-[#111827] border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-slate-700 dark:text-gray-300">
                  Vai trò đang hoạt động
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-white dark:bg-[#1E293B] text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20 font-medium"
                >
                  {editingRole ? 'Cập nhật' : 'Tạo vai trò'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
        <p className="text-sm text-indigo-200">
          <strong className="text-indigo-300">Lưu ý:</strong> Vai trò hệ thống (Super Admin, Admin, Manager, Analyst, Viewer) không thể xóa. 
          Thay đổi quyền hạn sẽ ảnh hưởng đến tất cả người dùng có vai trò đó.
        </p>
      </div>
    </div>
  );
}
