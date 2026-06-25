'use client';

import { useState, useEffect } from 'react';
import { Image as ImageIcon, RefreshCcw } from 'lucide-react';
import { reports } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { InfographicExportNotice } from '@/components/reports/InfographicExportNotice';
import { ReportDataScopeNotice } from '@/components/reports/ReportDataScopeNotice';
import { ReportErrorState } from '@/components/reports/ReportErrorState';

export default function InfographicPage() {
  const { activeProject } = useProject();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeProject]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const params: any = { date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() };
      if (activeProject) params.project_id = activeProject.id;
      
      const res = await reports.summaryData(params);
      setData(res);
    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.message || 'Failed to load infographic data';
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Image export is not implemented. The InfographicExportNotice component
  // replaces the previous button that called toast.error() internally.

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 dark:text-gray-400 font-medium flex items-center">
          <RefreshCcw className="w-5 h-5 mr-2 animate-spin text-pink-400" />
          Đang tải Infographic...
        </div>
      </div>
    );
  }

  if (fetchError && !data) {
    return (
      <div className="max-w-5xl mx-auto">
        <ReportErrorState errorMessage={fetchError} onRetry={fetchData} />
      </div>
    );
  }

  const sentimentData = [
    { name: 'Tích cực', value: data?.metrics?.sentiment?.positive || 0, color: '#10b981' },
    { name: 'Tiêu cực', value: data?.metrics?.sentiment?.negative || 0, color: '#f43f5e' },
    { name: 'Trung lập', value: data?.metrics?.sentiment?.neutral || 0, color: '#64748b' },
  ].filter(item => item.value > 0);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1E293B] p-4 rounded-xl border border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-pink-500" />
            Infographic Analytics
          </h1>
        </div>
        <div>
          {/* InfographicExportNotice replaces the old misleading "Export Image" button */}
          <InfographicExportNotice />
        </div>
      </div>

      {/* Data Scope Notice */}
      <ReportDataScopeNotice
        projectName={activeProject?.name}
        dateRange="30d"
        dateRangeLabel="Last 30 days"
      />

      <div className="overflow-x-auto pb-8">
        <div id="infographic-content" className="w-[1000px] mx-auto bg-[#0a0f1c] rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative text-white">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-700 p-10 relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/20 blur-3xl rounded-full"></div>
            <h2 className="text-5xl font-black mb-4 relative z-10 tracking-tight">BRAND ANALYTICS</h2>
            <div className="flex gap-4 relative z-10">
              <span className="bg-black/30 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-medium border border-white/20">
                Project: {data?.project_name || activeProject?.name || 'All Data'}
              </span>
              <span className="bg-black/30 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-medium border border-white/20">
                Last 30 Days
              </span>
            </div>
          </div>

          <div className="p-10 space-y-10">
            
            {/* Top Metrics Row */}
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-[#1e293b]/50 border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Total Mentions</div>
                <div className="text-4xl font-black text-pink-400">{data?.metrics?.total_mentions?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-[#1e293b]/50 border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Total Alerts</div>
                <div className="text-4xl font-black text-amber-400">{data?.metrics?.total_alerts?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-[#1e293b]/50 border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Incidents</div>
                <div className="text-4xl font-black text-rose-500">{data?.metrics?.total_incidents?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-[#1e293b]/50 border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Positive Ratio</div>
                <div className="text-4xl font-black text-emerald-400">
                  {data?.metrics?.total_mentions > 0 
                    ? Math.round((data?.metrics?.sentiment?.positive || 0) / data?.metrics?.total_mentions * 100) 
                    : 0}%
                </div>
              </div>
            </div>

            {/* Volume Chart */}
            {data?.trend && data.trend.length > 0 && (
              <div className="bg-[#1e293b]/30 border border-white/10 rounded-3xl p-8">
                <h3 className="text-lg font-bold uppercase tracking-widest text-white mb-6">Volume of Mentions</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.trend}>
                      <defs>
                        <linearGradient id="colorMentions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#94a3b8" 
                        tickFormatter={formatDate}
                        tick={{fontSize: 12}}
                        tickMargin={10}
                      />
                      <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                        itemStyle={{ color: '#ec4899' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="mentions" 
                        stroke="#ec4899" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorMentions)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-8">
              {/* Sentiment Pie */}
              <div className="bg-[#1e293b]/30 border border-white/10 rounded-3xl p-8 flex flex-col">
                <h3 className="text-lg font-bold uppercase tracking-widest text-white mb-6 text-center">Sentiment Breakdown</h3>
                <div className="flex-1 min-h-[300px]">
                  {sentimentData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sentimentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {sentimentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 italic">No sentiment data</div>
                  )}
                </div>
              </div>

              {/* Sources Bar Chart */}
              <div className="bg-[#1e293b]/30 border border-white/10 rounded-3xl p-8 flex flex-col">
                <h3 className="text-lg font-bold uppercase tracking-widest text-white mb-6 text-center">Top Sources</h3>
                <div className="flex-1 min-h-[300px]">
                  {data?.top_sources && data.top_sources.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Array.isArray(data?.top_sources) ? data.top_sources.slice(0, 5) : []} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                        <XAxis type="number" stroke="#94a3b8" />
                        <YAxis dataKey="name" type="category" stroke="#94a3b8" width={80} tick={{fontSize: 12}} />
                        <RechartsTooltip 
                          cursor={{fill: '#1e293b'}}
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                        />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                          {Array.isArray(data?.top_sources) && data.top_sources.slice(0, 5).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#8b5cf6' : '#6366f1'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 italic">No source data</div>
                  )}
                </div>
              </div>
            </div>

          </div>

          <div className="py-6 mt-10 border-t border-white/10 text-center bg-black/20">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">Powered by</div>
            <div className="font-black tracking-widest text-sm text-pink-500">NOPE INTELLIGENCE</div>
          </div>

        </div>
      </div>
    </div>
  );
}
