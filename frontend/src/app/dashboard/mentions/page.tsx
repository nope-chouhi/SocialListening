'use client';

import { useEffect, useState } from 'react';
import { Search, Eye, Trash2, AlertTriangle, FileText, X } from 'lucide-react';
import { mentions as mentionsApi, alerts as alertsApi, incidents as incidentsApi } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function MentionsPage() {
  const [mentions, setMentions] = useState<any[]>([]);
  const [totalMentions, setTotalMentions] = useState<number>(-1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; mentionId: number | null; mentionTitle: string }>({
    isOpen: false,
    mentionId: null,
    mentionTitle: ''
  });

  useEffect(() => {
    fetchMentions();
  }, [page, searchTerm]);

  const fetchMentions = async () => {
    try {
      setLoading(true);
      const data = await mentionsApi.list({
        page,
        page_size: 20,
        search_query: searchTerm || undefined
      });
      setMentions(data.items);
      setTotalMentions(data.total);
      setTotalPages(data.total_pages);
    } catch (error: any) {
      console.error('Error fetching mentions:', error);
      toast.error(error.response?.data?.detail || 'Lỗi khi tải mentions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.mentionId) return;
    
    try {
      await mentionsApi.delete(deleteConfirm.mentionId);
      toast.success('Xóa mention thành công!');
      fetchMentions();
    } catch (error: any) {
      console.error('Error deleting mention:', error);
      toast.error('Lỗi khi xóa mention');
    }
  };

  const getSentimentColor = (sentiment: string) => {
    if (sentiment === 'positive') return 'bg-green-100 text-green-800';
    if (sentiment === 'neutral') return 'bg-gray-100 text-gray-800';
    if (sentiment === 'negative_low') return 'bg-yellow-100 text-yellow-800';
    if (sentiment === 'negative_medium') return 'bg-orange-100 text-orange-800';
    if (sentiment === 'negative_high') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading && mentions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400 font-medium tracking-wide">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Mentions</h1>
          <p className="text-sm text-gray-400 mt-1">
            Danh sách các mentions đã thu thập
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
        <input
          type="text"
          placeholder="Tìm kiếm mentions..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="w-full pl-11 pr-4 py-3 bg-[#111827] border border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500 shadow-sm transition-shadow"
        />
      </div>

      {/* Mentions List */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl shadow-sm overflow-hidden">
        {totalMentions === 0 && !loading ? (
          <div className="p-10 text-center text-gray-400 font-medium tracking-wide">
            <div className="w-16 h-16 rounded-xl bg-[#1E293B] flex items-center justify-center mx-auto mb-4 border border-gray-800 shadow-sm">
              <FileText className="w-8 h-8 text-gray-500" />
            </div>
            Chưa có mention nào. Hãy thực hiện scan để thu thập dữ liệu!
          </div>
        ) : mentions.length === 0 && !loading ? (
          <div className="p-10 text-center text-gray-400 font-medium tracking-wide">
            <div className="w-16 h-16 rounded-xl bg-[#1E293B] flex items-center justify-center mx-auto mb-4 border border-gray-800 shadow-sm">
              <Search className="w-8 h-8 text-gray-500" />
            </div>
            Không tìm thấy mentions nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {mentions.map((mention) => (
              <div key={mention.id} className="p-6 hover:bg-[#1E293B]/50 transition-colors duration-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="font-semibold text-white truncate" title={mention.title}>{mention.title || 'No title'}</h3>
                    <p className="text-sm text-gray-400 mt-2 line-clamp-2 leading-relaxed">{mention.content}</p>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-4">
                      {mention.ai_analysis ? (
                        <>
                          <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md border ${
                            mention.ai_analysis.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            mention.ai_analysis.sentiment === 'negative_low' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            mention.ai_analysis.sentiment === 'negative_medium' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                            mention.ai_analysis.sentiment === 'negative_high' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                            'bg-gray-800 text-gray-400 border-gray-700'
                          }`}>
                            {mention.ai_analysis.sentiment}
                          </span>
                          <span className={`text-[11px] font-semibold tracking-wider uppercase ${
                            mention.ai_analysis.risk_score >= 80 ? 'text-rose-500' :
                            mention.ai_analysis.risk_score >= 60 ? 'text-orange-500' :
                            mention.ai_analysis.risk_score >= 40 ? 'text-amber-500' :
                            'text-emerald-500'
                          }`}>
                            Risk: {mention.ai_analysis.risk_score}
                          </span>
                          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                            Crisis: {mention.ai_analysis.crisis_level}/5
                          </span>
                          {mention.ai_analysis.ai_provider === 'dummy' && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase text-orange-400 bg-orange-500/10 rounded border border-orange-500/20">
                              AI: DUMMY
                            </span>
                          )}
                          {mention.ai_analysis.ai_provider && mention.ai_analysis.ai_provider !== 'dummy' && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase text-indigo-400 bg-indigo-500/10 rounded border border-indigo-500/20">
                              AI: {mention.ai_analysis.ai_provider}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-gray-500 bg-gray-800 rounded border border-gray-700">
                          PENDING
                        </span>
                      )}
                      
                      {mention.matched_keywords && mention.matched_keywords.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">Từ khóa:</span>
                          <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold tracking-wider uppercase rounded border border-indigo-500/20 truncate max-w-[150px]">
                            {mention.matched_keywords.map((k: any) => typeof k === 'string' ? k : k.keyword).join(', ')}
                          </span>
                        </div>
                      )}
                      
                      {mention.url && (
                        <a href={mention.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline transition-colors flex items-center">
                          Link Gốc
                        </a>
                      )}
                      
                      <span className="text-[11px] text-gray-500 font-medium">
                        {new Date(mention.collected_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                    <Link
                      href={`/dashboard/mentions/${mention.id}`}
                      className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20"
                      title="Xem chi tiết"
                    >
                      <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Link>
                    <button
                      onClick={() => setDeleteConfirm({ isOpen: true, mentionId: mention.id, mentionTitle: mention.title || 'No title' })}
                      className="p-2 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, mentionId: null, mentionTitle: '' })}
        onConfirm={handleDelete}
        title="Xóa mention"
        message={`Bạn có chắc muốn xóa mention "${deleteConfirm.mentionTitle}"?`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-700 bg-[#1E293B] text-gray-300 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            Trước
          </button>
          <span className="px-4 py-2 text-sm font-medium text-gray-400 bg-[#111827] border border-gray-800 rounded-lg">
            Trang <span className="text-white mx-1">{page}</span> / <span className="text-white mx-1">{totalPages}</span>
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-700 bg-[#1E293B] text-gray-300 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}
