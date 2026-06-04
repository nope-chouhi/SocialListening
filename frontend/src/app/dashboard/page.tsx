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
    // Try to load cached summary if available
    const cacheKey = `dash_summary_${activeProject?.id || 'all'}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 30000) {
          setMetrics(parsed.data);
          setLoadingMetrics(false);
        }
      } catch (e) {}
    }

    fetchUserRole();
    fetchDashboardData();
  }, [activeProject?.id, timeRange]);

  const fetchUserRole = async () => {
    try {
      const user = await withTimeout(auth.getCurrentUser(), 5000);
      if (user && user.role) {
        setUserRole(user.role);
      }
    } catch (error) {}
  };

  const fetchDashboardData = async () => {
    try {
      if (!metrics) setLoadingMetrics(true);
      if (!trends) setLoadingCharts(true);

      const [summaryRes, trendsRes, sentimentRes, keywordsRes] = await Promise.allSettled([
        withTimeout(dashboard.summary(activeProject?.id), 10000),
        withTimeout(dashboard.trends(timeRange, activeProject?.id), 10000),
        withTimeout(dashboard.sentimentSummary(timeRange, activeProject?.id), 10000),
        withTimeout(dashboard.hotKeywords(timeRange === '30d' ? '7d' : 'today', activeProject?.id), 10000),
      ]);

      if (summaryRes.status === 'fulfilled') {
        setMetrics(summaryRes.value);
        localStorage.setItem(`dash_summary_${activeProject?.id || 'all'}`, JSON.stringify({
          timestamp: Date.now(),
          data: summaryRes.value
        }));
      } else {
        toast.error('Không tải được dữ liệu tổng quan');
      }

      if (trendsRes.status === 'fulfilled') setTrends(trendsRes.value);
      if (sentimentRes.status === 'fulfilled') setSentiment(sentimentRes.value);
      if (keywordsRes.status === 'fulfilled') setHotKeywords(keywordsRes.value);
      
    } catch (error: any) {
      console.error('Lỗi khi tải dữ liệu dashboard', error);
    } finally {
      setLoadingMetrics(false);
      setLoadingCharts(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardData();
  };

  // Removed blocking loading spinner to render shell immediately

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


      {/* Lists Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Mentions */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 flex flex-col h-[600px] overflow-hidden group hover:border-white/20 transition-all duration-500">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
            <h2 className="text-base font-bold text-white tracking-wide">Mentions Mới Nhất</h2>
            <span className="text-[10px] font-black tracking-[0.1em] uppercase bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg shadow-sm">Top 10</span>
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
                  onActionComplete={fetchDashboardData} 
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
                  onActionComplete={fetchDashboardData} 
                />
              ))
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
