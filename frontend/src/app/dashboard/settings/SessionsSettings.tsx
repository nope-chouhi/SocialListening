'use client';

import { useState, useEffect } from 'react';
import { Clock, Monitor, LogOut, AlertCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDialog } from '@/components/ui/Dialog';
import { api } from '@/lib/api';

interface Session {
  id: number;
  device_type: string;
  ip_address: string | null;
  user_agent: string | null;
  location: string | null;
  created_at: string;
  last_active_at: string;
  expires_at: string;
}

export default function SessionsSettings() {
  const { confirm } = useDialog();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<number | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await api.get('/api/auth/me/sessions');
      const data = response.data;
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      toast.error('Không thể tải danh sách phiên đăng nhập');
    } finally {
      setLoading(false);
    }
  };

  const revokeSession = async (sessionId: number) => {
    if (revoking) return;

    const ok = await confirm({
      title: 'Đăng xuất phiên',
      message: 'Bạn có chắc muốn đăng xuất phiên này?',
      variant: 'warning'
    });
    if (!ok) {
      return;
    }

    setRevoking(sessionId);
    try {
      await api.post(`/api/auth/me/sessions/${sessionId}/revoke`);
      toast.success('✅ Đã đăng xuất phiên thành công');
      loadSessions(); // Reload sessions
    } catch (error: any) {
      console.error('Failed to revoke session:', error);
      toast.error(error.response?.data?.detail || 'Không thể đăng xuất phiên');
    } finally {
      setRevoking(null);
    }
  };

  const logoutAllOtherSessions = async () => {
    const ok = await confirm({
      title: 'Đăng xuất tất cả',
      message: 'Bạn có chắc muốn đăng xuất tất cả các phiên khác?',
      variant: 'warning'
    });
    if (!ok) {
      return;
    }

    try {
      await api.post('/api/auth/me/logout-other-sessions');
      toast.success('✅ Đã đăng xuất tất cả các phiên khác');
      loadSessions(); // Reload sessions
    } catch (error: any) {
      console.error('Failed to logout other sessions:', error);
      toast.error(error.response?.data?.detail || 'Không thể đăng xuất các phiên khác');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('vi-VN');
    } catch {
      return 'N/A';
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return '📱';
      case 'tablet':
        return '📱';
      case 'desktop':
        return '💻';
      default:
        return '🖥️';
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
        <h2 className="text-xl font-semibold text-gray-900">Phiên đăng nhập</h2>
        <p className="text-sm text-gray-600 mt-1">Quản lý các phiên đăng nhập của bạn</p>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-yellow-900 mb-2">
                Không có phiên đăng nhập nào
              </h3>
              <p className="text-sm text-yellow-800">
                Bạn chưa có phiên đăng nhập nào được lưu trữ. Đăng nhập lại để tạo phiên mới.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Logout All Button */}
          <div className="flex justify-end">
            <button
              onClick={logoutAllOtherSessions}
              className="flex items-center px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Đăng xuất tất cả phiên khác
            </button>
          </div>

          {/* Sessions */}
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="text-3xl">
                      {getDeviceIcon(session.device_type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {session.device_type === 'unknown' ? 'Thiết bị không xác định' : session.device_type}
                      </p>
                      {session.user_agent && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {session.user_agent}
                        </p>
                      )}
                      {session.ip_address && (
                        <p className="text-xs text-gray-500 mt-1">
                          IP: {session.ip_address}
                        </p>
                      )}
                      {session.location && (
                        <p className="text-xs text-gray-500 mt-1">
                          📍 {session.location}
                        </p>
                      )}
                      <div className="flex items-center mt-2 text-xs text-gray-500 space-x-4">
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          Đăng nhập: {formatDate(session.created_at)}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          Hoạt động: {formatDate(session.last_active_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => revokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="flex items-center px-3 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-4"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {revoking === session.id ? 'Đang xóa...' : 'Đăng xuất'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Lưu ý:</strong> Khi bạn đăng xuất một phiên, token của phiên đó sẽ bị vô hiệu hóa ngay lập tức.
          Nếu phát hiện hoạt động đáng ngờ, hãy đăng xuất tất cả các phiên và đổi mật khẩu.
        </p>
      </div>
    </div>
  );
}
