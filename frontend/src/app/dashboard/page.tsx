'use client';

import { useEffect, useState } from 'react';
import { 
  BarChart3, AlertTriangle, FileText, Database, 
  TrendingUp, TrendingDown, RefreshCcw,
  Users, Map, PieChart, Sparkles, Activity
} from 'lucide-react';
import { dashboard, auth } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { withTimeout } from '@/lib/utils/timeout';

import dynamic from 'next/dynamic';

const DashboardKpiCard = dynamic(() => import('@/components/dashboard/DashboardKpiCard'), { ssr: false });
const TrendChart = dynamic(() => import('@/components/dashboard/TrendChart'), { ssr: false, loading: () => <div className="animate-pulse bg-gray-800/50 rounded-xl h-full w-full"></div> });
const SentimentDonutChart = dynamic(() => import('@/components/dashboard/SentimentDonutChart'), { ssr: false, loading: () => <div className="animate-pulse bg-gray-800/50 rounded-xl h-full w-full"></div> });
const HotKeywordsWidget = dynamic(() => import('@/components/dashboard/HotKeywordsWidget'), { ssr: false, loading: () => <div className="animate-pulse bg-gray-800/50 rounded-xl h-full w-full"></div> });
import MentionCard from '@/components/dashboard/MentionCard';
import AlertCard from '@/components/dashboard/AlertCard';
import RealtimeStatsSection from '@/components/dashboard/RealtimeStatsSection';
import { useProject } from '@/contexts/ProjectContext';

export default function DashboardPage() {
  const { activeProject, projects } = useProject();
  const [metrics, setMetrics] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [sentiment, setSentiment] = useState<any>(null);
  const [hotKeywords, setHotKeywords] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('');
  
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    // Stale-While-Revalidate: Load from cache instantly
    const cacheKey = `dash_data_${activeProject?.id || 'all'}_${timeRange}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.metrics) setMetrics(parsed.metrics);
        if (parsed.trends) setTrends(parsed.trends);
        if (parsed.sentiment) setSentiment(parsed.sentiment);
        if (parsed.hotKeywords) setHotKeywords(parsed.hotKeywords);
        setLoadingMetrics(false);
        setLoadingCharts(false);
      } catch (e) {}
    }

    fetchUserRole();
    fetchDashboardData(cacheKey);
  }, [activeProject?.id, timeRange]);

  const fetchUserRole = async () => {
    try {
      const user = await withTimeout(auth.getCurrentUser(), 5000);
      if (user && user.role) {
        setUserRole(user.role);
      }
    } catch (error) {}
  };

  const fetchDashboardData = async (cacheKey?: string) => {
    if (!activeProject) {
      setLoadingMetrics(false);
      setLoadingCharts(false);
      return;
    }

    try {
      if (!metrics) setLoadingMetrics(true);
      if (!trends) setLoadingCharts(true);

      const [summaryRes, trendsRes, sentimentRes, keywordsRes] = await Promise.allSettled([
        withTimeout(dashboard.summary(timeRange, activeProject.id), 15000),
        withTimeout(dashboard.trends(timeRange, activeProject.id), 15000),
        withTimeout(dashboard.sentimentSummary(timeRange, activeProject.id), 15000),
        withTimeout(dashboard.hotKeywords(timeRange === '30d' ? '7d' : 'today', activeProject.id), 15000),
      ]);

      const newData: any = {};

      if (summaryRes.status === 'fulfilled') {
        setMetrics(summaryRes.value);
        newData.metrics = summaryRes.value;
      } else {
        toast.error('Không tải được dữ liệu tổng quan');
      }

      if (trendsRes.status === 'fulfilled') {
        setTrends(trendsRes.value);
        newData.trends = trendsRes.value;
      }
      if (sentimentRes.status === 'fulfilled') {
        setSentiment(sentimentRes.value);
        newData.sentiment = sentimentRes.value;
      }
      if (keywordsRes.status === 'fulfilled') {
        setHotKeywords(keywordsRes.value);
        newData.hotKeywords = keywordsRes.value;
      }
      
      // Update cache
      const key = cacheKey || `dash_data_${activeProject?.id || 'all'}_${timeRange}`;
      localStorage.setItem(key, JSON.stringify(newData));
      
    } catch (error: any) {
      console.error('Lỗi khi tải dữ liệu dashboard', error);
    } finally {
      setLoadingMetrics(false);
      setLoadingCharts(false);
    }
  };

  const handleRefresh = () => {
    const cacheKey = `dash_data_${activeProject?.id || 'all'}_${timeRange}`;
    setLoadingMetrics(true);
    setLoadingCharts(true);
    fetchDashboardData(cacheKey);
  };

  // Removed blocking loading spinner to render shell immediately

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-wide">Dashboard</h1>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-md">
              <Activity className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">AI Anomaly Monitor Active</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tổng quan giám sát truyền thông, mentions và cảnh báo rủi ro.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="inline-flex bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-1 shadow-sm dark:shadow-inner backdrop-blur-md">
            {['today', '7d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-300 ${
                  timeRange === range 
                    ? 'bg-gray-100 text-gray-900 shadow-sm border border-gray-200 dark:bg-white/10 dark:text-white dark:shadow-[0_2px_10px_rgba(255,255,255,0.1)] dark:border-white/10' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/5'
                }`}
              >
                {range === 'today' ? 'Hôm nay' : range === '7d' ? '7 ngày' : '30 ngày'}
              </button>
            ))}
          </div>
          <button 
            onClick={handleRefresh}
            className="p-2.5 text-gray-500 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 dark:text-zinc-400 dark:hover:text-white dark:bg-black/40 dark:hover:bg-white/10 dark:border-white/10 rounded-lg shadow-sm transition-all duration-300 active:scale-95 backdrop-blur-md"
            title="Làm mới"
          >
            <RefreshCcw className={`w-4 h-4 ${loadingCharts || loadingMetrics ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {!activeProject ? (
        <div className="flex-1 w-full flex flex-col items-center justify-center min-h-[50vh] bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-8 text-center mt-6">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
            <Activity className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Chào mừng đến với Nope</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
            {projects && projects.length > 0 
              ? "Vui lòng chọn một dự án từ menu bên trái để xem tổng quan giám sát."
              : "Bạn chưa có dự án nào. Vui lòng liên hệ Admin để được cấp quyền hoặc tạo dự án mới."}
          </p>
        </div>
      ) : (
        <>
          {/* Real-time section */}
          <RealtimeStatsSection projectId={activeProject.id} />


          {/* Lists Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Mentions */}
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col h-[600px] overflow-hidden group hover:border-gray-300 dark:hover:border-white/20 transition-all duration-500">
          <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-black/20">
            <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-wide">Mentions Mới Nhất</h2>
            <span className="text-[10px] font-black tracking-[0.1em] uppercase bg-indigo-50 border border-indigo-200 text-indigo-600 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300 px-3 py-1.5 rounded-lg shadow-sm">Top 10</span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
            {loadingMetrics ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-4 p-4 border border-white/5 rounded-lg bg-white/5">
                    <div className="rounded-full bg-white/10 h-10 w-10"></div>
                    <div className="flex-1 space-y-3 py-1">
                      <div className="h-2 bg-white/10 rounded w-3/4"></div>
                      <div className="space-y-2">
                        <div className="h-2 bg-white/10 rounded"></div>
                        <div className="h-2 bg-white/10 rounded w-5/6"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : !metrics?.latest_mentions || metrics.latest_mentions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-zinc-400 font-medium tracking-wide">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-white/10 shadow-sm dark:shadow-lg dark:shadow-black/20">
                  <FileText className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
                </div>
                <p className="text-sm text-gray-600 dark:text-zinc-300">Chưa có mention nào.</p>
                <p className="text-xs mt-1.5 text-gray-400 dark:text-zinc-500">Hãy thêm nguồn và chạy quét đầu tiên.</p>
              </div>
            ) : (
              metrics.latest_mentions.map((mention: any) => (
                <MentionCard 
                  key={mention.id} 
                  mention={mention} 
                  userRole={userRole}
                  onActionComplete={fetchDashboardData} 
                />
              ))
            )}
          </div>
        </div>

        {/* Latest Alerts */}
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col h-[600px] overflow-hidden group hover:border-gray-300 dark:hover:border-white/20 transition-all duration-500">
          <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-black/20">
            <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-wide">Cảnh Báo Cần Xử Lý</h2>
            <span className="text-[10px] font-black tracking-[0.1em] uppercase bg-rose-50 border border-rose-200 text-rose-600 dark:bg-rose-500/20 dark:border-rose-500/30 dark:text-rose-300 px-3 py-1.5 rounded-lg shadow-sm animate-pulse">Top 10</span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
            {loadingMetrics ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-4 p-4 border border-white/5 rounded-lg bg-white/5">
                    <div className="rounded-full bg-white/10 h-10 w-10"></div>
                    <div className="flex-1 space-y-3 py-1">
                      <div className="h-2 bg-white/10 rounded w-3/4"></div>
                      <div className="space-y-2">
                        <div className="h-2 bg-white/10 rounded"></div>
                        <div className="h-2 bg-white/10 rounded w-5/6"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : !metrics?.latest_alerts || metrics.latest_alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-zinc-400 font-medium tracking-wide">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-white/10 shadow-sm dark:shadow-lg dark:shadow-black/20">
                  <AlertTriangle className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
                </div>
                <p className="text-sm text-gray-600 dark:text-zinc-300">Không có cảnh báo mới nào.</p>
              </div>
            ) : (
              metrics.latest_alerts.map((alert: any) => (
                <AlertCard 
                  key={alert.id} 
                  alert={alert} 
                  userRole={userRole}
                  onActionComplete={fetchDashboardData} 
                />
              ))
            )}
          </div>
        </div>
      </div>
        </>
      )}
      
    </div>
  );
}

