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

export default function DashboardPage() {
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
        dashboard.hotKeywords(timeRange === '30d' ? '7d' : 'today') // adjust keyword range for performance if needed
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
          <div className="inline-flex bg-[#0B1220] border border-gray-800 rounded-lg p-1 shadow-inner">
            {['today', '7d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  timeRange === range 
                    ? 'bg-[#1E293B] text-white shadow-sm shadow-black/20' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                }`}
              >
                {range === 'today' ? 'Hôm nay' : range === '7d' ? '7 ngày' : '30 ngày'}
              </button>
            ))}
          </div>
          <button 
            onClick={handleRefresh}
            className="p-2.5 text-gray-400 hover:text-white bg-[#0B1220] hover:bg-[#1E293B] border border-gray-800 rounded-lg shadow-sm transition-all duration-200 active:scale-95"
            title="Làm mới"
          >
            <RefreshCcw className={`w-4 h-4 ${loadingCharts || loadingMetrics ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

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
        <div className="xl:col-span-2 bg-[#111827] rounded-xl shadow-sm border border-gray-800 p-5 flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white">Xu Hướng Đề Cập</h2>
            <p className="text-xs text-gray-500 mt-1">Lượng mentions, cảnh báo và sự cố theo thời gian</p>
          </div>
          <div className="flex-1 min-h-[300px]">
            <TrendChart data={trends?.items || []} isLoading={loadingCharts} />
          </div>
        </div>

        {/* Sentiment & Hot Keywords */}
        <div className="space-y-6">
          <div className="bg-[#111827] rounded-xl shadow-sm border border-gray-800 p-5">
            <h2 className="text-base font-semibold text-white mb-4">Phân Bố Sắc Thái</h2>
            <SentimentDonutChart data={sentiment} isLoading={loadingCharts} />
          </div>
          <div className="bg-[#111827] rounded-xl shadow-sm border border-gray-800 p-5">
            <h2 className="text-base font-semibold text-white mb-4">Từ Khóa Nổi Bật</h2>
            <HotKeywordsWidget data={hotKeywords?.items || []} isLoading={loadingCharts} />
          </div>
        </div>
      </div>

      {/* Advanced Enterprise Widgets (Not Integrated Yet) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#111827] rounded-xl shadow-sm border border-gray-800 p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center transition-all duration-300">
            <div className="bg-[#1E293B] p-3 rounded-full mb-3 shadow-lg border border-gray-700">
              <PieChart className="w-6 h-6 text-gray-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#0B1220] px-3 py-1 rounded-full border border-gray-800">Chưa tích hợp</span>
            <p className="text-xs text-gray-500 mt-2 text-center px-4">Tính năng Share of Voice đang được phát triển.</p>
          </div>
          <h2 className="text-base font-semibold text-gray-500 mb-4 opacity-50 flex items-center">
            <PieChart className="w-4 h-4 mr-2" /> Share of Voice
          </h2>
          <div className="h-40 bg-[#0B1220] rounded-lg border border-gray-800 opacity-20"></div>
        </div>

        <div className="bg-[#111827] rounded-xl shadow-sm border border-gray-800 p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center transition-all duration-300">
            <div className="bg-[#1E293B] p-3 rounded-full mb-3 shadow-lg border border-gray-700">
              <Users className="w-6 h-6 text-gray-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#0B1220] px-3 py-1 rounded-full border border-gray-800">Chưa tích hợp</span>
            <p className="text-xs text-gray-500 mt-2 text-center px-4">Bảng xếp hạng Influencers đang được phát triển.</p>
          </div>
          <h2 className="text-base font-semibold text-gray-500 mb-4 opacity-50 flex items-center">
            <Users className="w-4 h-4 mr-2" /> Top Influencers
          </h2>
          <div className="h-40 bg-[#0B1220] rounded-lg border border-gray-800 opacity-20"></div>
        </div>

        <div className="bg-[#111827] rounded-xl shadow-sm border border-gray-800 p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center transition-all duration-300">
            <div className="bg-[#1E293B] p-3 rounded-full mb-3 shadow-lg border border-gray-700">
              <Map className="w-6 h-6 text-gray-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#0B1220] px-3 py-1 rounded-full border border-gray-800">Chưa tích hợp</span>
            <p className="text-xs text-gray-500 mt-2 text-center px-4">Bản đồ nhiệt Geolocation chưa thu thập đủ data.</p>
          </div>
          <h2 className="text-base font-semibold text-gray-500 mb-4 opacity-50 flex items-center">
            <Map className="w-4 h-4 mr-2" /> Geolocation Heat Map
          </h2>
          <div className="h-40 bg-[#0B1220] rounded-lg border border-gray-800 opacity-20"></div>
        </div>
      </div>

      {/* Lists Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Mentions */}
        <div className="bg-[#111827] rounded-xl shadow-sm border border-gray-800 flex flex-col h-[600px] overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#0B1220]/50">
            <h2 className="text-base font-semibold text-white">Mentions Mới Nhất</h2>
            <span className="text-[10px] font-bold tracking-wider uppercase bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-md shadow-sm">Top 10</span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
            {!metrics?.latest_mentions || metrics.latest_mentions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 font-medium tracking-wide">
                <div className="w-16 h-16 mb-4 rounded-xl bg-[#1E293B] flex items-center justify-center border border-gray-800 shadow-sm">
                  <FileText className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-sm text-gray-300">Chưa có mention nào.</p>
                <p className="text-xs mt-1.5 text-gray-500">Hãy thêm nguồn và chạy quét đầu tiên.</p>
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
        <div className="bg-[#111827] rounded-xl shadow-sm border border-gray-800 flex flex-col h-[600px] overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#0B1220]/50">
            <h2 className="text-base font-semibold text-white">Cảnh Báo Cần Xử Lý</h2>
            <span className="text-[10px] font-bold tracking-wider uppercase bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-1 rounded-md shadow-sm">Top 10</span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
            {!metrics?.latest_alerts || metrics.latest_alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 font-medium tracking-wide">
                <div className="w-16 h-16 mb-4 rounded-xl bg-[#1E293B] flex items-center justify-center border border-gray-800 shadow-sm">
                  <AlertTriangle className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-sm text-gray-300">Không có cảnh báo mới nào.</p>
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
