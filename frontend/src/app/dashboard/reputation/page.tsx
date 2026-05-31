'use client';

import { useState, useEffect } from 'react';
import { 
  ShieldAlert, ShieldCheck, Scale, FileText, Bot, Plus, ArrowRight, X, AlertTriangle, AlertCircle, FileSearch, Trash2, ExternalLink
} from 'lucide-react';
import { reputation } from '@/lib/api';
import { toast } from 'react-hot-toast';

export default function ReputationPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('');
  
  // Stats
  const stats = [
    { label: 'Hồ sơ đang xử lý', value: cases.filter(c => c.status !== 'closed' && c.status !== 'resolved').length, icon: ShieldAlert, color: 'text-amber-500' },
    { label: 'Rủi ro cao', value: cases.filter(c => c.risk_level === 'high' || c.risk_level === 'critical').length, icon: AlertTriangle, color: 'text-red-500' },
    { label: 'Chờ phê duyệt', value: cases.filter(c => c.status === 'waiting_approval').length, icon: FileSearch, color: 'text-blue-500' },
    { label: 'Đã giải quyết', value: cases.filter(c => c.status === 'resolved').length, icon: ShieldCheck, color: 'text-emerald-500' },
  ];

  useEffect(() => {
    fetchCases();
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    try {
      const { auth } = await import('@/lib/api');
      const user = await auth.getCurrentUser();
      if (user && user.role) {
        setUserRole(user.role);
      }
    } catch (error) {
      console.error('Failed to fetch user role', error);
    }
  };

  const fetchCases = async () => {
    setIsLoading(true);
    try {
      const data = await reputation.listCases();
      setCases(data);
    } catch (error) {
      toast.error('Lỗi khi tải danh sách hồ sơ');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCaseDetail = async (id: number) => {
    try {
      const data = await reputation.getCase(id);
      setSelectedCase(data);
    } catch (error) {
      toast.error('Lỗi khi tải chi tiết hồ sơ');
    }
  };

  useEffect(() => {
    if (selectedCaseId) {
      fetchCaseDetail(selectedCaseId);
    } else {
      setSelectedCase(null);
    }
  }, [selectedCaseId]);

  const handleDraftAction = async (caseId: number, type: string) => {
    const toastId = toast.loading('AI đang phân tích và dự thảo...');
    try {
      if (type === 'response') await reputation.draftResponse(caseId);
      else if (type === 'correction') await reputation.draftCorrection(caseId);
      else if (type === 'report') await reputation.draftPlatformReport(caseId);
      else if (type === 'brief') await reputation.draftExecutiveBrief(caseId);
      
      toast.success('Dự thảo đã được tạo thành công!', { id: toastId });
      fetchCaseDetail(caseId);
    } catch (error) {
      toast.error('Lỗi khi tạo dự thảo', { id: toastId });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-white mb-2 flex items-center gap-2">
            <Scale className="w-8 h-8 text-indigo-400" />
            Xử lý danh tiếng
          </h1>
          <p className="text-zinc-400">
            Quản lý và xử lý các sự cố truyền thông, bôi nhọ danh dự và khủng hoảng thương hiệu.
          </p>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-4 items-start">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-200">
          <p className="font-semibold mb-1">Tuân thủ pháp lý & Đạo đức AI</p>
          <p className="text-amber-200/80">
            Tất cả các hành động phản hồi, báo cáo hoặc yêu cầu đính chính đều phải được con người phê duyệt trước khi thực thi. 
            Nền tảng tuyệt đối không cung cấp các công cụ tấn công mạng (DDoS, report rác) hay thao túng danh tiếng bất hợp pháp.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl hover:border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl bg-white/5 shadow-inner ${stat.color}`}>
                <stat.icon className="w-5 h-5 drop-shadow-[0_0_8px_currentColor]" />
              </div>
            </div>
            <div className="text-3xl font-black text-white tracking-tight drop-shadow-md mb-1">{stat.value}</div>
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl">
        <div className="border-b border-white/5">
          <div className="flex gap-1 p-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'overview' ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Danh sách hồ sơ
            </button>
          </div>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-12 text-zinc-500">Đang tải dữ liệu...</div>
          ) : cases.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8 text-zinc-500" />
              </div>
              <p className="text-zinc-400">Chưa có hồ sơ xử lý nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="py-3 px-4 text-xs font-medium text-zinc-500 uppercase">Tiêu đề</th>
                    <th className="py-3 px-4 text-xs font-medium text-zinc-500 uppercase">Loại sự cố</th>
                    <th className="py-3 px-4 text-xs font-medium text-zinc-500 uppercase">Mức rủi ro</th>
                    <th className="py-3 px-4 text-xs font-medium text-zinc-500 uppercase">Trạng thái</th>
                    <th className="py-3 px-4 text-xs font-medium text-zinc-500 uppercase text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cases.map((c) => (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => setSelectedCaseId(c.id)}>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-zinc-200 line-clamp-1">{c.title}</div>
                        <div className="text-xs text-zinc-500 mt-1">{new Date(c.created_at).toLocaleString()}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-zinc-400">
                        {c.case_type}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          c.risk_level === 'critical' || c.risk_level === 'high' ? 'bg-red-500/10 text-red-400' :
                          c.risk_level === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-500/10 text-zinc-400'
                        }`}>
                          {c.risk_level.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          c.status === 'resolved' || c.status === 'closed' ? 'bg-emerald-500/10 text-emerald-400' :
                          'bg-indigo-500/10 text-indigo-400'
                        }`}>
                          {c.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button className="p-1.5 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Case Details Drawer/Modal */}
      {selectedCaseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setSelectedCaseId(null)}>
          <div 
            className="w-full max-w-2xl h-full bg-[#050A15]/95 border-l border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-right overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedCase ? (
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">{selectedCase.title}</h2>
                    <div className="flex gap-2">
                      <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded">{selectedCase.status}</span>
                      <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded">{selectedCase.risk_level}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCaseId(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-300 mb-2">Thông tin ban đầu</h3>
                    <div className="bg-white/5 p-4 rounded-xl text-sm text-zinc-400">
                      <p>{selectedCase.description || 'Không có mô tả chi tiết.'}</p>
                      {selectedCase.source_url && (
                        <a href={selectedCase.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 mt-4 text-indigo-400 hover:text-indigo-300">
                          <ExternalLink className="w-4 h-4" /> Nguồn phát sinh
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex justify-between items-center">
                      AI Trợ lý pháp lý & Phản hồi
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleDraftAction(selectedCase.id, 'response')}
                        className="flex flex-col items-center justify-center p-4 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl transition-colors text-indigo-300 group"
                      >
                        <Bot className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">Dự thảo phản hồi</span>
                      </button>
                      <button 
                        onClick={() => handleDraftAction(selectedCase.id, 'correction')}
                        className="flex flex-col items-center justify-center p-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-colors text-amber-300 group"
                      >
                        <FileText className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">Yêu cầu đính chính</span>
                      </button>
                      <button 
                        onClick={() => handleDraftAction(selectedCase.id, 'report')}
                        className="flex flex-col items-center justify-center p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors text-red-300 group"
                      >
                        <ShieldAlert className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">Báo cáo nền tảng</span>
                      </button>
                      <button 
                        onClick={() => handleDraftAction(selectedCase.id, 'brief')}
                        className="flex flex-col items-center justify-center p-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-colors text-emerald-300 group"
                      >
                        <FileSearch className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">Báo cáo lãnh đạo</span>
                      </button>
                    </div>
                  </div>

                  {selectedCase.actions && selectedCase.actions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-widest border-b border-white/10 pb-2">Bản nháp & Hành động</h3>
                      <div className="space-y-4">
                        {selectedCase.actions.map((action: any) => {
                          const isZalo = action.type === 'executive_brief' || action.title?.toLowerCase().includes('lãnh đạo');
                          return (
                          <div key={action.id} className={`bg-white/5 border ${isZalo ? 'border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-white/10'} rounded-2xl p-5 relative`}>
                            {isZalo && <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded-bl-lg rounded-tr-xl">Zalo UI Mockup</div>}
                            <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2">
                              <span className="text-sm font-bold text-white flex items-center gap-2">
                                {isZalo && <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-[10px]">Z</div>}
                                {action.title}
                              </span>
                              <span className="text-xs font-mono text-zinc-500 bg-black/30 px-2 py-1 rounded-md">{new Date(action.created_at).toLocaleDateString()}</span>
                            </div>
                            
                            {isZalo ? (
                              <div className="bg-[#E5E7EB] p-4 rounded-xl max-w-[85%] mt-2 relative shadow-md">
                                <div className="absolute -left-2 top-4 w-4 h-4 bg-[#E5E7EB] rotate-45" />
                                <div className="text-[13px] text-gray-900 font-sans whitespace-pre-wrap leading-relaxed relative z-10">
                                  {action.content}
                                </div>
                                <button 
                                  onClick={(e) => {
                                    navigator.clipboard.writeText(action.content);
                                    toast.success('Đã copy nội dung Zalo!');
                                  }}
                                  className="mt-3 text-xs bg-white text-blue-600 font-bold px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors flex items-center gap-1 w-fit"
                                >
                                  Copy gửi Zalo
                                </button>
                              </div>
                            ) : (
                              <div className="text-[13px] text-zinc-300 bg-black/40 p-4 rounded-xl mt-2 font-mono whitespace-pre-wrap border border-white/5 shadow-inner">
                                {action.content}
                              </div>
                            )}
                            {action.status === 'draft' && action.requires_approval && (
                              <div className="mt-4 flex gap-2">
                                <button 
                                  onClick={async () => {
                                    try {
                                      await reputation.updateAction(action.id, { status: 'pending_approval' });
                                      toast.success('Đã trình phê duyệt thành công');
                                      fetchCaseDetail(selectedCase.id);
                                    } catch (e) {
                                      toast.error('Lỗi khi trình phê duyệt');
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-medium rounded-lg hover:bg-indigo-600">
                                  Trình phê duyệt
                                </button>
                              </div>
                            )}
                            {action.status === 'pending_approval' && (
                              <div className="mt-4 flex gap-2 items-center">
                                <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 text-xs font-medium rounded-lg border border-amber-500/20">
                                  Đang chờ phê duyệt
                                </span>
                                {(userRole === 'admin' || userRole === 'super_admin') && (
                                  <>
                                    <button 
                                      onClick={async () => {
                                        try {
                                          await reputation.updateAction(action.id, { status: 'approved' });
                                          toast.success('Đã phê duyệt hành động');
                                          fetchCaseDetail(selectedCase.id);
                                        } catch (e) {
                                          toast.error('Lỗi khi phê duyệt');
                                        }
                                      }}
                                      className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600">
                                      Phê duyệt
                                    </button>
                                    <button 
                                      onClick={async () => {
                                        try {
                                          await reputation.updateAction(action.id, { status: 'rejected' });
                                          toast.success('Đã từ chối hành động');
                                          fetchCaseDetail(selectedCase.id);
                                        } catch (e) {
                                          toast.error('Lỗi khi từ chối');
                                        }
                                      }}
                                      className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600">
                                      Từ chối
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                            {action.status === 'approved' && (
                              <div className="mt-4 flex gap-2">
                                <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-medium rounded-lg border border-emerald-500/20">
                                  Đã phê duyệt
                                </span>
                              </div>
                            )}
                            {action.status === 'rejected' && (
                              <div className="mt-4 flex gap-2">
                                <span className="px-3 py-1.5 bg-red-500/20 text-red-300 text-xs font-medium rounded-lg border border-red-500/20">
                                  Đã từ chối
                                </span>
                              </div>
                            )}
                          </div>
                        ); })}
                      </div>
                    </div>
                  )}

                  {selectedCase.evidence && selectedCase.evidence.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-widest border-b border-white/10 pb-2">Bằng chứng đã lưu (Blockchain Verified)</h3>
                      <div className="space-y-3">
                        {selectedCase.evidence.map((ev: any) => (
                          <div key={ev.id} className="bg-gradient-to-r from-emerald-900/20 to-black/40 border border-emerald-500/30 p-4 rounded-2xl flex items-start gap-4 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-xl rounded-full group-hover:bg-emerald-500/20 transition-all" />
                            <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                              <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0 relative z-10">
                              <div className="flex justify-between items-start mb-2">
                                <p className="font-bold text-emerald-100 text-sm">Bằng chứng nội dung</p>
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 uppercase font-bold tracking-widest">Verified</span>
                              </div>
                              <div className="bg-black/60 p-3 rounded-lg border border-white/5 mb-3">
                                <p className="text-sm text-zinc-300 line-clamp-3 italic">"{ev.captured_text}"</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-black/40 p-2 rounded-lg border border-white/5">
                                <div>
                                  <span className="text-emerald-500/60 block mb-0.5">TIMESTAMP</span>
                                  <span className="text-emerald-400">{new Date(ev.created_at).toISOString()}</span>
                                </div>
                                <div>
                                  <span className="text-emerald-500/60 block mb-0.5">SHA-256 HASH</span>
                                  <span className="text-emerald-400 truncate block" title={ev.content_hash}>{ev.content_hash}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500">
                Đang tải chi tiết...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}