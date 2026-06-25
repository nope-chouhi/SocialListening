'use client';

import { useState, useEffect } from 'react';
import { Users, TrendingUp, Search, RefreshCcw, Award, Star, Activity } from 'lucide-react';
import { influencers } from '@/lib/api';
import toast from 'react-hot-toast';

export default function InfluencersPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await influencers.leaderboard();
      setData(res);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu influencers');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = data?.items?.filter((i: any) => i.author.toLowerCase().includes(search.toLowerCase())) || [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 dark:text-gray-400 font-medium tracking-wide flex items-center">
          <RefreshCcw className="w-5 h-5 mr-2 animate-spin text-indigo-400" />
          Đang tổng hợp dữ liệu Influencers...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Influencers Leaderboard</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Danh sách những người có sức ảnh hưởng và lượng thảo luận cao nhất.</p>
        </div>
      </div>

      {/* Top 3 Cards */}
      {filteredItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {Array.isArray(filteredItems) && filteredItems.slice(0, 3).map((inf: any, idx: number) => (
            <div key={idx} className="bg-gradient-to-br from-slate-50 dark:from-[#1E293B] to-slate-100 dark:to-[#0F172A] border border-slate-200 dark:border-gray-800 hover:border-purple-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden group transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                {idx === 0 ? <TrophyIcon color="#F59E0B" /> : idx === 1 ? <TrophyIcon color="#94A3B8" /> : <TrophyIcon color="#B45309" />}
              </div>
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center space-x-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2 ${
                    idx === 0 ? 'bg-amber-500/20 text-amber-500 border-amber-500/50' : 
                    idx === 1 ? 'bg-slate-300/20 text-slate-700 dark:text-slate-700 dark:text-slate-300 border-slate-300/50' : 
                    'bg-orange-700/20 text-orange-500 border-orange-700/50'
                  }`}>
                    #{idx + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">{inf.author}</h3>
                    <div className="flex items-center text-xs text-slate-500 dark:text-gray-400 mt-1">
                      <Star className="w-3 h-3 text-yellow-500 mr-1" />
                      Điểm ảnh hưởng: <span className="font-bold text-slate-900 dark:text-white ml-1">{inf.influence_score}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 relative z-10">
                <div className="bg-slate-50 dark:bg-[#0B1220]/50 rounded-xl p-3 border border-gray-800/50">
                  <div className="text-xs text-gray-500 mb-1">Mentions</div>
                  <div className="font-bold text-slate-900 dark:text-white">{inf.mentions_count.toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 dark:bg-[#0B1220]/50 rounded-xl p-3 border border-gray-800/50">
                  <div className="text-xs text-gray-500 mb-1">Reach (Est)</div>
                  <div className="font-bold text-indigo-400">{inf.reach.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[600px]">
        <div className="p-4 border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1E293B]/50 backdrop-blur-md flex items-center justify-between shrink-0">
          <h3 className="font-bold text-slate-900 dark:text-white">Toàn bộ Influencers ({filteredItems.length})</h3>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm tác giả..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 w-64 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 dark:bg-[#0F172A] z-10">
              <tr className="text-xs uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-gray-800">
                <th className="px-6 py-4 font-medium">Hạng</th>
                <th className="px-6 py-4 font-medium">Tác giả / Kênh</th>
                <th className="px-6 py-4 font-medium">Nền tảng</th>
                <th className="px-6 py-4 font-medium">Lượng Mentions</th>
                <th className="px-6 py-4 font-medium">Reach Ước tính</th>
                <th className="px-6 py-4 font-medium text-right">Influence Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredItems.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50 dark:bg-[#0F172A]/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`text-sm font-bold ${i < 3 ? 'text-amber-500' : 'text-gray-500'}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900 dark:text-white">{row.author}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-gray-400 text-sm">
                    {row.platform}
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-gray-300 font-medium">
                    {row.mentions_count.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-indigo-400 font-medium">
                    {row.reach.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-sm">
                      <Activity className="w-3 h-3 mr-1" />
                      {row.influence_score}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Không tìm thấy dữ liệu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TrophyIcon({ color }: { color: string }) {
  return (
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
      <path d="M4 22h16"></path>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
    </svg>
  );
}
