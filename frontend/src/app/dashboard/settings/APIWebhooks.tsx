'use client';

import { useState, useEffect } from 'react';
import { Key, Plus, Copy, Eye, EyeOff, Trash2, Power, PowerOff, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '@/lib/api';
import { useDialog } from '@/components/ui/Dialog';

interface APIKey {
  id: number;
  name: string;
  prefix: string;
  permissions: string[];
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface APIKeyCreateResponse extends APIKey {
  full_key: string;
}

export default function APIWebhooks() {
  const { confirm } = useDialog();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    permissions: [] as string[],
    expires_at: ''
  });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [availablePermissions] = useState([
    'mentions.read', 'mentions.write',
    'keywords.read', 'keywords.write',
    'sources.read', 'sources.write',
    'reports.read', 'alerts.read'
  ]);

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const loadAPIKeys = async () => {
    try {
      const response = await api.get('/api/api-keys/');
      setApiKeys(response.data);
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast.error('Không thể tải danh sách API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        name: newKeyData.name,
        permissions: newKeyData.permissions,
        expires_at: newKeyData.expires_at || null
      };

      const response = await api.post('/api/api-keys/', payload);
      const data: APIKeyCreateResponse = response.data;
      setCreatedKey(data.full_key);
      toast.success('Tạo API key thành công');
      loadAPIKeys();
    } catch (error: any) {
      console.error('Error creating API key:', error);
      toast.error(error.response?.data?.detail || 'Không thể tạo API key');
    }
  };

  const handleRevoke = async (keyId: number) => {
    const ok = await confirm({
      title: 'Thu hồi API Key',
      message: 'Bạn có chắc muốn thu hồi API key này? Hành động này không thể hoàn tác.',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      await api.delete(`/api/api-keys/${keyId}`);
      toast.success('Thu hồi API key thành công');
      loadAPIKeys();
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast.error('Không thể thu hồi API key');
    }
  };

  const handleToggleActive = async (keyId: number, currentStatus: boolean) => {
    try {
      const action = currentStatus ? 'deactivate' : 'activate';
      await api.post(`/api/api-keys/${keyId}/${action}`);
      toast.success(currentStatus ? 'Vô hiệu hóa thành công' : 'Kích hoạt thành công');
      loadAPIKeys();
    } catch (error) {
      console.error('Error toggling API key:', error);
      toast.error('Không thể thay đổi trạng thái');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép vào clipboard');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Không giới hạn';
    return new Date(dateString).toLocaleDateString('vi-VN');
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
          <h2 className="text-xl font-bold text-white tracking-wide">API Keys & Webhooks</h2>
          <p className="text-sm text-gray-400 mt-1">Quản lý API keys để truy cập programmatic</p>
        </div>
        <button 
          onClick={() => {
            setShowModal(true);
            setCreatedKey(null);
            setNewKeyData({ name: '', permissions: [], expires_at: '' });
          }}
          className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20 font-medium"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tạo API Key
        </button>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <div className="text-center py-12 bg-[#111827] border border-gray-800 rounded-xl shadow-sm">
            <Key className="w-12 h-12 mx-auto text-gray-500 mb-3" />
            <p className="text-gray-300 font-medium tracking-wide">Chưa có API key nào</p>
            <p className="text-sm text-gray-400 mt-1">Tạo API key để truy cập hệ thống qua API</p>
          </div>
        ) : (
          apiKeys.map((key) => (
            <div key={key.id} className={`bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm transition-opacity ${!key.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                      <Key className="w-4 h-4 text-indigo-400" />
                    </div>
                    <h3 className="font-bold text-white tracking-wide">{key.name}</h3>
                    {!key.is_active && (
                      <span className="px-2.5 py-1 text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700 rounded-md">
                        Vô hiệu hóa
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-3 mb-4">
                    <code className="px-4 py-1.5 bg-[#1E293B] border border-gray-700 text-gray-300 rounded-lg text-sm font-mono tracking-wider">
                      {key.prefix}••••••••
                    </code>
                    <button
                      onClick={() => copyToClipboard(key.prefix)}
                      className="p-1.5 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                      title="Sao chép prefix"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-5 text-xs text-gray-400 font-medium">
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                      Tạo: {formatDate(key.created_at)}
                    </span>
                    {key.expires_at && (
                      <span className="flex items-center text-amber-500/80">
                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                        Hết hạn: {formatDate(key.expires_at)}
                      </span>
                    )}
                    {key.last_used_at && (
                      <span className="flex items-center text-indigo-400/80">
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        Dùng lần cuối: {formatDate(key.last_used_at)}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-800/50">
                    <p className="text-xs font-medium text-gray-400 mb-2.5">Quyền hạn ({key.permissions.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {key.permissions.slice(0, 5).map((perm, idx) => (
                        <span key={idx} className="px-2.5 py-1 text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md uppercase tracking-wider">
                          {perm}
                        </span>
                      ))}
                      {key.permissions.length > 5 && (
                        <span className="px-2.5 py-1 text-[11px] font-medium bg-[#1E293B] text-gray-400 border border-gray-700 rounded-md">
                          +{key.permissions.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleToggleActive(key.id, key.is_active)}
                    className={`p-2 rounded-lg transition-colors ${key.is_active ? 'text-amber-500 hover:bg-amber-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'}`}
                    title={key.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                  >
                    {key.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleRevoke(key.id)}
                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Thu hồi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white tracking-wide">
                {createdKey ? 'API Key đã tạo' : 'Tạo API Key mới'}
              </h3>
            </div>

            {createdKey ? (
              <div className="p-6 space-y-6">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
                  <p className="text-sm text-amber-400 font-bold tracking-wide mb-2 flex items-center">
                    <span className="mr-2">⚠️</span> Lưu ý quan trọng
                  </p>
                  <p className="text-sm text-amber-200">
                    Đây là lần duy nhất bạn có thể xem API key đầy đủ. Hãy sao chép và lưu trữ an toàn.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    API Key của bạn:
                  </label>
                  <div className="flex items-center space-x-3">
                    <code className="flex-1 px-4 py-3 bg-[#1E293B] border border-indigo-500/30 text-indigo-300 rounded-xl text-sm font-mono break-all tracking-wider">
                      {createdKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdKey)}
                      className="p-3 text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors border border-transparent hover:border-indigo-500/20"
                      title="Sao chép"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setCreatedKey(null);
                    }}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20 font-medium"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tên API Key <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newKeyData.name}
                    onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-white placeholder-gray-500"
                    placeholder="e.g., Production API Key"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Quyền hạn
                  </label>
                  <div className="border border-gray-800 bg-[#1E293B] rounded-xl p-4 max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                      {availablePermissions.map((perm) => (
                        <label key={perm} className="flex items-center space-x-3 cursor-pointer group p-1.5 hover:bg-gray-800 rounded-lg transition-colors">
                          <input
                            type="checkbox"
                            checked={newKeyData.permissions.includes(perm)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewKeyData({ ...newKeyData, permissions: [...newKeyData.permissions, perm] });
                              } else {
                                setNewKeyData({ ...newKeyData, permissions: newKeyData.permissions.filter(p => p !== perm) });
                              }
                            }}
                            className="w-4 h-4 rounded bg-[#111827] border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                          />
                          <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ngày hết hạn (tùy chọn)
                  </label>
                  <input
                    type="datetime-local"
                    value={newKeyData.expires_at}
                    onChange={(e) => setNewKeyData({ ...newKeyData, expires_at: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-white [color-scheme:dark]"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2.5 bg-[#1E293B] text-gray-300 border border-gray-700 rounded-xl hover:bg-gray-800 transition-colors font-medium"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20 font-medium"
                  >
                    Tạo API Key
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
        <p className="text-sm text-indigo-200">
          <strong className="text-indigo-300">Lưu ý:</strong> API keys cho phép truy cập programmatic vào hệ thống. 
          Hãy giữ chúng an toàn và không chia sẻ công khai. Bạn có thể tạo tối đa 10 API keys đang hoạt động.
        </p>
      </div>
    </div>
  );
}
