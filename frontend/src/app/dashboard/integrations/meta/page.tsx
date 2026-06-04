'use client';

import { useState, useEffect } from 'react';
import { Shield, Facebook, Instagram, CheckCircle2, XCircle, Loader2, ArrowLeft, Plug, LogOut, CheckSquare, Square } from 'lucide-react';
import Link from 'next/link';
import { useDialog } from '@/components/ui/Dialog';

interface MetaAccount {
  id: number;
  external_id: string;
  provider: string;
  account_type: string;
  name: string;
  selected: boolean;
}

interface MetaStatus {
  status: 'config_required' | 'oauth_required' | 'limited' | 'active';
  label: string;
  message: string;
  granted_scopes: string[];
  missing_scopes: string[];
  accounts: MetaAccount[];
}

export default function MetaIntegrationPage() {
  const { confirm } = useDialog();
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Using relative URLs to proxy through Next.js rewrites

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/integrations/meta/status`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setMetaStatus(data);
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/integrations/meta/auth-url`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Không lấy được URL kết nối');
        setActionLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi gọi API');
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: 'Ngắt kết nối Meta',
      message: 'Bạn có chắc muốn ngắt kết nối Meta? Mọi tài khoản đang đồng bộ sẽ bị dừng.',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      setActionLoading(true);
      await fetch(`/api/integrations/meta/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      await fetchStatus();
      setSuccessMsg('Đã ngắt kết nối thành công.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Lỗi khi ngắt kết nối');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAccount = async (accountId: string, currentSelected: boolean) => {
    try {
      const res = await fetch(`/api/integrations/meta/select-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ account_id: accountId, selected: !currentSelected })
      });
      if (res.ok) {
        // Update local state smoothly
        setMetaStatus(prev => prev ? {
          ...prev,
          accounts: prev.accounts.map(acc => 
            acc.external_id === accountId ? { ...acc, selected: !currentSelected } : acc
          )
        } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestConnection = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/integrations/meta/test-connection`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Kết nối hoạt động tốt!');
      } else {
        setError(data.message || 'Lỗi kết nối');
      }
      setTimeout(() => { setSuccessMsg(''); setError(''); }, 3000);
    } catch (err) {
      console.error(err);
      setError('Không thể test kết nối.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Link href="/dashboard/sources" className="inline-flex items-center text-sm font-medium text-gray-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại Quản lý Nguồn
      </Link>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-white/10 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-fuchsia-500 opacity-50" />
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/20 rounded-2xl shadow-inner border border-blue-500/30">
              <Facebook className="w-8 h-8 text-blue-400" />
            </div>
            <div className="p-3 bg-fuchsia-500/20 rounded-2xl shadow-inner border border-fuchsia-500/30">
              <Instagram className="w-8 h-8 text-fuchsia-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Kết nối Facebook & Instagram</h1>
          <p className="text-gray-300 max-w-2xl leading-relaxed">
            Nope sử dụng Meta OAuth chính thức để kết nối Facebook Page và Instagram Business/Creator. 
            Hệ thống <strong>không yêu cầu mật khẩu</strong> và chỉ thu thập dữ liệu trong phạm vi quyền bạn cấp.
          </p>
        </div>

        <div className="p-8 space-y-8">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-400 mt-0.5" />
              <div className="text-rose-300 text-sm">{error}</div>
            </div>
          )}
          
          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div className="text-emerald-300 text-sm">{successMsg}</div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
          ) : metaStatus ? (
            <>
              {/* Status Section */}
              <div className="bg-[#050A15] border border-white/10 rounded-2xl p-6 shadow-inner">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-1">Trạng thái kết nối</h2>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                        metaStatus.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : metaStatus.status === 'limited' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}>
                        {metaStatus.label}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {(metaStatus.status === 'active' || metaStatus.status === 'limited') ? (
                      <>
                        <button 
                          onClick={handleTestConnection}
                          disabled={actionLoading}
                          className="flex-1 sm:flex-none px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          Kiểm tra kết nối
                        </button>
                        <button 
                          onClick={handleDisconnect}
                          disabled={actionLoading}
                          className="flex-1 sm:flex-none px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <LogOut className="w-4 h-4" /> Ngắt kết nối
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={handleConnect}
                        disabled={actionLoading || metaStatus.status === 'config_required'}
                        className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                        Connect Facebook / Instagram
                      </button>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-gray-400 mt-2 bg-white/5 p-3 rounded-xl border border-white/5">
                  <Shield className="w-4 h-4 inline-block mr-1 text-gray-500" /> 
                  {metaStatus.message}
                </p>
              </div>

              {/* Permissions Section */}
              {(metaStatus.status === 'active' || metaStatus.status === 'limited') && (
                <div className="bg-[#050A15] border border-white/10 rounded-2xl p-6 shadow-inner">
                  <h2 className="text-lg font-semibold text-white mb-4">Quyền truy cập đã cấp (Scopes)</h2>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {metaStatus.granted_scopes.map((scope, idx) => (
                      <span key={idx} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {scope}
                      </span>
                    ))}
                    {metaStatus.missing_scopes.map((scope, idx) => (
                      <span key={idx} className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> {scope} (thiếu)
                      </span>
                    ))}
                  </div>
                  {metaStatus.missing_scopes.length > 0 && (
                    <p className="text-xs text-amber-400/80 mt-2">
                      ⚠️ Bạn đã từ chối một số quyền. Hệ thống sẽ không thể thu thập đủ dữ liệu. Vui lòng kết nối lại và cấp đủ quyền.
                    </p>
                  )}
                </div>
              )}

              {/* Accounts Section */}
              {(metaStatus.status === 'active' || metaStatus.status === 'limited') && (
                <div className="bg-[#050A15] border border-white/10 rounded-2xl p-6 shadow-inner">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Tài khoản & Trang (Pages)</h2>
                    <span className="text-xs text-gray-400">Chọn nguồn để thu thập</span>
                  </div>
                  
                  {metaStatus.accounts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm bg-white/5 rounded-xl border border-white/5">
                      Không tìm thấy Page hoặc tài khoản Instagram Business nào.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {metaStatus.accounts.map(acc => (
                        <div 
                          key={acc.id} 
                          onClick={() => handleToggleAccount(acc.external_id, acc.selected)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${
                            acc.selected ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-white/5 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {acc.provider === 'facebook' ? (
                              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                                <Facebook className="w-5 h-5 text-blue-400" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-fuchsia-500/20 flex items-center justify-center border border-fuchsia-500/30">
                                <Instagram className="w-5 h-5 text-fuchsia-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-white truncate">{acc.name}</h3>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">{acc.account_type}</p>
                          </div>
                          <div>
                            {acc.selected ? (
                              <CheckSquare className="w-5 h-5 text-indigo-400" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
