'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';
import { dashboard, collectors, crawl } from '@/lib/api';
import { toast } from 'react-hot-toast';
import {
  BarChart, Activity, Globe, Youtube, Rss, Layers, CheckCircle2,
  AlertTriangle, Clock, RefreshCw, Plus, Search, MessageSquareText
} from 'lucide-react';

export default function OverviewPage() {
  const router = useRouter();
  const { activeProject } = useProject();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningCollector, setRunningCollector] = useState(false);
  const [scanning, setScanning] = useState(false);

  const loadData = async () => {
    if (!activeProject?.id) return;
    setLoading(true);
    try {
      const res = await dashboard.overview(activeProject.id);
      setData(res);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeProject]);

  const handleRunCollectors = async () => {
    if (!activeProject?.id) return;
    setRunningCollector(true);
    try {
      const res = await collectors.run(activeProject.id) as any;
      toast.success(`Collector finished. Mentions created: ${res.mentions_created}`);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Collector failed');
    } finally {
      setRunningCollector(false);
    }
  };

  const handleScanNow = async () => {
    if (!activeProject?.id) return;
    setScanning(true);
    try {
      const res = await crawl.manualScan({
        project_id: activeProject.id,
        mode: 'AUTO_DISCOVERY',
        keywords: [activeProject.name] // Simplified for now, real app might fetch project keywords
      });
      toast.success('Started live scan!');
      // Navigate to mentions page to poll job
      router.push(`/dashboard/mentions?project_id=${activeProject.id}&job_id=${res.job_id}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to trigger scan');
      setScanning(false);
    }
  };

  if (!activeProject) {
    return <div className="p-8 text-center text-gray-400">Please select a project first.</div>;
  }

  if (loading && !data) {
    return <div className="p-8 text-center text-gray-400">Đang tải dữ liệu...</div>;
  }

  const totals = data?.totals || {};
  const cHealth = data?.collectors || {};
  const recMentions = data?.recent_mentions || [];
  const recJobs = data?.recent_jobs || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard: {activeProject.name}</h1>
          <p className="text-gray-400 text-sm mt-1">Executive overview of your social listening data</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={handleRunCollectors}
            disabled={runningCollector}
            className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition flex items-center gap-2 text-sm"
          >
            {runningCollector ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
            Run Background Collection
          </button>
          <button
            onClick={handleScanNow}
            disabled={scanning}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition flex items-center gap-2 text-sm font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)]"
          >
            <Search className="w-4 h-4" /> {scanning ? 'Đang gọi...' : 'Scan Now'}
          </button>
        </div>
      </div>

      {totals.mentions_total === 0 && (
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Project này chưa có mentions</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Hãy chạy Background Collection hoặc Scan Now để thu thập dữ liệu từ các nguồn cấu hình.
          </p>
          <div className="flex justify-center gap-4">
            <button onClick={handleRunCollectors} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium">
              Run Background Collection
            </button>
            <button onClick={handleScanNow} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition font-medium">
              Scan Now
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-gray-800 p-5 rounded-xl">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Tổng Mentions</p>
          <h2 className="text-3xl font-bold text-white">{totals.mentions_total}</h2>
        </div>
        <div className="bg-[#111827] border border-gray-800 p-5 rounded-xl">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Mentions Hôm nay</p>
          <h2 className="text-3xl font-bold text-white">{totals.mentions_today}</h2>
        </div>
        <div className="bg-[#111827] border border-gray-800 p-5 rounded-xl">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Mentions 7 Ngày</p>
          <h2 className="text-3xl font-bold text-white">{totals.mentions_7d}</h2>
        </div>
        <div className="bg-[#111827] border border-gray-800 p-5 rounded-xl">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Mới Từ Lượt Scan Gần Nhất</p>
          <h2 className="text-3xl font-bold text-indigo-400">{totals.new_mentions_last_scan}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Collector Health */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 bg-gray-800/20">
              <h2 className="text-lg font-semibold text-white">Collector Health</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-1 bg-gray-800/50">
              <div className="bg-[#111827] p-4 flex flex-col items-center justify-center text-center">
                <Globe className={`w-8 h-8 mb-2 ${cHealth.web?.status === 'READY' ? 'text-emerald-400' : 'text-gray-500'}`} />
                <p className="text-sm font-medium text-gray-200">Web Search</p>
                <span className={`text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full ${cHealth.web?.status === 'READY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>{cHealth.web?.status || 'UNKNOWN'}</span>
              </div>
              <div className="bg-[#111827] p-4 flex flex-col items-center justify-center text-center">
                <Youtube className={`w-8 h-8 mb-2 ${cHealth.youtube?.status === 'READY' ? 'text-rose-400' : 'text-gray-500'}`} />
                <p className="text-sm font-medium text-gray-200">YouTube</p>
                <span className={`text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full ${cHealth.youtube?.status === 'READY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>{cHealth.youtube?.status || 'UNKNOWN'}</span>
              </div>
              <div className="bg-[#111827] p-4 flex flex-col items-center justify-center text-center">
                <Rss className={`w-8 h-8 mb-2 ${cHealth.rss?.status === 'READY' ? 'text-orange-400' : 'text-gray-500'}`} />
                <p className="text-sm font-medium text-gray-200">RSS Feeds</p>
                <span className={`text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full ${cHealth.rss?.status === 'READY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>{cHealth.rss?.status || 'UNKNOWN'}</span>
              </div>
            </div>
          </div>

          {/* Recent Mentions */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/20">
              <h2 className="text-lg font-semibold text-white">Recent Mentions</h2>
              <button onClick={() => router.push('/dashboard/mentions')} className="text-sm text-indigo-400 hover:text-indigo-300">View All</button>
            </div>
            <div className="divide-y divide-gray-800">
              {recMentions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No mentions found.</div>
              ) : (
                recMentions.map((m: any) => (
                  <div key={m.id} className="p-4 flex items-start gap-3 hover:bg-gray-800/30 transition">
                    <MessageSquareText className="w-5 h-5 text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-white line-clamp-1">{m.title || 'No Title'}</p>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                        <span>{m.domain || 'Unknown'}</span>
                        <span>•</span>
                        <span>{m.collected_at ? new Date(m.collected_at).toLocaleString() : ''}</span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Recent Jobs */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 bg-gray-800/20">
              <h2 className="text-lg font-semibold text-white">Recent Scan Jobs</h2>
            </div>
            <div className="divide-y divide-gray-800">
              {recJobs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No recent jobs.</div>
              ) : (
                recJobs.map((j: any) => (
                  <div key={j.id} className="p-4 hover:bg-gray-800/30 transition">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-white">Job #{j.id}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        j.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                        j.status === 'FAILED' || j.status === 'TIMEOUT' ? 'bg-rose-500/20 text-rose-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>{j.status}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                      <span>{j.mentions_found} mentions</span>
                      <button onClick={() => router.push(`/dashboard/mentions?project_id=${activeProject.id}&job_id=${j.id}`)} className="text-indigo-400 hover:underline">
                        View Results
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
