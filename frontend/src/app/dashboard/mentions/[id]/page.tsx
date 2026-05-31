'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, FileText, ExternalLink, Activity } from 'lucide-react';
import { mentions as mentionsApi, alerts as alertsApi, incidents as incidentsApi } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import ExecutiveBriefModal from '@/components/dashboard/ExecutiveBriefModal';

export default function MentionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [mention, setMention] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBriefModalOpen, setIsBriefModalOpen] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchMention(parseInt(params.id as string));
    }
  }, [params.id]);

  const fetchMention = async (id: number) => {
    try {
      setLoading(true);
      const data = await mentionsApi.get(id);
      setMention(data);
    } catch (error: any) {
      console.error('Error fetching mention:', error);
      toast.error('Lỗi khi tải chi tiết mention');
      router.push('/dashboard/mentions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async () => {
    if (!mention) return;
    
    try {
      await alertsApi.create({
        mention_id: mention.id,
        title: `Alert: ${mention.title || 'No title'}`,
        severity: mention.ai_analysis?.risk_score >= 70 ? 'high' : 'medium',
        message: `Risk score: ${mention.ai_analysis?.risk_score}`
      });
      toast.success('Tạo cảnh báo thành công!');
    } catch (error: any) {
      console.error('Error creating alert:', error);
      toast.error('Lỗi khi tạo cảnh báo');
    }
  };

  const handleCreateIncident = async () => {
    if (!mention) return;
    
    try {
      await incidentsApi.create({
        mention_id: mention.id,
        title: `Incident: ${mention.title || 'No title'}`,
        description: mention.ai_analysis?.summary_vi || ''
      });
      toast.success('Tạo sự cố thành công!');
    } catch (error: any) {
      console.error('Error creating incident:', error);
      toast.error('Lỗi khi tạo sự cố');
    }
  };

  const getSentimentColor = (sentiment: string) => {
    if (sentiment === 'positive') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (sentiment === 'neutral') return 'bg-gray-800 text-gray-400 border-gray-700';
    if (sentiment === 'negative_low') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (sentiment === 'negative_medium') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    if (sentiment === 'negative_high') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    return 'bg-gray-800 text-gray-400 border-gray-700';
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-rose-500';
    if (score >= 60) return 'text-orange-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getRiskBgColor = (score: number) => {
    if (score >= 80) return 'bg-rose-500/10 border-rose-500/20';
    if (score >= 60) return 'bg-orange-500/10 border-orange-500/20';
    if (score >= 40) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-emerald-500/10 border-emerald-500/20';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400 font-medium tracking-wide">Đang tải...</div>
      </div>
    );
  }

  if (!mention) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 font-medium tracking-wide">Không tìm thấy mention</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 text-gray-400 hover:text-white bg-[#111827] border border-gray-800 hover:bg-gray-800 rounded-xl transition-all shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Chi tiết Mention</h1>
          <p className="text-sm text-gray-400 mt-1 font-mono">ID: {mention.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Content Card */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl shadow-sm p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white mb-6 leading-snug">
              {mention.title || 'No title'}
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                {mention.content}
              </p>
            </div>
            <div className="mt-8 pt-5 border-t border-gray-800">
              <a 
                href={mention.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Xem nguồn gốc
              </a>
            </div>
          </div>

          {/* Matched Keywords */}
          {mention.matched_keywords && mention.matched_keywords.length > 0 && (
            <div className="bg-[#111827] border border-gray-800 rounded-xl shadow-sm p-6 sm:p-8">
              <h3 className="text-lg font-bold text-white mb-5 flex items-center">Từ khóa khớp</h3>
              <div className="flex flex-wrap gap-2.5">
                {mention.matched_keywords.map((kw: any, idx: number) => (
                  <span key={idx} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 text-sm rounded-lg font-semibold tracking-wide border border-indigo-500/20 uppercase">
                    {kw.keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* AI Analysis */}
          {mention.ai_analysis && (
            <div className="bg-[#111827] border border-gray-800 rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">AI Analysis</h3>
                {(mention.ai_analysis.ai_provider === 'dummy' || mention.ai_analysis.ai_provider === 'dummy_ai') && (
                  <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-orange-400 bg-orange-500/10 rounded-md border border-orange-500/20">
                    DUMMY/DEV
                  </span>
                )}
                {mention.ai_analysis.ai_provider && mention.ai_analysis.ai_provider !== 'dummy' && mention.ai_analysis.ai_provider !== 'dummy_ai' && (
                  <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-indigo-400 bg-indigo-500/10 rounded-md border border-indigo-500/20">
                    {mention.ai_analysis.ai_provider}
                  </span>
                )}
              </div>
              
              {/* Risk Score - Prominent */}
              <div className={`p-5 rounded-xl border mb-6 flex flex-col items-center justify-center ${getRiskBgColor(mention.ai_analysis.risk_score)}`}>
                <div className={`text-4xl font-black ${getRiskColor(mention.ai_analysis.risk_score)}`}>
                  {mention.ai_analysis.risk_score}
                </div>
                <div className="text-xs font-bold tracking-wider uppercase text-gray-500 mt-2">Risk Score</div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <span className="text-sm font-medium text-gray-400 uppercase tracking-wider text-[11px]">Sentiment</span>
                  <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border ${getSentimentColor(mention.ai_analysis.sentiment)}`}>
                    {mention.ai_analysis.sentiment}
                  </span>
                </div>
                
                <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <span className="text-sm font-medium text-gray-400 uppercase tracking-wider text-[11px]">Crisis Level</span>
                  <div className="flex items-center space-x-1.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`w-2.5 h-2.5 rounded-full ${
                          level <= mention.ai_analysis.crisis_level
                            ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                            : 'bg-gray-800'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-[11px] font-bold tracking-wider text-white">
                      {mention.ai_analysis.crisis_level}/5
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <span className="text-sm font-medium text-gray-400 uppercase tracking-wider text-[11px]">Suggested Action</span>
                  <span className="text-sm font-semibold text-white capitalize">
                    {mention.ai_analysis.suggested_action?.replace('_', ' ')}
                  </span>
                </div>

                {mention.ai_analysis.responsible_department && (
                  <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wider text-[11px]">Department</span>
                    <span className="text-sm font-semibold text-white capitalize">
                      {mention.ai_analysis.responsible_department?.replace('_', ' ')}
                    </span>
                  </div>
                )}

                {mention.ai_analysis.confidence_score && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wider text-[11px]">Confidence</span>
                    <span className="text-sm font-bold text-white">
                      {mention.ai_analysis.confidence_score}%
                    </span>
                  </div>
                )}
              </div>

              {mention.ai_analysis.summary_vi && (
                <div className="mt-6 pt-5 border-t border-gray-800">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Tóm tắt AI:</h4>
                  <p className="text-sm text-gray-300 bg-[#0B1220] border border-gray-800 p-4 rounded-xl leading-relaxed">
                    {mention.ai_analysis.summary_vi}
                  </p>
                </div>
              )}

              {/* Risk-to-Action Engine Block */}
              {mention.ai_analysis.urgency && (
                <div className="mt-6 pt-5 border-t border-gray-800">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
                    <Activity className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    Risk-to-Action Engine
                  </h4>
                  <div className="bg-[#0B1220] border border-gray-800 p-4 rounded-xl space-y-4">
                    {mention.ai_analysis.why_it_matters && (
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Mức độ ảnh hưởng</span>
                        <p className="text-sm text-gray-300">{mention.ai_analysis.why_it_matters}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Độ khẩn cấp</span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${
                          mention.ai_analysis.urgency === 'critical' ? 'bg-rose-500/10 text-rose-400' :
                          mention.ai_analysis.urgency === 'high' ? 'bg-orange-500/10 text-orange-400' :
                          mention.ai_analysis.urgency === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {mention.ai_analysis.urgency.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Đề xuất xử lý</span>
                        <span className="text-sm font-medium text-white">{mention.ai_analysis.response_type?.replace(/_/g, ' ')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Người phụ trách (Gợi ý)</span>
                        <span className="text-sm font-medium text-white">{mention.ai_analysis.recommended_owner}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Thời hạn</span>
                        <span className="text-sm font-medium text-white">{mention.ai_analysis.deadline_suggestion}</span>
                      </div>
                    </div>
                    {mention.ai_analysis.escalation_needed && (
                      <div className="pt-2">
                        <span className="inline-flex items-center px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          CẦN LEO THANG (ESCALATION REQUIRED)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-white mb-5">Hành động</h3>
            <div className="space-y-4">
              <button
                onClick={handleCreateAlert}
                className="w-full flex items-center justify-center px-4 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-semibold shadow-sm shadow-amber-500/20"
              >
                <AlertTriangle className="w-5 h-5 mr-2" />
                Tạo Cảnh Báo
              </button>
              <button
                onClick={() => setIsBriefModalOpen(true)}
                className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-900/20 transition-all focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <FileText className="w-4 h-4 mr-2" />
                Tạo Executive Brief
              </button>
              <button
                onClick={handleCreateIncident}
                className="w-full flex items-center justify-center px-4 py-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors font-semibold shadow-sm shadow-rose-500/20"
              >
                <FileText className="w-5 h-5 mr-2" />
                Tạo Sự Cố
              </button>
            </div>
          </div>

          {/* Meta Information */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-white mb-5">Thông tin</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-medium">Thu thập:</span>
                <span className="text-white font-medium">
                  {new Date(mention.collected_at).toLocaleString('vi-VN')}
                </span>
              </div>
              {mention.published_at && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">Xuất bản:</span>
                  <span className="text-white font-medium">
                    {new Date(mention.published_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              )}
              {mention.author && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">Tác giả:</span>
                  <span className="text-white font-medium">{mention.author}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-medium">Source ID:</span>
                <span className="text-white font-mono">{mention.source_id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ExecutiveBriefModal
        isOpen={isBriefModalOpen}
        onClose={() => setIsBriefModalOpen(false)}
        mentionIds={mention ? [mention.id] : undefined}
      />
    </div>
  );
}