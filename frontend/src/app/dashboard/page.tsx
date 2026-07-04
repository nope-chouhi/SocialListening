'use client';

import { useEffect, useState } from 'react';
import { Activity, RefreshCcw } from 'lucide-react';
import { dashboard, auth } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { withTimeout } from '@/lib/utils/timeout';

import RealtimeStatsSection from '@/components/dashboard/RealtimeStatsSection';
import DashboardMetricGrid from '@/components/dashboard/DashboardMetricGrid';
import MentionTrendCard from '@/components/dashboard/MentionTrendCard';
import SentimentOverviewCard from '@/components/dashboard/SentimentOverviewCard';
import HotKeywordsCard from '@/components/dashboard/HotKeywordsCard';
import RecentMentionsPanel from '@/components/dashboard/RecentMentionsPanel';
import RiskAlertsPanel from '@/components/dashboard/RiskAlertsPanel';

import { useProject } from '@/contexts/ProjectContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

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
        const err = summaryRes.reason;
        const statusCode = err?.response?.status || 'Unknown';
        const safeMsg = err?.message || String(err);
        console.error(`[Dashboard] Failed to load summary. Endpoint: /api/dashboard/summary. Status: ${statusCode}. Error: ${safeMsg}`);
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

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <PageHeader
        title="Dashboard"
        subtitle="Tổng quan giám sát truyền thông, mentions và cảnh báo rủi ro."
        badge={
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-md">
            <Activity className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">AI Anomaly Monitor Active</span>
          </div>
        }
        actions={
          <>
            <div className="inline-flex bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg p-1 shadow-sm dark:shadow-inner backdrop-blur-md">
              {['today', '7d', '30d'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-300 ${
                    timeRange === range 
                      ? 'bg-slate-100 text-slate-900 shadow-sm border border-slate-200 dark:bg-white/10 dark:text-white dark:shadow-[0_2px_10px_rgba(255,255,255,0.1)] dark:border-white/10' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/5'
                  }`}
                >
                  {range === 'today' ? 'Hôm nay' : range === '7d' ? '7 ngày' : '30 ngày'}
                </button>
              ))}
            </div>
            <button 
              onClick={handleRefresh}
              className="p-2.5 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 dark:text-zinc-400 dark:hover:text-slate-100 dark:bg-black/40 dark:hover:bg-white/10 dark:border-white/10 rounded-lg shadow-sm transition-all duration-300 active:scale-95 backdrop-blur-md"
              title="Làm mới"
            >
              <RefreshCcw className={`w-4 h-4 ${loadingCharts || loadingMetrics ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
            </button>
          </>
        }
      />

      {!activeProject ? (
        <EmptyState
          icon={<Activity className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />}
          title="Chào mừng đến với Nope24"
          description={
            projects && projects.length > 0 
              ? "Vui lòng chọn một dự án từ menu bên trái để xem tổng quan giám sát."
              : "Bạn chưa có dự án nào. Vui lòng liên hệ Admin để được cấp quyền hoặc tạo dự án mới."
          }
        />
      ) : (
        <>
          {/* Real-time section */}
          <RealtimeStatsSection projectId={activeProject.id} />

          {/* Historical Overview */}
          <div className="pt-4 space-y-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
              Historical Overview ({timeRange === 'today' ? 'Hôm nay' : timeRange === '7d' ? '7 ngày' : '30 ngày'})
            </h2>
            
            <DashboardMetricGrid metrics={metrics} isLoading={loadingMetrics} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <MentionTrendCard trends={trends} isLoading={loadingCharts} />
              </div>
              <div>
                <SentimentOverviewCard sentiment={sentiment} isLoading={loadingCharts} />
              </div>
            </div>

            <HotKeywordsCard keywords={hotKeywords} isLoading={loadingCharts} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <RecentMentionsPanel 
                mentions={metrics?.latest_mentions || []} 
                isLoading={loadingMetrics}
                userRole={userRole}
                onActionComplete={handleRefresh}
              />
              <RiskAlertsPanel 
                alerts={metrics?.latest_alerts || []} 
                isLoading={loadingMetrics}
                userRole={userRole}
                onActionComplete={handleRefresh}
              />
            </div>
          </div>
        </>
      )}
      
    </div>
  );
}
