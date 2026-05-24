'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import { mentions as mentionsApi, alerts as alertsApi, incidents as incidentsApi } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';

export default function MentionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [mention, setMention] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    if (sentiment === 'positive') return 'bg-green-100 text-green-800 border-green-200';
    if (sentiment === 'neutral') return 'bg-gray-100 text-gray-800 border-gray-200';
    if (sentiment === 'negative_low') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (sentiment === 'negative_medium') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (sentiment === 'negative_high') return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getRiskBgColor = (score: number) => {
    if (score >= 80) return 'bg-red-50 border-red-200';
    if (score >= 60) return 'bg-orange-50 border-orange-200';
    if (score >= 40) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Đang tải...</div>
      </div>
    );
  }

  if (!mention) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Không tìm thấy mention</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chi tiết Mention</h1>
          <p className="text-sm text-gray-500 mt-1">ID: {mention.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Content Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {mention.title || 'No title'}
            </h2>
            <div className="prose max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {mention.content}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t">
              <a 
                href={mention.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Xem nguồn gốc
              </a>
            </div>
          </div>

          {/* Matched Keywords */}
          {mention.matched_keywords && mention.matched_keywords.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Từ khóa khớp</h3>
              <div className="flex flex-wrap gap-2">
                {mention.matched_keywords.map((kw: any, idx: number) => (
                  <span key={idx} className="px-3 py-2 bg-blue-100 text-blue-800 text-sm rounded-lg font-medium border border-blue-200">
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
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">AI Analysis</h3>
                {mention.ai_analysis.ai_provider === 'dummy' && (
                  <span className="px-2 py-1 text-xs font-semibold tracking-wider text-orange-700 bg-orange-100 rounded-full border border-orange-200">
                    DUMMY/DEV
                  </span>
                )}
                {mention.ai_analysis.ai_provider && mention.ai_analysis.ai_provider !== 'dummy' && (
                  <span className="px-2 py-1 text-xs font-semibold tracking-wider text-indigo-700 bg-indigo-100 rounded-full border border-indigo-200">
                    {mention.ai_analysis.ai_provider.toUpperCase()}
                  </span>
                )}
              </div>
              
              {/* Risk Score - Prominent */}
              <div className={`p-4 rounded-lg border-2 mb-4 ${getRiskBgColor(mention.ai_analysis.risk_score)}`}>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getRiskColor(mention.ai_analysis.risk_score)}`}>
                    {mention.ai_analysis.risk_score}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Risk Score</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Sentiment:</span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getSentimentColor(mention.ai_analysis.sentiment)}`}>
                    {mention.ai_analysis.sentiment}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Crisis Level:</span>
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`w-3 h-3 rounded-full ${
                          level <= mention.ai_analysis.crisis_level
                            ? 'bg-red-500'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-sm font-bold text-gray-900">
                      {mention.ai_analysis.crisis_level}/5
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Suggested Action:</span>
                  <span className="text-sm font-semibold text-gray-900 capitalize">
                    {mention.ai_analysis.suggested_action?.replace('_', ' ')}
                  </span>
                </div>

                {mention.ai_analysis.responsible_department && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Department:</span>
                    <span className="text-sm font-semibold text-gray-900 capitalize">
                      {mention.ai_analysis.responsible_department?.replace('_', ' ')}
                    </span>
                  </div>
                )}

                {mention.ai_analysis.confidence_score && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Confidence:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {mention.ai_analysis.confidence_score}%
                    </span>
                  </div>
                )}
              </div>

              {mention.ai_analysis.summary_vi && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Tóm tắt AI:</h4>
                  <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg leading-relaxed">
                    {mention.ai_analysis.summary_vi}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Hành động</h3>
            <div className="space-y-3">
              <button
                onClick={handleCreateAlert}
                className="w-full flex items-center justify-center px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
              >
                <AlertTriangle className="w-5 h-5 mr-2" />
                Tạo Cảnh Báo
              </button>
              <button
                onClick={handleCreateIncident}
                className="w-full flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                <FileText className="w-5 h-5 mr-2" />
                Tạo Sự Cố
              </button>
            </div>
          </div>

          {/* Meta Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Thông tin</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Thu thập:</span>
                <span className="text-gray-900 font-medium">
                  {new Date(mention.collected_at).toLocaleString('vi-VN')}
                </span>
              </div>
              {mention.published_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Xuất bản:</span>
                  <span className="text-gray-900 font-medium">
                    {new Date(mention.published_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              )}
              {mention.author && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Tác giả:</span>
                  <span className="text-gray-900 font-medium">{mention.author}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Source ID:</span>
                <span className="text-gray-900 font-medium">{mention.source_id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}