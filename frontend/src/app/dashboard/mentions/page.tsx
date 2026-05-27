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
        <div className="text-lg text-gray-600">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mentions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Danh sách các mentions đã thu thập
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Tìm kiếm mentions..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Mentions List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {totalMentions === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            Chưa có mention nào. Hãy thực hiện scan để thu thập dữ liệu!
          </div>
        ) : mentions.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            Không tìm thấy mentions nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="divide-y">
            {mentions.map((mention) => (
              <div key={mention.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{mention.title || 'No title'}</h3>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{mention.content}</p>
                    
                    <div className="flex items-center space-x-4 mt-3">
                      {mention.ai_analysis && (
                        <>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSentimentColor(mention.ai_analysis.sentiment)}`}>
                            {mention.ai_analysis.sentiment}
                          </span>
                          <span className={`text-sm font-medium ${getRiskColor(mention.ai_analysis.risk_score)}`}>
                            Risk: {mention.ai_analysis.risk_score}
                          </span>
                          <span className="text-xs text-gray-500">
                            Crisis: {mention.ai_analysis.crisis_level}/5
                          </span>
                          {mention.ai_analysis.ai_provider === 'dummy' && (
                            <span className="px-2 py-1 text-[10px] font-semibold tracking-wider text-orange-700 bg-orange-100 rounded-full border border-orange-200">
                              AI: DUMMY/DEV
                            </span>
                          )}
                          {mention.ai_analysis.ai_provider && mention.ai_analysis.ai_provider !== 'dummy' && (
                            <span className="px-2 py-1 text-[10px] font-semibold tracking-wider text-indigo-700 bg-indigo-100 rounded-full border border-indigo-200">
                              AI: {mention.ai_analysis.ai_provider.toUpperCase()}
                            </span>
                          )}
                        </>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(mention.collected_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <Link
                      href={`/dashboard/mentions/${mention.id}`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Xem chi tiết"
                    >
                      <Eye className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={() => setDeleteConfirm({ isOpen: true, mentionId: mention.id, mentionTitle: mention.title || 'No title' })}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa"
                    >
                      <Trash2 className="w-5 h-5" />
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
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Trước
          </button>
          <span className="px-4 py-2">
            Trang {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}
