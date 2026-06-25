'use client';

import { useState, useEffect } from 'react';
import { PieChart, BarChart3, TrendingUp, TrendingDown, Sparkles, RefreshCcw, Globe } from 'lucide-react';
import { mentions as mentionsApi } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast from 'react-hot-toast';

export default function AnalysisPage() {
  const { activeProject } = useProject();
  const [summary, setSummary] = useState<any>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [activeProject?.id]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const data = await mentionsApi.summary(activeProject?.id);
      setSummary(data);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu phân tích');
    } finally {
      setLoading(false);
    }
  };

  const handleAiSummary = async () => {
    if (!activeProject?.id) {
      toast.error('Vui lòng chọn project trước');
      return;
    }
    if (!summary || summary.total === 0) {
      toast.error('Không có mentions để tóm tắt');
      return;
    }
    try {
      setAiLoading(true);
      const res = await mentionsApi.summarize({ project_id: activeProject.id });
      setAiText(res.summary || res.result || 'Không có kết quả');
    } catch (error: any) {
      console.error('[API Error] POST /api/mentions/summarize ->', error?.response?.status || error.message);
      const detail = error?.response?.data?.detail || '';
      toast.error(detail || 'Không tạo được tóm tắt AI lúc này');
    } finally {
      setAiLoading(false);
    }
  };

  const total = summary?.total || 0;
  const positive = summary?.positive || 0;
  const negative = summary?.negative || 0;
  const neutral = summary?.neutral || 0;
  const byDay: Array<{ date: string; count: number }> = summary?.by_day || [];
  const bySource: Record<string, number> = summary?.by_source_type || {};

  const sentimentPct = total > 0 ? {
    pos: Math.round((positive / total) * 100),
    neg: Math.round((negative / total) * 100),
    neu: Math.round((neutral / total) * 100),
  } : { pos: 0, neg: 0, neu: 0 };

  const maxDayCount = Math.max(...byDay.map(d => d.count), 1);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
            <PieChart className="w-6 h-6 text-indigo-500" />
            Analysis Summary
          </h1>
          <p className="text-sm text-gray-600 dark:text-slate-500 dark:text-gray-400 mt-1">
            Phân tích chuyên sâu về dữ liệu Social Listening
            {activeProject ? ` — ${activeProject.name}` : ''}.
          </p>
        </div>
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <RefreshCcw className="w-5 h-5 mr-2 animate-spin" /> Đang tải dữ liệu phân tích...
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Tổng Mentions', value: total, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-500/10', icon: BarChart3 },
              { label: 'Tích cực', value: positive, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', icon: TrendingUp },
              { label: 'Tiêu cực', value: negative, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-500/10', icon: TrendingDown },
              { label: 'Trung lập', value: neutral, color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-500/10', icon: BarChart3 },
            ].map((kpi) => (
              <div key={kpi.label} className={`${kpi.bg} rounded-xl p-4 border border-gray-200 dark:border-white/10`}>
                <div className="flex items-center gap-2 mb-2">
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  <span className="text-xs font-bold text-gray-600 dark:text-slate-500 dark:text-gray-400 uppercase tracking-wider">{kpi.label}</span>
                </div>
                <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AI Summary */}
            <div className="lg:col-span-2 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/40 dark:to-purple-900/20 rounded-2xl shadow border border-indigo-200 dark:border-indigo-500/30 p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h2 className="text-lg font-bold text-indigo-700 dark:text-indigo-300">AI Executive Summary</h2>
                </div>
                <button
                  onClick={handleAiSummary}
                  disabled={aiLoading || total === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors"
                >
                  {aiLoading ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {aiLoading ? 'Đang tạo...' : 'Tạo AI Summary'}
                </button>
              </div>
              {aiText ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-gray-300 whitespace-pre-wrap">
                  {aiText}
                </div>
              ) : total === 0 ? (
                <p className="text-gray-600 dark:text-slate-500 dark:text-gray-400 text-sm">Chưa có mentions để tóm tắt. Hãy chạy scan để thu thập dữ liệu trước.</p>
              ) : (
                <p className="text-gray-600 dark:text-slate-500 dark:text-gray-400 text-sm">Nhấn "Tạo AI Summary" để phân tích {total} mentions bằng AI.</p>
              )}
            </div>

            {/* Sentiment Donut */}
            <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 p-6">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Sentiment Breakdown</h2>
              {total === 0 ? (
                <p className="text-slate-500 dark:text-gray-400 text-sm text-center py-8">Chưa có dữ liệu</p>
              ) : (
                <>
                  <div className="relative h-40 flex items-center justify-center mb-4">
                    <svg viewBox="0 0 36 36" className="w-40 h-40 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981"
                        strokeWidth="3"
                        strokeDasharray={`${sentimentPct.pos} ${100 - sentimentPct.pos}`}
                        strokeDashoffset="0"
                      />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f43f5e"
                        strokeWidth="3"
                        strokeDasharray={`${sentimentPct.neg} ${100 - sentimentPct.neg}`}
                        strokeDashoffset={`${-(sentimentPct.pos)}`}
                      />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#94a3b8"
                        strokeWidth="3"
                        strokeDasharray={`${sentimentPct.neu} ${100 - sentimentPct.neu}`}
                        strokeDashoffset={`${-(sentimentPct.pos + sentimentPct.neg)}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">{sentimentPct.pos}%</span>
                      <span className="text-xs text-gray-500 uppercase">Positive</span>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: 'Tích cực', pct: sentimentPct.pos, count: positive, color: 'bg-emerald-500' },
                      { label: 'Tiêu cực', pct: sentimentPct.neg, count: negative, color: 'bg-rose-500' },
                      { label: 'Trung lập', pct: sentimentPct.neu, count: neutral, color: 'bg-slate-400' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                        <span className="text-gray-600 dark:text-slate-500 dark:text-gray-400 flex-1">{s.label}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{s.count.toLocaleString()}</span>
                        <span className="text-slate-500 dark:text-gray-400 w-10 text-right">{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 7-day Trend */}
            <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 p-6">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Trend 7 ngày qua
              </h2>
              {byDay.length === 0 ? (
                <p className="text-slate-500 dark:text-gray-400 text-sm text-center py-8">Chưa có dữ liệu</p>
              ) : (
                <div className="flex items-end gap-2 h-40">
                  {byDay.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-indigo-500 rounded-t-md opacity-80 hover:opacity-100 transition-opacity"
                        style={{ height: `${Math.round((d.count / maxDayCount) * 130)}px`, minHeight: '4px' }}
                        title={`${d.date}: ${d.count} mentions`}
                      />
                      <span className="text-[9px] text-slate-500 dark:text-gray-400 truncate">{typeof d.date === 'string' ? d.date.slice(5) : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sources */}
            <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 p-6">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-500" />
                Phân bố nguồn
              </h2>
              {Object.keys(bySource).length === 0 ? (
                <p className="text-slate-500 dark:text-gray-400 text-sm text-center py-8">Chưa có dữ liệu nguồn</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(bySource || {})
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 8)
                    .map(([source, count]) => {
                      const pct = total > 0 ? Math.round(((count as number) / total) * 100) : 0;
                      return (
                        <div key={source}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-slate-700 dark:text-gray-300 capitalize">{source}</span>
                            <span className="font-bold text-slate-900 dark:text-white">{(count as number).toLocaleString()} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
