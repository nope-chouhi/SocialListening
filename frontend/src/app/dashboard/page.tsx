'use client';

import { useEffect, useState } from 'react';
import { 
  BarChart3, AlertTriangle, FileText, Database, 
  TrendingUp, TrendingDown, RefreshCcw,
  Users, Map, PieChart, Sparkles, Activity
} from 'lucide-react';
import { dashboard, auth } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';

import DashboardKpiCard from '@/components/dashboard/DashboardKpiCard';
import TrendChart from '@/components/dashboard/TrendChart';
import SentimentDonutChart from '@/components/dashboard/SentimentDonutChart';
import HotKeywordsWidget from '@/components/dashboard/HotKeywordsWidget';
import MentionCard from '@/components/dashboard/MentionCard';
import AlertCard from '@/components/dashboard/AlertCard';
import RealtimeStatsSection from '@/components/dashboard/RealtimeStatsSection';
import { useProject } from '@/contexts/ProjectContext';

export default function DashboardPage() {
  const { activeProject } = useProject();
  const [metrics, setMetrics] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [sentiment, setSentiment] = useState<any>(null);
  const [hotKeywords, setHotKeywords] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('');
  
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchUserRole();
    fetchDashboardSummary();
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [timeRange]);

  const fetchUserRole = async () => {
    try {
      const user = await auth.getCurrentUser();
      if (user && user.role) {
        setUserRole(user.role);
      }
    } catch (error) {
      console.error('Failed to fetch user role', error);
    }
  };

  const fetchDashboardSummary = async () => {
    try {
      setLoadingMetrics(true);
      const data = await dashboard.summary();
      setMetrics(data);
    } catch (error: any) {
      console.error('Error fetching dashboard summary:', error);
      // Don't toast for 401 — global interceptor handles redirect
      if (error?.response?.status !== 401) {
        toast.error('Lỗi khi tải dữ liệu tổng quan');
      }
    } finally {
      setLoadingMetrics(false);
    }
  };

  const fetchChartData = async () => {
    try {
      setLoadingCharts(true);
      const [trendsData, sentimentData, keywordsData] = await Promise.all([
        dashboard.trends(timeRange),
        dashboard.sentimentSummary(timeRange),
        dashboard.hotKeywords(timeRange === '30d' ? '7d' : 'today'),
      ]);
      setTrends(trendsData);
      setSentiment(sentimentData);
      setHotKeywords(keywordsData);
    } catch (error: any) {
      console.error('Error fetching chart data:', error);
      // Don't toast for 401 — global interceptor handles redirect
      if (error?.response?.status !== 401) {
        toast.error('Lỗi khi tải dữ liệu biểu đồ');
      }
    } finally {
      setLoadingCharts(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardSummary();
    fetchChartData();
  };

  if (loadingMetrics && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500 flex items-center">
          <RefreshCcw className="w-5 h-5 mr-2 animate-spin" />
          Đang tải dữ liệu...
        </div>
      </div>
    );
  }

  const stats = [
    { name: 'Tổng Mentions', value: metrics?.total_mentions || 0, icon: Database, colorClass: 'bg-blue-500' },
    { name: 'Mentions Hôm Nay', value: metrics?.mentions_today || 0, icon: TrendingUp, colorClass: 'bg-green-500' },
    { name: 'Mentions Tiêu Cực', value: metrics?.negative_mentions || 0, icon: TrendingDown, colorClass: 'bg-red-500' },
    { name: 'Cảnh Báo', value: metrics?.alerts_count || 0, icon: AlertTriangle, colorClass: 'bg-yellow-500' },
    { name: 'Sự Cố', value: metrics?.incidents_count || 0, icon: FileText, colorClass: 'bg-purple-500' },
    { name: 'Nguồn Hoạt Động', value: metrics?.active_sources || 0, icon: BarChart3, colorClass: 'bg-indigo-500' }
  ];

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-wide">Dashboard</h1>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">AI Anomaly Monitor Active</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-1">Tổng quan giám sát truyền thông, mentions và cảnh báo rủi ro.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="inline-flex bg-black/40 border border-white/10 rounded-lg p-1 shadow-inner backdrop-blur-md">
            {['today', '7d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-300 ${
                  timeRange === range 
                    ? 'bg-white/10 text-white shadow-[0_2px_10px_rgba(255,255,255,0.1)] border border-white/10' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }`}
              >
                {range === 'today' ? 'Hôm nay' : range === '7d' ? '7 ngày' : '30 ngày'}
              </button>
            ))}
          </div>
          <button 
            onClick={handleRefresh}
            className="p-2.5 text-zinc-400 hover:text-white bg-black/40 hover:bg-white/10 border border-white/10 rounded-lg shadow-sm transition-all duration-300 active:scale-95 backdrop-blur-md"
            title="Làm mới"
          >
            <RefreshCcw className={`w-4 h-4 ${loadingCharts || loadingMetrics ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Real-time section */}
      <RealtimeStatsSection projectId={activeProject?.id} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {stats.map((stat) => (
          <DashboardKpiCard 
            key={stat.name}
            title={stat.name}
            value={stat.value}
            icon={stat.icon}
            colorClass={stat.colorClass}
          />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="xl:col-span-2 bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-5 flex flex-col group hover:border-white/20 transition-all duration-500">
          <div className="mb-4">
            <h2 className="text-base font-bold text-white tracking-wide">Xu Hướng Đề Cập</h2>
            <p className="text-xs text-zinc-400 mt-1 font-medium">Lượng mentions, cảnh báo và sự cố theo thời gian</p>
          </div>
          <div className="flex-1 min-h-[300px]">
            <TrendChart data={trends?.items || []} isLoading={loadingCharts} />
          </div>
        </div>

        {/* Sentiment & Hot Keywords */}
        <div className="space-y-6">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-5 group hover:border-white/20 transition-all duration-500">
            <h2 className="text-base font-bold text-white tracking-wide mb-4">Phân Bố Sắc Thái</h2>
            <SentimentDonutChart data={sentiment} isLoading={loadingCharts} />
          </div>
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-5 group hover:border-white/20 transition-all duration-500">
            <h2 className="text-base font-bold text-white tracking-wide mb-4">Từ Khóa Nổi Bật</h2>
            <HotKeywordsWidget data={hotKeywords?.items || []} isLoading={loadingCharts} />
          </div>
        </div>
      </div>

      {/* Sources & AI Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sources */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-5 group hover:border-white/20 transition-all duration-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Top Nguồn Đóng Góp Thảo Luận
            </h2>
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg shadow-sm">
              {timeRange === 'today' ? 'Hôm nay' : timeRange === '7d' ? '7 ngày' : '30 ngày'}
            </span>
          </div>
          {metrics?.top_sources && metrics.top_sources.length > 0 ? (
            <div className="space-y-3">
              {metrics.top_sources.slice(0, 5).map((source: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                  <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400 font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{source.domain || source.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{source.mention_count || 0} mentions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-indigo-400">{source.percentage || 0}%</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-400">
              <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Chưa có dữ liệu nguồn</p>
            </div>
          )}
        </div>

        {/* AI Insights */}
        <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/20 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-500/30 p-5 group hover:border-indigo-500/50 transition-all duration-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-base font-bold text-indigo-300 tracking-wide">AI Insights</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Trend Analysis</p>
              <p className="text-sm text-gray-300 leading-relaxed">
                {metrics?.total_mentions > 0 
                  ? `Đã ghi nhận ${metrics.total_mentions.toLocaleString()} mentions trong khoảng thời gian đã chọn. ${metrics.negative_mentions > 0 ? `Tỷ lệ tiêu cực là ${((metrics.negative_mentions / metrics.total_mentions) * 100).toFixed(1)}%, cần theo dõi sát sao.` : 'Tỷ lệ tiêu cực thấp, tình hình ổn định.'}`
                  : 'Chưa có đủ dữ liệu để phân tích trend.'
                }
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Recommendations</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5">•</span>
                  <span>Tiếp tục theo dõi các từ khóa nổi bật để phát hiện sớm các vấn đề tiềm ẩn.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5">•</span>
                  <span>Kiểm tra định kỳ các nguồn hoạt động để đảm bảo thu thập dữ liệu hiệu quả.</span>
                </li>
                {metrics?.alerts_count > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 mt-0.5">•</span>
                    <span>Có {metrics.alerts_count} cảnh báo cần xử lý. Ưu tiên giải quyết các cảnh báo nghiêm trọng.</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Enterprise Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-10 flex flex-col items-center justify-center transition-all duration-500 opacity-0 group-hover:opacity-100">
            <div className="bg-indigo-500/20 p-3 rounded-2xl mb-3 shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-indigo-500/30">
              <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 mb-2">Enterprise Only</span>
            <p className="text-xs text-zinc-400 mt-1 text-center px-6 leading-relaxed">Nâng cấp để mở khóa tính năng phân tích tỷ trọng thị phần truyền thông.</p>
          </div>
          <h2 className="text-base font-bold text-white mb-4 flex items-center">
            <PieChart className="w-4 h-4 mr-2 text-indigo-400" /> Share of Voice
          </h2>
          <div className="h-40 rounded-xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/10 to-transparent border border-white/5 flex items-center justify-center overflow-hidden">
            <div className="w-24 h-24 rounded-full border-[8px] border-t-indigo-500 border-r-purple-500 border-b-white/10 border-l-white/10 animate-[spin_10s_linear_infinite]" />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-10 flex flex-col items-center justify-center transition-all duration-500 opacity-0 group-hover:opacity-100">
            <div className="bg-purple-500/20 p-3 rounded-2xl mb-3 shadow-[0_0_20px_rgba(168,85,247,0.5)] border border-purple-500/30">
              <Users className="w-6 h-6 text-purple-400 animate-pulse" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 mb-2">Enterprise Only</span>
            <p className="text-xs text-zinc-400 mt-1 text-center px-6 leading-relaxed">Mở khóa bảng xếp hạng 100 người ảnh hưởng tác động đến thương hiệu.</p>
          </div>
          <h2 className="text-base font-bold text-white mb-4 flex items-center">
            <Users className="w-4 h-4 mr-2 text-purple-400" /> Top Influencers
          </h2>
          <div className="h-40 rounded-xl bg-gradient-to-br from-purple-500/20 to-transparent border border-white/5 p-4 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-white/5 rounded-lg flex items-center px-3 gap-3">
                <div className="w-5 h-5 rounded-full bg-white/10" />
                <div className="flex-1 h-2 bg-white/10 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-10 flex flex-col items-center justify-center transition-all duration-500 opacity-0 group-hover:opacity-100">
            <div className="bg-emerald-500/20 p-3 rounded-2xl mb-3 shadow-[0_0_20px_rgba(16,185,129,0.5)] border border-emerald-500/30">
              <Map className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 mb-2">Enterprise Only</span>
            <p className="text-xs text-zinc-400 mt-1 text-center px-6 leading-relaxed">Theo dõi khu vực bùng phát khủng hoảng theo thời gian thực.</p>
          </div>
          <h2 className="text-base font-bold text-white mb-4 flex items-center">
            <Map className="w-4 h-4 mr-2 text-emerald-400" /> Geo Heat Map
          </h2>
          <div className="h-40 rounded-xl bg-[url('https://upload.wikimedia.org/wikipedia/commons/c/c3/Vietnam_location_map.svg')] bg-cover bg-center bg-no-repeat opacity-30 border border-white/5 relative">
            <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-rose-500 rounded-full animate-ping" />
            <div className="absolute top-1/3 left-1/3 w-3 h-3 bg-amber-500 rounded-full animate-ping" style={{ animationDelay: '500ms' }} />
          </div>
        </div>
      </div>

      {/* Lists Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Mentions */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 flex flex-col h-[600px] overflow-hidden group hover:border-white/20 transition-all duration-500">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
            <h2 className="text-base font-bold text-white tracking-wide">Mentions Mới Nhất</h2>
            <span className="text-[10px] font-black tracking-[0.1em] uppercase bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg shadow-sm">Top 10</span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
            {!metrics?.latest_mentions || metrics.latest_mentions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 font-medium tracking-wide">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-lg shadow-black/20">
                  <FileText className="w-8 h-8 text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-300">Chưa có mention nào.</p>
                <p className="text-xs mt-1.5 text-zinc-500">Hãy thêm nguồn và chạy quét đầu tiên.</p>
              </div>
            ) : (
              metrics.latest_mentions.map((mention: any) => (
                <MentionCard 
                  key={mention.id} 
                  mention={mention} 
                  userRole={userRole}
                  onActionComplete={fetchDashboardSummary} 
                />
              ))
            )}
          </div>
        </div>

        {/* Latest Alerts */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 flex flex-col h-[600px] overflow-hidden group hover:border-white/20 transition-all duration-500">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
            <h2 className="text-base font-bold text-white tracking-wide">Cảnh Báo Cần Xử Lý</h2>
            <span className="text-[10px] font-black tracking-[0.1em] uppercase bg-rose-500/20 border border-rose-500/30 text-rose-300 px-3 py-1.5 rounded-lg shadow-sm animate-pulse">Top 10</span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
            {!metrics?.latest_alerts || metrics.latest_alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 font-medium tracking-wide">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-lg shadow-black/20">
                  <AlertTriangle className="w-8 h-8 text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-300">Không có cảnh báo mới nào.</p>
              </div>
            ) : (
              metrics.latest_alerts.map((alert: any) => (
                <AlertCard 
                  key={alert.id} 
                  alert={alert} 
                  userRole={userRole}
                  onActionComplete={fetchDashboardSummary} 
                />
              ))
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
