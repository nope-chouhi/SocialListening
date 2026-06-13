'use client';

import { useState, useEffect } from 'react';
import { Scale, BarChart3, TrendingUp, RefreshCcw, PieChart } from 'lucide-react';
import { mentions as mentionsApi } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast from 'react-hot-toast';

export default function ComparisonPage() {
  const { projects } = useProject();
  const [projectA, setProjectA] = useState<number | null>(null);
  const [projectB, setProjectB] = useState<number | null>(null);
  const [dataA, setDataA] = useState<any>(null);
  const [dataB, setDataB] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    if (!projectA || !projectB) {
      toast.error('Vui lòng chọn 2 project để so sánh');
      return;
    }
    if (projectA === projectB) {
      toast.error('Hãy chọn 2 project khác nhau');
      return;
    }
    try {
      setLoading(true);
      const [resA, resB] = await Promise.all([
        mentionsApi.summary(projectA),
        mentionsApi.summary(projectB),
      ]);
      setDataA(resA);
      setDataB(resB);
    } catch (error) {
      toast.error('Lỗi khi tải dữ liệu so sánh');
    } finally {
      setLoading(false);
    }
  };

  const nameA = projects.find(p => p.id === projectA)?.name || 'Project A';
  const nameB = projects.find(p => p.id === projectB)?.name || 'Project B';

  const renderBar = (valA: number, valB: number, label: string) => {
    const max = Math.max(valA, valB, 1);
    return (
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{label}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs w-20 text-right font-bold text-indigo-600 dark:text-indigo-400">{valA.toLocaleString()}</span>
          <div className="flex-1 flex items-center gap-1">
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-3 flex justify-end overflow-hidden">
              <div className="bg-indigo-500 rounded-full h-full transition-all" style={{ width: `${(valA / max) * 100}%` }} />
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
              <div className="bg-emerald-500 rounded-full h-full transition-all" style={{ width: `${(valB / max) * 100}%` }} />
            </div>
          </div>
          <span className="text-xs w-20 font-bold text-emerald-600 dark:text-emerald-400">{valB.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-wide flex items-center gap-2">
            <Scale className="w-6 h-6 text-emerald-500" />
            Comparison
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">So sánh mentions, sentiment giữa các projects.</p>
        </div>
      </div>

      {/* Project selector */}
      <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-6">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Chọn 2 Projects để So sánh</h2>
        {projects.length < 2 ? (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-lg text-sm">
            Tính năng này yêu cầu ít nhất 2 dự án. Hiện tại bạn mới có {projects.length} dự án.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Project A</label>
            <select
              value={projectA || ''}
              onChange={e => setProjectA(Number(e.target.value) || null)}
              className="w-full bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-4 pr-8 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              <option value="">-- Chọn Project A --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Project B</label>
            <select
              value={projectB || ''}
              onChange={e => setProjectB(Number(e.target.value) || null)}
              className="w-full bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-4 pr-8 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
            >
              <option value="">-- Chọn Project B --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCompare}
            disabled={loading || projects.length < 2}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
            So sánh
          </button>
        </div>
        )}
      </div>

      {/* Results */}
      {dataA && dataB ? (
        <>
          {/* Legend */}
          <div className="flex items-center gap-6 text-sm font-bold">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-indigo-600 dark:text-indigo-400">{nameA}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">{nameB}</span>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Tổng Mentions', a: dataA.total || 0, b: dataB.total || 0 },
              { label: 'Mentions Tích cực', a: dataA.positive || 0, b: dataB.positive || 0 },
              { label: 'Mentions Tiêu cực', a: dataA.negative || 0, b: dataB.negative || 0 },
            ].map(({ label, a, b }) => (
              <div key={label} className="bg-white dark:bg-[#050A15] rounded-xl shadow border border-gray-200 dark:border-white/10 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{label}</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{a.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{nameA}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{b.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{nameB}</p>
                  </div>
                </div>
                <div className="mt-3">
                  {renderBar(a, b, '')}
                </div>
              </div>
            ))}
          </div>

          {/* Day-by-day Trend */}
          <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-6">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              Trend theo ngày
            </h2>
            {(dataA.by_day || []).length === 0 ? (
              <p className="text-gray-400 text-sm">Không đủ dữ liệu để so sánh. Hãy chạy scan hoặc background collection.</p>
            ) : (
              <div className="space-y-3">
                {(dataA.by_day || []).map((d: any, i: number) => {
                  const dayB = (dataB.by_day || []).find((x: any) => x.date === d.date);
                  return renderBar(d.count, dayB?.count || 0, d.date);
                })}
              </div>
            )}
          </div>

          {/* Source Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { name: nameA, data: dataA.by_source_type || {}, color: 'bg-indigo-500' },
              { name: nameB, data: dataB.by_source_type || {}, color: 'bg-emerald-500' },
            ].map(({ name, data, color }) => {
              const entries = Object.entries(data).sort(([, a], [, b]) => (b as number) - (a as number));
              const total = Object.values(data).reduce((s: number, v: any) => s + v, 0) as number;
              return (
                <div key={name} className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-6">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <PieChart className="w-4 h-4" /> {name} — Nguồn
                  </h3>
                  {entries.length === 0 ? (
                    <p className="text-gray-400 text-sm">Chưa có dữ liệu</p>
                  ) : (
                    <div className="space-y-2">
                      {entries.map(([src, cnt]) => {
                        const pct = total > 0 ? Math.round(((cnt as number) / total) * 100) : 0;
                        return (
                          <div key={src} className="flex items-center gap-2 text-sm">
                            <span className="w-16 text-gray-600 dark:text-gray-400 capitalize">{src}</span>
                            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                              <div className={`${color} h-full rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-10 text-right font-bold text-gray-900 dark:text-white">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : !loading && (
        <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-12 text-center">
          <Scale className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Chọn 2 projects và nhấn "So sánh" để xem kết quả.
          </p>
        </div>
      )}
    </div>
  );
}
