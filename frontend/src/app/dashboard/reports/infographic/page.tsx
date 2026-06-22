'use client';

import { useState, useEffect } from 'react';
import { Image as ImageIcon, Download, ExternalLink, RefreshCcw, Info } from 'lucide-react';
import { reports } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function InfographicPage() {
  const { activeProject } = useProject();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeProject]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = { date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() };
      if (activeProject) params.project_id = activeProject.id;
      
      const res = await reports.summaryData(params);
      setData(res);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 dark:text-gray-400 font-medium tracking-wide flex items-center">
          <RefreshCcw className="w-5 h-5 mr-2 animate-spin text-pink-400" />
          Đang tải Infographic...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-pink-400" />
            Infographic Generator
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Xem trước tổng quan dự án dưới dạng ảnh đồ họa sinh động.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            disabled
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-pink-600/50 text-white rounded-lg transition-all shadow-sm font-medium text-sm cursor-not-allowed relative group"
          >
            <Download className="w-4 h-4" />
            <span>Xuất file ảnh (PNG)</span>
            
            <div className="absolute -top-10 right-0 w-max bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              Tạm thời chỉ hỗ trợ xem trước (Preview)
            </div>
          </button>
        </div>
      </div>

      {/* Infographic Preview Area */}
      <div className="bg-white dark:bg-transparent p-4 sm:p-8 rounded-[2rem] border border-slate-200 dark:border-transparent shadow-sm dark:shadow-none mx-auto overflow-hidden">
        
        {/* Actual Infographic Canvas */}
        <div id="infographic-content" className="bg-gradient-to-b from-[#111827] to-[#1E1B4B] rounded-3xl shadow-2xl overflow-hidden border border-white/10 w-full min-h-[900px] relative">
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-600 to-purple-700 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
            <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-widest relative z-10">PROJECT SNAPSHOT</h2>
            <div className="inline-flex items-center gap-2 bg-black/20 px-4 py-1.5 rounded-full border border-white/20 text-white text-sm font-medium relative z-10">
              {data?.project_name || activeProject?.name || 'Toàn bộ hệ thống'} 
              <span className="text-pink-200 opacity-50">•</span>
              30 ngày qua
            </div>
          </div>

          <div className="p-10 space-y-8">
            {/* KPI Row */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                <div className="text-xs font-bold text-pink-300 uppercase tracking-wider mb-2">Tổng Mentions</div>
                <div className="text-5xl font-black text-white drop-shadow-lg">{data?.metrics?.total_mentions?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-2">Alerts</div>
                <div className="text-5xl font-black text-white drop-shadow-lg">{data?.metrics?.total_alerts?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2">Incidents</div>
                <div className="text-5xl font-black text-white drop-shadow-lg">{data?.metrics?.total_incidents?.toLocaleString() || 0}</div>
              </div>
            </div>

            {/* Sentiment & Sources row */}
            <div className="grid grid-cols-2 gap-8">
              {/* Sentiment */}
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 w-full text-center">Phân bổ Sắc thái</h3>
                <div className="relative w-48 h-48 flex items-center justify-center">
                  {/* Fake donut chart representation */}
                  <div className="absolute inset-0 rounded-full border-[16px] border-white/5"></div>
                  <div className="absolute inset-0 rounded-full border-[16px] border-emerald-500" style={{ clipPath: 'polygon(50% 50%, 100% 0, 100% 100%, 0 100%, 0 0, 50% 0)', transform: 'rotate(45deg)' }}></div>
                  <div className="text-center z-10">
                    <div className="text-3xl font-black text-white">{data?.metrics?.sentiment?.positive || 0}</div>
                    <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Tích cực</div>
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <div className="text-center">
                    <div className="text-xl font-black text-rose-400">{data?.metrics?.sentiment?.negative || 0}</div>
                    <div className="text-[10px] text-zinc-400 uppercase">Tiêu cực</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-zinc-300">{data?.metrics?.sentiment?.neutral || 0}</div>
                    <div className="text-[10px] text-zinc-500 uppercase">Trung lập</div>
                  </div>
                </div>
              </div>

              {/* Sources */}
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 text-center">Top Nguồn Thảo Luận</h3>
                <div className="space-y-4">
                  {data?.top_sources && data.top_sources.length > 0 ? (
                    data.top_sources.slice(0, 5).map((source: any, index: number) => {
                      const maxCount = Math.max(...data.top_sources.map((s: any) => s.count));
                      const widthPercent = maxCount > 0 ? (source.count / maxCount) * 100 : 0;
                      return (
                        <div key={index} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-zinc-300">
                            <span>{source.name}</span>
                            <span>{source.count}</span>
                          </div>
                          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full" 
                              style={{ width: `${widthPercent}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-zinc-500 text-sm py-8">Chưa có dữ liệu nguồn</div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Selected Mentions Mini-Cards */}
            {data?.selected_mentions && data.selected_mentions.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 text-center">Tiêu Điểm Nổi Bật</h3>
                <div className="grid grid-cols-2 gap-4">
                  {data.selected_mentions.slice(0, 4).map((m: any, i: number) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 shadow-md">
                      <div className="text-xs font-bold text-pink-300 mb-1">{m.domain || 'unknown'}</div>
                      <div className="text-sm font-bold text-white leading-snug line-clamp-2">{m.title || 'Không có tiêu đề'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-black/50 p-4 text-center border-t border-white/10 mt-auto">
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
              Generated by Nope Intelligence • {new Date(data?.generated_at || Date.now()).toLocaleDateString('vi-VN')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
