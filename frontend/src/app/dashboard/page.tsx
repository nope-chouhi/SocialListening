'use client';

import { useEffect, useState } from 'react';
import { 
  BarChart3, AlertTriangle, FileText, Database, 
  TrendingUp, TrendingDown, RefreshCcw 
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
      toast.error('Lỗi khi tải dữ liệu tổng quan');
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
      toast.error('Lỗi khi tải dữ liệu biểu đồ');
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
    { name: 'Tổng Mentions', value: metrics?.metrics?.total_mentions || 0, icon: Database, colorClass: 'bg-blue-500' },
    { name: 'Mentions Hôm Nay', value: metrics?.metrics?.mentions_today || 0, icon: TrendingUp, colorClass: 'bg-green-500' },
    { name: 'Mentions Tiêu Cực', value: metrics?.metrics?.negative_mentions || 0, icon: TrendingDown, colorClass: 'bg-red-500' },
    { name: 'Cảnh Báo', value: metrics?.metrics?.total_alerts || 0, icon: AlertTriangle, colorClass: 'bg-yellow-500' },
    { name: 'Sự Cố', value: metrics?.metrics?.total_incidents || 0, icon: FileText, colorClass: 'bg-purple-500' },
    { name: 'Nguồn Hoạt Động', value: metrics?.metrics?.total_sources || 0, icon: BarChart3, colorClass: 'bg-indigo-500' }
  ];

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Tổng quan giám sát mạng xã hội và phân tích dữ liệu</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {['today', '7d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range 
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {range === 'today' ? 'Hôm nay' : range === '7d' ? '7 ngày' : '30 ngày'}
              </button>
            ))}
          </div>
          <button 
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-gray-900 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
            title="Làm mới"
          >
            <RefreshCcw className={`w-5 h-5 ${loadingCharts || loadingMetrics ? 'animate-spin' : ''}`} />
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Xu Hướng Đề Cập</h2>
          <TrendChart data={trends?.items || []} isLoading={loadingCharts} />
        </div>

        {/* Sentiment & Hot Keywords */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Phân Bố Sắc Thái</h2>
            <SentimentDonutChart data={sentiment} isLoading={loadingCharts} />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Từ Khóa Nổi Bật</h2>
            <HotKeywordsWidget data={hotKeywords?.items || []} isLoading={loadingCharts} />
          </div>
        </div>
      </div>

      {/* Lists Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Mentions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-[600px]">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 rounded-t-xl">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Mentions Mới Nhất</h2>
            <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Top 10</span>
          </div>
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            {!metrics?.latest_mentions || metrics.latest_mentions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <FileText className="w-12 h-12 mb-3 text-gray-300" />
                <p>Chưa có mention nào. Hãy thêm nguồn và chạy quét đầu tiên.</p>
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-[600px]">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 rounded-t-xl">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Cảnh Báo Cần Xử Lý</h2>
            <span className="text-xs font-medium bg-red-100 text-red-800 px-2 py-1 rounded-full">Top 10</span>
          </div>
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            {!metrics?.latest_alerts || metrics.latest_alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <AlertTriangle className="w-12 h-12 mb-3 text-gray-300" />
                <p>Tuyệt vời! Không có cảnh báo mới nào.</p>
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
