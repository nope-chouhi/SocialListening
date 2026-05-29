'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Search, Globe, Facebook, Youtube, Clock } from 'lucide-react';
import { sources as sourcesApi, getErrorMessage, getUserFacingErrorMessage } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import ScheduleSelector from '@/components/ScheduleSelector';

interface Source {
  id: number;
  name: string;
  url: string;
  source_type: string;
  is_active: boolean;
  crawl_frequency: string;
  crawl_time: string | null;
  crawl_day_of_week: number | null;
  crawl_day_of_month: number | null;
  crawl_month: number | null;
  next_crawl_at: string | null;
  last_crawled_at: string | null;
  created_at: string;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; sourceId: number | null; sourceName: string }>({
    isOpen: false,
    sourceId: null,
    sourceName: ''
  });
  const [showTestSources, setShowTestSources] = useState(false);
  const [newSource, setNewSource] = useState({
    name: '',
    url: '',
    source_type: 'website',
    crawl_frequency: 'manual' as 'manual' | 'daily' | 'weekly' | 'monthly' | 'yearly',
    schedule: {
      hours: [] as number[],
      daysOfWeek: [] as number[],
      daysOfMonth: [] as number[],
      months: [] as number[],
      time: '09:00'
    }
  });

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      setLoading(true);
      const data = await sourcesApi.list();
      setSources(data);
    } catch (error: any) {
      console.error('Error fetching sources:', error);
      // Don't toast for 401 — global interceptor handles redirect
      if (error?.response?.status !== 401) {
        toast.error(getUserFacingErrorMessage(
          error,
          'Lỗi khi tải danh sách nguồn. Vui lòng kiểm tra backend hoặc database migration.'
        ));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddSource = async () => {
    if (!newSource.name.trim() || !newSource.url.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    try {
      const payload: any = {
        name: newSource.name,
        url: newSource.url,
        source_type: newSource.source_type,
        is_active: true,
        crawl_frequency: newSource.crawl_frequency
      };

      // Add schedule fields based on frequency
      if (newSource.crawl_frequency === 'daily') {
        payload.schedule_hours = newSource.schedule.hours;
        if (newSource.schedule.hours.length === 0) {
          toast.error('Vui lòng chọn ít nhất 1 giờ quét');
          return;
        }
      } else if (newSource.crawl_frequency === 'weekly') {
        payload.schedule_days_of_week = newSource.schedule.daysOfWeek;
        payload.crawl_time = newSource.schedule.time;
        if (newSource.schedule.daysOfWeek.length === 0) {
          toast.error('Vui lòng chọn ít nhất 1 ngày trong tuần');
          return;
        }
      } else if (newSource.crawl_frequency === 'monthly') {
        payload.schedule_days_of_month = newSource.schedule.daysOfMonth;
        payload.crawl_time = newSource.schedule.time;
        if (newSource.schedule.daysOfMonth.length === 0) {
          toast.error('Vui lòng chọn ít nhất 1 ngày trong tháng');
          return;
        }
      } else if (newSource.crawl_frequency === 'yearly') {
        payload.schedule_months = newSource.schedule.months;
        payload.schedule_days_of_month = newSource.schedule.daysOfMonth;
        payload.crawl_time = newSource.schedule.time;
        if (newSource.schedule.months.length === 0 || newSource.schedule.daysOfMonth.length === 0) {
          toast.error('Vui lòng chọn ít nhất 1 tháng và 1 ngày');
          return;
        }
      }

      await sourcesApi.create(payload);
      
      setShowAddModal(false);
      setNewSource({ 
        name: '', 
        url: '', 
        source_type: 'website',
        crawl_frequency: 'manual',
        schedule: {
          hours: [],
          daysOfWeek: [],
          daysOfMonth: [],
          months: [],
          time: '09:00'
        }
      });
      toast.success('Thêm nguồn thành công!');
      fetchSources();
    } catch (error: any) {
      console.error('Error adding source:', error);
      toast.error(`Lỗi khi thêm nguồn: ${getErrorMessage(error)}`);
    }
  };

  const handleDeleteSource = async () => {
    if (!deleteConfirm.sourceId) return;

    try {
      await sourcesApi.delete(deleteConfirm.sourceId);
      toast.success('Xóa nguồn thành công!');
      fetchSources();
    } catch (error: any) {
      console.error('Error deleting source:', error);
      toast.error(`Lỗi khi xóa nguồn: ${getErrorMessage(error)}`);
    }
  };

  const handleToggleActive = async (source: Source) => {
    try {
      await sourcesApi.update(source.id, {
        is_active: !source.is_active
      });
      fetchSources();
      toast.success(`Đã ${!source.is_active ? 'bật' : 'tắt'} nguồn`);
    } catch (error: any) {
      console.error('Error toggling source:', error);
      toast.error(`Lỗi khi cập nhật nguồn: ${getErrorMessage(error)}`);
    }
  };

  const filteredSources = sources.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.url.toLowerCase().includes(searchTerm.toLowerCase());
    const isTest = s.url.includes('example.com') || /daily source|weekly source|monthly source|yearly source/i.test(s.name);
    
    if (!showTestSources && isTest) return false;
    return matchesSearch;
  });

  const getSourceIcon = (type: string) => {
    if (type.includes('facebook')) return <Facebook className="w-5 h-5 text-blue-600" />;
    if (type.includes('youtube')) return <Youtube className="w-5 h-5 text-red-600" />;
    return <Globe className="w-5 h-5 text-gray-600" />;
  };

  const getSourceTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      'facebook_page': 'Facebook Page',
      'facebook_group': 'Facebook Group',
      'facebook_profile': 'Facebook Profile',
      'youtube_channel': 'YouTube Channel',
      'youtube_video': 'YouTube Video',
      'website': 'Website',
      'news': 'News',
      'rss': 'RSS Feed',
      'forum': 'Forum',
      'manual_url': 'Manual URL'
    };
    return typeMap[type] || type;
  };

  const getFrequencyText = (frequency: string) => {
    switch (frequency) {
      case 'daily': return 'Hằng ngày';
      case 'weekly': return 'Hằng tuần';
      case 'monthly': return 'Hằng tháng';
      case 'yearly': return 'Hằng năm';
      default: return 'Thủ công';
    }
  };

  const getScheduleDescription = (source: Source) => {
    if (source.crawl_frequency === 'manual') return 'Quét thủ công';
    
    const time = source.crawl_time || '09:00';
    
    if (source.crawl_frequency === 'daily') {
      return `Hằng ngày lúc ${time}`;
    } else if (source.crawl_frequency === 'weekly') {
      const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
      const dayName = days[source.crawl_day_of_week || 0];
      return `Hằng tuần vào ${dayName} lúc ${time}`;
    } else if (source.crawl_frequency === 'monthly') {
      return `Hằng tháng ngày ${source.crawl_day_of_month || 1} lúc ${time}`;
    } else if (source.crawl_frequency === 'yearly') {
      const months = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
                     'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
      const monthName = months[source.crawl_month || 1];
      return `Hằng năm ${monthName} ngày ${source.crawl_day_of_month || 1} lúc ${time}`;
    }
    
    return 'Không xác định';
  };

  if (loading) {
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
          <h1 className="text-2xl font-bold text-white tracking-wide">Quản lý nguồn</h1>
          <p className="text-sm text-gray-400 mt-1">
            Quản lý các nguồn dữ liệu để thu thập thông tin
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 shadow-sm shadow-indigo-500/20 font-medium"
        >
          <Plus className="w-5 h-5 mr-2" />
          Thêm nguồn
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm kiếm nguồn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-[#111827] border border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500 shadow-sm transition-shadow"
          />
        </div>
        <div className="flex items-center gap-3 bg-[#111827] px-4 py-3 border border-gray-800 rounded-xl w-full sm:w-auto">
          <input
            type="checkbox"
            id="showTestSources"
            checked={showTestSources}
            onChange={(e) => setShowTestSources(e.target.checked)}
            className="w-4 h-4 text-indigo-600 bg-gray-800 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-gray-900"
          />
          <label htmlFor="showTestSources" className="text-sm font-medium text-gray-300 cursor-pointer select-none">
            Hiện nguồn test
          </label>
        </div>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredSources.length === 0 ? (
          <div className="col-span-full bg-[#111827] border border-gray-800 rounded-xl shadow-sm p-10 text-center text-gray-400 font-medium tracking-wide">
            <div className="w-16 h-16 rounded-xl bg-[#1E293B] flex items-center justify-center mx-auto mb-4 border border-gray-800 shadow-sm">
              <Globe className="w-8 h-8 text-gray-500" />
            </div>
            {searchTerm ? 'Không tìm thấy nguồn phù hợp.' : 'Không có nguồn nào. Hãy thêm nguồn đầu tiên!'}
          </div>
        ) : (
          filteredSources.map((source) => {
            const isTest = source.url.includes('example.com') || /daily source|weekly source|monthly source|yearly source/i.test(source.name);
            const isSupported = ['rss', 'website'].includes((source.source_type || '').toLowerCase());
            const isUnsupported = !isSupported && source.source_type;

            return (
              <div key={source.id} className="bg-[#111827] rounded-xl shadow-sm border border-gray-800 p-6 transition-all duration-300 hover:border-indigo-500/30 hover:shadow-indigo-500/5 group flex flex-col h-full">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-[#1E293B] rounded-lg border border-gray-700 group-hover:scale-110 transition-transform duration-300">
                      {getSourceIcon(source.source_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-white tracking-wide truncate max-w-[150px]" title={source.name}>{source.name}</h3>
                        {isTest && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            Test
                          </span>
                        )}
                        {isUnsupported && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Chưa hỗ trợ
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium tracking-wider uppercase text-gray-500">{getSourceTypeText(source.source_type)}</p>
                    </div>
                  </div>
                <button
                  onClick={() => handleToggleActive(source)}
                  className={`px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-md transition-colors border ${
                    source.is_active
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                      : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700'
                  }`}
                >
                  {source.is_active ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="space-y-3 mb-6 flex-1">
                <p className="text-sm text-gray-400 truncate bg-[#0B1220] p-2.5 rounded-lg border border-gray-800" title={source.url}>
                  <span className="font-medium text-gray-500 mr-2 block text-xs uppercase tracking-wider mb-1">URL</span> {source.url}
                </p>
                
                {/* Schedule Info */}
                <div className="flex items-center space-x-3 text-sm text-gray-400 px-1">
                  <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <div className="flex-1 truncate" title={getScheduleDescription(source)}>
                    {getScheduleDescription(source)}
                  </div>
                </div>
                
                {source.next_crawl_at && (
                  <p className="text-xs text-gray-500 px-1 truncate">
                    <span className="font-medium mr-1 text-gray-400">Tiếp theo:</span>
                    {new Date(source.next_crawl_at).toLocaleString('vi-VN')}
                  </p>
                )}
                
                <p className="text-xs text-gray-500 px-1 truncate">
                  <span className="font-medium mr-1 text-gray-400">Gần nhất:</span>
                  {source.last_crawled_at 
                    ? new Date(source.last_crawled_at).toLocaleString('vi-VN')
                    : 'Chưa crawl'
                  }
                </p>
                {(source as any).last_error && (
                  <div className="text-xs text-rose-400 mt-3 p-2.5 bg-rose-500/5 border border-rose-500/20 rounded-lg" title={(source as any).last_error}>
                    <span className="font-semibold text-rose-500 block mb-1 uppercase tracking-wider text-[10px]">Lỗi gần nhất</span>
                    <span className="opacity-90">{(source as any).last_error.substring(0, 100)}{(source as any).last_error.length > 100 ? '...' : ''}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-800/50 mt-auto">
                <button
                  onClick={() => setDeleteConfirm({ isOpen: true, sourceId: source.id, sourceName: source.name })}
                  className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                  title="Xóa nguồn"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, sourceId: null, sourceName: '' })}
        onConfirm={handleDeleteSource}
        title="Xóa nguồn"
        message={`Bạn có chắc muốn xóa nguồn "${deleteConfirm.sourceName}"?`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
      />

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-6 border-b border-gray-800 bg-[#0B1220]/50 sticky top-0 z-10">
              <h2 className="text-xl font-bold text-white">Thêm nguồn mới</h2>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tên nguồn *
                </label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
                  placeholder="Ví dụ: VnExpress"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL *
                </label>
                <input
                  type="url"
                  value={newSource.url}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Loại nguồn
                </label>
                <select
                  value={newSource.source_type}
                  onChange={(e) => setNewSource({ ...newSource, source_type: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                >
                  <option value="website">Website</option>
                  <option value="facebook_page">Facebook Page</option>
                  <option value="facebook_group">Facebook Group</option>
                  <option value="facebook_profile">Facebook Profile</option>
                  <option value="youtube_channel">YouTube Channel</option>
                  <option value="youtube_video">YouTube Video</option>
                  <option value="news">News</option>
                  <option value="rss">RSS Feed</option>
                  <option value="forum">Forum</option>
                  <option value="manual_url">Manual URL</option>
                </select>
              </div>

              {/* Dynamic form based on source type */}
              {/* Website, News, Forum, Manual URL - just need URL */}
              {['website', 'news', 'forum', 'manual_url'].includes(newSource.source_type) && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                  <p className="text-sm text-indigo-300">
                    <strong className="text-indigo-400">Website/News/Forum:</strong> Chỉ cần nhập URL ở trên. Hệ thống sẽ tự động crawl nội dung.
                  </p>
                </div>
              )}

              {/* Facebook - need login credentials */}
              {newSource.source_type.startsWith('facebook_') && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-4">
                  <p className="text-sm text-amber-300 font-medium">
                    <strong className="text-amber-400">Facebook:</strong> Cần thông tin đăng nhập để truy cập nội dung
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Email/Username Facebook
                    </label>
                    <input
                      type="text"
                      placeholder="email@example.com"
                      className="w-full px-3 py-2 bg-[#1E293B] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-[#1E293B] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white placeholder-gray-500"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    ⚠️ Thông tin đăng nhập được mã hóa và chỉ dùng để crawl dữ liệu
                  </p>
                </div>
              )}

              {/* YouTube - need API key or login */}
              {newSource.source_type.startsWith('youtube_') && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 space-y-4">
                  <p className="text-sm text-rose-300 font-medium">
                    <strong className="text-rose-400">YouTube:</strong> Chọn phương thức truy cập
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Phương thức
                    </label>
                    <select className="w-full px-3 py-2 bg-[#1E293B] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-white">
                      <option value="public">Public (không cần đăng nhập)</option>
                      <option value="api_key">YouTube API Key</option>
                      <option value="login">Đăng nhập Google</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      YouTube API Key (tùy chọn)
                    </label>
                    <input
                      type="text"
                      placeholder="AIzaSy..."
                      className="w-full px-3 py-2 bg-[#1E293B] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-white placeholder-gray-500"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    💡 API Key giúp tăng giới hạn request. Lấy tại: console.cloud.google.com
                  </p>
                </div>
              )}

              {/* RSS - need feed settings */}
              {newSource.source_type === 'rss' && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 space-y-4">
                  <p className="text-sm text-orange-300 font-medium">
                    <strong className="text-orange-400">RSS Feed:</strong> Cấu hình RSS
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      RSS Feed URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/feed.xml"
                      className="w-full px-3 py-2 bg-[#1E293B] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Số lượng items tối đa mỗi lần crawl
                    </label>
                    <input
                      type="number"
                      defaultValue={50}
                      min={1}
                      max={500}
                      className="w-full px-3 py-2 bg-[#1E293B] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="rss-full-content"
                      className="w-4 h-4 text-orange-600 bg-gray-800 border-gray-600 rounded focus:ring-orange-500 focus:ring-offset-gray-900"
                    />
                    <label htmlFor="rss-full-content" className="ml-3 text-sm text-gray-300 cursor-pointer">
                      Lấy full content (nếu RSS chỉ có summary)
                    </label>
                  </div>
                </div>
              )}

              {/* Crawl Schedule */}
              <div className="border-t border-gray-800 pt-5 mt-2">
                <h3 className="text-base font-semibold text-white mb-4">Lịch Quét</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tần suất quét
                  </label>
                  <select
                    value={newSource.crawl_frequency}
                    onChange={(e) => setNewSource({ 
                      ...newSource, 
                      crawl_frequency: e.target.value as 'manual' | 'daily' | 'weekly' | 'monthly' | 'yearly'
                    })}
                    className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                  >
                    <option value="manual">Thủ công (Không tự động quét)</option>
                    <option value="daily">Hằng ngày</option>
                    <option value="weekly">Hằng tuần</option>
                    <option value="monthly">Hằng tháng</option>
                    <option value="yearly">Hằng năm</option>
                  </select>
                </div>

                {/* Schedule Selector Component wrapper in dark mode via CSS global .dark but let's assume it works. The component might need inline fix if it relies on text-gray-700 */}
                <div className="mt-4 schedule-dark-wrapper">
                  <ScheduleSelector
                    frequency={newSource.crawl_frequency}
                    value={newSource.schedule}
                    onChange={(schedule) => setNewSource({ ...newSource, schedule })}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 bg-[#0B1220]/50 rounded-b-2xl flex justify-end space-x-3 sticky bottom-0">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-300 bg-[#1E293B] border border-gray-700 rounded-xl hover:bg-gray-800 hover:text-white transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleAddSource}
                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-500/20 transition-all"
              >
                Thêm Nguồn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
