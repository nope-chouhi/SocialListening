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
  
  // Stats
  const stats = [
    { label: 'Hồ sơ đang xử lý', value: cases.filter(c => c.status !== 'closed' && c.status !== 'resolved').length, icon: ShieldAlert, color: 'text-amber-500' },
    { label: 'Rủi ro cao', value: cases.filter(c => c.risk_level === 'high' || c.risk_level === 'critical').length, icon: AlertTriangle, color: 'text-red-500' },
    { label: 'Chờ phê duyệt', value: cases.filter(c => c.status === 'waiting_approval').length, icon: FileSearch, color: 'text-blue-500' },
    { label: 'Đã giải quyết', value: cases.filter(c => c.status === 'resolved').length, icon: ShieldCheck, color: 'text-emerald-500' },
  ];

  useEffect(() => {
    fetchCases();
  }, []);

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
          <div key={idx} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5 backdrop-blur-xl hover:border-white/10 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-xl bg-white/5 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-display font-semibold text-white mb-1">{stat.value}</div>
            <div className="text-sm text-zinc-400">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-xl">
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
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedCaseId(null)}>
          <div 
            className="w-full max-w-2xl h-full bg-zinc-950 border-l border-white/10 shadow-2xl animate-in slide-in-from-right overflow-y-auto"
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
                      <h3 className="text-sm font-semibold text-zinc-300 mb-2">Bản nháp & Hành động</h3>
                      <div className="space-y-3">
                        {selectedCase.actions.map((action: any) => (
                          <div key={action.id} className="bg-white/5 border border-white/5 rounded-xl p-4">
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-semibold text-zinc-200">{action.title}</span>
                              <span className="text-xs text-zinc-500">{new Date(action.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="text-sm text-zinc-400 bg-black/20 p-3 rounded-lg mt-2 font-mono whitespace-pre-wrap">
                              {action.content}
                            </div>
                            {action.status === 'draft' && action.requires_approval && (
                              <div className="mt-4 flex gap-2">
                                <button className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-medium rounded-lg hover:bg-indigo-600">
                                  Trình phê duyệt
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedCase.evidence && selectedCase.evidence.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-300 mb-2">Bằng chứng đã lưu</h3>
                      <div className="space-y-2">
                        {selectedCase.evidence.map((ev: any) => (
                          <div key={ev.id} className="bg-white/5 p-3 rounded-lg text-sm text-zinc-400 flex items-start gap-2">
                            <FileSearch className="w-4 h-4 mt-0.5 text-zinc-500 shrink-0" />
                            <div>
                              <p className="font-medium text-zinc-300">Nội dung bị bắt giữ</p>
                              <p className="line-clamp-2 mt-1">{ev.captured_text}</p>
                              <p className="text-xs text-zinc-500 mt-2">Hash: {ev.content_hash}</p>
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