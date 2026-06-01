'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Trash2, Search, Globe, Facebook, Youtube, Clock,
  Radar, CheckCircle, XCircle, Ban, Rss, ExternalLink, RefreshCw,
  Loader2, Plug, Wifi, WifiOff, Sparkles,
} from 'lucide-react';
import { sources as sourcesApi, discoveredSources as dsApi, discovery as discoveryApi, getErrorMessage, getUserFacingErrorMessage } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import ScheduleSelector from '@/components/ScheduleSelector';

type SourceTab = 'active' | 'discovered' | 'connectors';

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
  const [activeTab, setActiveTab] = useState<SourceTab>('active');
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
    rss_url: '',
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

  // Discovered sources state
  const [discoveredSources, setDiscoveredSources] = useState<any[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  const [dsFilter, setDsFilter] = useState('candidate');
  const [dsActionLoading, setDsActionLoading] = useState<number | null>(null);

  // Connector state
  const [connectors, setConnectors] = useState<any[]>([]);
  const [connectorsLoading, setConnectorsLoading] = useState(false);

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    if (activeTab === 'discovered') fetchDiscoveredSources();
    if (activeTab === 'connectors') fetchConnectors();
  }, [activeTab, dsFilter]);

  const fetchDiscoveredSources = async () => {
    try {
      setDsLoading(true);
      const data = await dsApi.list({ status: dsFilter || undefined, page_size: 100 });
      setDiscoveredSources(data.items || []);
    } catch (error: any) {
      if (error?.response?.status !== 401) console.error('Error fetching discovered sources:', error);
    } finally {
      setDsLoading(false);
    }
  };

  const fetchConnectors = async () => {
    try {
      setConnectorsLoading(true);
      const data = await discoveryApi.connectorStatus();
      setConnectors(data.connectors || []);
    } catch (error: any) {
      if (error?.response?.status !== 401) console.error('Error fetching connectors:', error);
    } finally {
      setConnectorsLoading(false);
    }
  };

  const handleDsAction = async (id: number, action: 'approve-rss' | 'approve-website' | 'reject' | 'block') => {
    try {
      setDsActionLoading(id);
      switch (action) {
        case 'approve-rss': await dsApi.approveRss(id); toast.success('Đã thêm nguồn RSS.'); break;
        case 'approve-website': await dsApi.approveWebsite(id); toast.success('Đã thêm nguồn Website.'); break;
        case 'reject': await dsApi.reject(id); toast.success('Đã từ chối nguồn.'); break;
        case 'block': await dsApi.block(id); toast.success('Đã chặn domain.'); break;
      }
      fetchDiscoveredSources();
      if (action === 'approve-rss' || action === 'approve-website') fetchSources();
    } catch (error: any) {
      if (error?.response?.status === 409) { toast('Nguồn đã tồn tại.', { icon: 'ℹ️' }); }
      else { toast.error(getErrorMessage(error)); }
    } finally {
      setDsActionLoading(null);
    }
  };

  const handleRefreshRss = async (id: number) => {
    try {
      setDsActionLoading(id);
      const result = await dsApi.refreshRss(id);
      toast.success(result.message || 'Đã kiểm tra RSS.');
      fetchDiscoveredSources();
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setDsActionLoading(null);
    }
  };

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
    if (!newSource.name.trim()) {
      toast.error('Vui lòng nhập tên nguồn');
      return;
    }

    if (newSource.source_type === 'rss') {
      if (!newSource.rss_url?.trim()) {
        toast.error('Vui lòng nhập RSS Feed URL');
        return;
      }
      const rssUrl = newSource.rss_url.trim().toLowerCase();
      const isHtmlPage = rssUrl.match(/\.(htm|html|php|asp|aspx)($|\?)/i);
      const hasRssKeywords = rssUrl.match(/(\.xml|\/feed|\/rss|rss\.|\.rss|atom|syndication)/i);
      const isRootDomain = rssUrl.match(/^https?:\/\/[^\/]+\/?$/);
      
      if (isHtmlPage || (!hasRssKeywords && isRootDomain)) {
        toast.error('Đây là link trang web/bài viết, không phải RSS feed. Hãy chọn loại nguồn Website hoặc nhập link RSS hợp lệ.');
        return;
      }
    } else {
      if (!newSource.url?.trim()) {
        toast.error('Vui lòng nhập URL');
        return;
      }
    }

    try {
      const payload: any = {
        name: newSource.name,
        url: newSource.source_type === 'rss' ? newSource.rss_url : newSource.url,
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
        rss_url: '',
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

  const tabItems: { key: SourceTab; label: string; icon: React.ReactNode }[] = [
    { key: 'active', label: 'Nguồn đang theo dõi', icon: <Globe className="w-4 h-4" /> },
    { key: 'discovered', label: 'Nguồn phát hiện tự động', icon: <Radar className="w-4 h-4" /> },
    { key: 'connectors', label: 'Kết nối nền tảng', icon: <Plug className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Quản lý nguồn</h1>
          <p className="text-sm text-gray-400 mt-1">
            Quản lý các nguồn dữ liệu để thu thập thông tin
          </p>
        </div>
        {activeTab === 'active' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 shadow-sm shadow-indigo-500/20 font-medium"
          >
            <Plus className="w-5 h-5 mr-2" />
            Thêm nguồn
          </button>
        )}
      </div>

      {/* Meta Banner */}
      <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Globe className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Khám phá sức mạnh của Meta</h3>
            <p className="text-sm text-blue-200 mt-0.5">Kết nối Facebook & Instagram để thu thập thêm đề cập từ các tài khoản được cấp quyền.</p>
          </div>
        </div>
        <a 
          href="/dashboard/integrations/meta"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition-colors whitespace-nowrap shadow-lg shadow-blue-600/20"
        >
          Kết nối Meta
        </a>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-1 shadow-xl mb-4">
        {tabItems.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 flex-1 justify-center ${
              activeTab === tab.key
                ? 'bg-white/10 text-white shadow-[0_2px_10px_rgba(255,255,255,0.1)] border border-white/10'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB 1: ACTIVE SOURCES
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'active' && (<>
      {/* Search */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm kiếm nguồn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500 shadow-xl transition-shadow"
          />
        </div>
        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-xl px-4 py-3 border border-white/10 rounded-xl w-full sm:w-auto shadow-xl">
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
          <div className="col-span-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-10 text-center text-gray-400 font-medium tracking-wide">
            <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-sm">
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
              <div key={source.id} className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-6 transition-all duration-300 hover:border-indigo-500/50 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)] group flex flex-col h-full hover:-translate-y-1">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-[#050A15] rounded-xl border border-white/10 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                      {getSourceIcon(source.source_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-white tracking-wide truncate max-w-[150px]" title={source.name}>{source.name}</h3>
                        {(() => {
                          if (isUnsupported) {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-gray-500/10 text-gray-400 border border-gray-500/20">
                                Chưa hỗ trợ
                              </span>
                            );
                          }
                          if (isTest) {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-gray-500/10 text-gray-400 border border-gray-500/20">
                                Nguồn test
                              </span>
                            );
                          }
                          const error = (source as any).last_error;
                          const isInvalidRss = error && (error.includes('invalid_rss_feed') || 
                                               error.includes('Feed parse error') || 
                                               error.includes('not well-formed') ||
                                               error.includes('invalid token') ||
                                               (source.source_type === 'rss' && error.includes('not well-formed')));
                          const isAiConfigError = error && (error.includes('ai_provider_not_configured') || 
                                                  error.includes('openai_dependency_missing') || 
                                                  error.includes('AI chưa cấu hình') ||
                                                  error.includes('thiếu package openai') ||
                                                  error.includes('openai package not installed'));
                          
                          if (isInvalidRss) {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                RSS không hợp lệ
                              </span>
                            );
                          } else if (error && !isAiConfigError) {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Lỗi crawl
                              </span>
                            );
                          } else if (source.last_crawled_at) {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Quét thành công
                              </span>
                            );
                          } else {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-gray-500/10 text-gray-400 border border-gray-500/20">
                                Chưa crawl
                              </span>
                            );
                          }
                        })()}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[11px] font-medium tracking-wider uppercase text-gray-500">{getSourceTypeText(source.source_type)}</p>
                        {(() => {
                          if (isUnsupported || isTest) return null;
                          
                          const error = (source as any).last_error;
                          const isAiConfigError = error && (error.includes('ai_provider_not_configured') || 
                                                  error.includes('openai_dependency_missing') || 
                                                  error.includes('AI chưa cấu hình') ||
                                                  error.includes('thiếu package openai') ||
                                                  error.includes('openai package not installed'));
                          
                          if (isAiConfigError) {
                             return (
                               <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                 AI chưa cấu hình
                               </span>
                             );
                          } else if (source.last_crawled_at && (!error || error === '')) {
                             return (
                               <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                 AI đã phân tích
                               </span>
                             );
                          }
                          return null;
                        })()}
                      </div>
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
                <p className="text-sm text-gray-400 truncate bg-[#050A15] p-3 rounded-xl border border-white/10 shadow-inner" title={source.url}>
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
                {(() => {
                  const error = (source as any).last_error;
                  if (!error) return null;
                  
                  // Check if invalid RSS feed
                  const isInvalidRss = error.includes('invalid_rss_feed') || 
                                       error.includes('Feed parse error') || 
                                       error.includes('not well-formed') ||
                                       error.includes('invalid token') ||
                                       (source.source_type === 'rss' && error.includes('not well-formed'));
                                       
                  if (isInvalidRss) {
                    return (
                      <div className="text-xs mt-3 p-2.5 bg-rose-500/5 border border-rose-500/20 rounded-lg">
                        <span className="text-rose-400 opacity-90 block mb-1">
                          URL này là trang web, không phải RSS feed.
                        </span>
                        <span className="text-gray-500 text-[11px] block leading-relaxed">
                          Hãy đổi loại nguồn sang Website hoặc nhập RSS URL hợp lệ.
                        </span>
                      </div>
                    );
                  }
                  
                  // Check if OpenAI dependency / config issue
                  const isAiConfigError = error.includes('ai_provider_not_configured') || 
                                          error.includes('openai_dependency_missing') || 
                                          error.includes('AI chưa cấu hình') ||
                                          error.includes('thiếu package openai') ||
                                          error.includes('openai package not installed');
                                          
                  if (isAiConfigError) {
                    return (
                      <div className="text-xs mt-3 p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                        <span className="text-amber-400 opacity-90">
                          Mention đã được thu thập, nhưng AI chưa phân tích do thiếu cấu hình hoặc package.
                        </span>
                      </div>
                    );
                  }

                  // Default clean display
                  let cleanMsg = error;
                  if (error.includes(': ')) {
                    const parts = error.split(': ');
                    if (parts.length > 1) {
                      cleanMsg = parts.slice(1).join(': ');
                    }
                  }
                  
                  if (isTest) {
                    return (
                      <div className="text-xs text-gray-400 mt-3 p-2.5 bg-gray-500/5 border border-gray-500/20 rounded-lg" title={error}>
                        <span className="font-semibold text-gray-500 block mb-1 uppercase tracking-wider text-[10px]">Nguồn test — không tính vào vận hành</span>
                        <span className="opacity-90">{cleanMsg.substring(0, 100)}{cleanMsg.length > 100 ? '...' : ''}</span>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="text-xs text-rose-400 mt-3 p-2.5 bg-rose-500/5 border border-rose-500/20 rounded-lg" title={error}>
                      <span className="font-semibold text-rose-500 block mb-1 uppercase tracking-wider text-[10px]">Lỗi crawl gần nhất</span>
                      <span className="opacity-90">{cleanMsg.substring(0, 100)}{cleanMsg.length > 100 ? '...' : ''}</span>
                    </div>
                  );
                })()}
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
      </>)}

      {/* ════════════════════════════════════════════════════════════════
          TAB 2: DISCOVERED SOURCES
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'discovered' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái:</span>
            {[
              { key: 'candidate', label: 'Chờ duyệt', color: 'amber' },
              { key: 'approved', label: 'Đã duyệt', color: 'emerald' },
              { key: 'rejected', label: 'Đã từ chối', color: 'rose' },
              { key: 'blocked', label: 'Đã chặn', color: 'red' },
              { key: '', label: 'Tất cả', color: 'gray' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setDsFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                  dsFilter === f.key
                    ? `bg-${f.color}-500/15 text-${f.color}-400 border-${f.color}-500/25`
                    : 'bg-white/5 text-gray-500 hover:text-gray-300 border-white/10 hover:border-white/20'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {dsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          ) : discoveredSources.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-10 text-center">
              <Radar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">Chưa có nguồn nào được phát hiện tự động.</p>
              <p className="text-xs text-gray-500 mt-1">Hãy vào Trung tâm quét → "Tự động tìm nguồn" để bắt đầu.</p>
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-black/30 text-left text-[10px] text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 font-medium">Nguồn</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Loại</th>
                      <th className="px-4 py-3 font-medium hidden lg:table-cell">RSS</th>
                      <th className="px-4 py-3 font-medium hidden lg:table-cell">Mentions</th>
                      <th className="px-4 py-3 font-medium hidden xl:table-cell">Từ khóa khớp</th>
                      <th className="px-4 py-3 font-medium">Điểm</th>
                      <th className="px-4 py-3 font-medium">Trạng thái</th>
                      <th className="px-4 py-3 font-medium text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {discoveredSources.map((ds: any) => (
                      <tr key={ds.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white text-sm truncate max-w-[200px]" title={ds.source_name}>{ds.source_name || ds.domain}</div>
                          <div className="text-[11px] text-gray-500 truncate max-w-[200px]">{ds.domain}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-gray-400 capitalize">{ds.source_type || '—'}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {ds.rss_valid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <Rss className="w-3 h-3" /> Có RSS
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-500">Không</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-gray-300 font-medium">{ds.sample_mentions_count || 0}</span>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {(ds.matched_keywords_json || []).slice(0, 3).map((kw: string, i: number) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded border border-indigo-500/20 truncate max-w-[80px]">{kw}</span>
                            ))}
                            {(ds.matched_keywords_json || []).length > 3 && (
                              <span className="text-[10px] text-gray-500">+{(ds.matched_keywords_json || []).length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  (ds.relevance_score || 0) >= 50 ? 'bg-emerald-500' : (ds.relevance_score || 0) >= 25 ? 'bg-amber-500' : 'bg-gray-600'
                                }`}
                                style={{ width: `${Math.min(ds.relevance_score || 0, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium w-7">{Math.round(ds.relevance_score || 0)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {ds.status === 'candidate' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">Chờ duyệt</span>
                          )}
                          {ds.status === 'approved' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Đã duyệt</span>
                          )}
                          {ds.status === 'rejected' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">Từ chối</span>
                          )}
                          {ds.status === 'blocked' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">Chặn</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {ds.status === 'candidate' && (
                            <div className="flex items-center justify-end gap-1">
                              {ds.rss_valid && (
                                <button
                                  onClick={() => handleDsAction(ds.id, 'approve-rss')}
                                  disabled={dsActionLoading === ds.id}
                                  className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors border border-transparent hover:border-emerald-500/20" title="Duyệt RSS"
                                >
                                  {dsActionLoading === ds.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rss className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              <button
                                onClick={() => handleDsAction(ds.id, 'approve-website')}
                                disabled={dsActionLoading === ds.id}
                                className="p-1.5 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20" title="Duyệt Website"
                              >
                                {dsActionLoading === ds.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleDsAction(ds.id, 'reject')}
                                disabled={dsActionLoading === ds.id}
                                className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20" title="Từ chối"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDsAction(ds.id, 'block')}
                                disabled={dsActionLoading === ds.id}
                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20" title="Chặn domain"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRefreshRss(ds.id)}
                                disabled={dsActionLoading === ds.id}
                                className="p-1.5 text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors border border-transparent hover:border-cyan-500/20" title="Kiểm tra lại RSS"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          {ds.status === 'approved' && ds.approved_source_id && (
                            <span className="text-[10px] text-emerald-400">Source #{ds.approved_source_id}</span>
                          )}
                          {ds.status === 'blocked' && (
                            <span className="text-[10px] text-gray-500 truncate max-w-[100px]" title={ds.blocked_reason}>{ds.blocked_reason || 'Đã chặn'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 3: CONNECTORS
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'connectors' && (
        <div className="space-y-4">
          {connectorsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {connectors.map((c: any) => (
                <div key={c.key} className={`bg-white/5 backdrop-blur-xl rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5 flex flex-col h-full ${
                  c.status === 'active' || c.status === 'limited' ? 'border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                    : c.status === 'config_required' ? 'border-amber-500/20 hover:border-amber-500/40'
                    : 'border-white/10 hover:border-white/20'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl border shadow-inner ${
                        c.status === 'active' || c.status === 'limited' ? 'bg-emerald-500/10 border-emerald-500/20' 
                          : c.status === 'config_required' ? 'bg-amber-500/10 border-amber-500/20'
                          : 'bg-white/5 border-white/10'
                      }`}>
                        {c.status === 'active' || c.status === 'limited' ? <Wifi className="w-5 h-5 text-emerald-400" />
                          : c.status === 'config_required' ? <Sparkles className="w-5 h-5 text-amber-400" />
                          : <WifiOff className="w-5 h-5 text-gray-500" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm">{c.name}</h3>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-right max-w-[120px] ${
                      c.status === 'active' || c.status === 'limited' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : c.status === 'config_required' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                    }`}>{c.status_label}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed flex-1 mb-4">{c.description}</p>
                  
                  {c.limitations && (
                    <div className="mb-4 text-[11px] p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300">
                      💡 {c.limitations}
                    </div>
                  )}

                  <div className="mt-auto">
                    {c.status === 'oauth_required' && (
                      <a href="/dashboard/integrations/meta" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center">
                          <Plug className="w-4 h-4 mr-2" /> Cấu hình Meta
                      </a>
                    )}
                    {c.status === 'limited' && (
                      <a href="/dashboard/integrations/meta" className="w-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 font-medium py-2 rounded-lg text-sm transition-colors block text-center">
                          Quản lý tài khoản
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#050A15]/90 border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
            <div className="p-6 border-b border-white/10 bg-white/5 sticky top-0 z-10 backdrop-blur-xl">
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

              {newSource.source_type !== 'rss' && (
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
              )}
              
              {newSource.source_type === 'rss' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Website gốc (tuỳ chọn)
                  </label>
                  <input
                    type="url"
                    value={newSource.url}
                    onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
                    placeholder="https://example.com"
                  />
                </div>
              )}

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
                      RSS Feed URL *
                    </label>
                    <input
                      type="url"
                      value={newSource.rss_url || ''}
                      onChange={(e) => setNewSource({ ...newSource, rss_url: e.target.value })}
                      placeholder="https://example.com/feed.xml"
                      className="w-full px-3 py-2 bg-[#1E293B] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500"
                    />
                    <p className="text-xs text-orange-300/80 mt-1.5">
                      RSS Feed URL phải là link XML/RSS thật, không phải trang chủ website.
                    </p>
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

            <div className="p-6 border-t border-white/10 bg-white/5 rounded-b-2xl flex justify-end space-x-3 sticky bottom-0 backdrop-blur-xl">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-300 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleAddSource}
                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all"
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
