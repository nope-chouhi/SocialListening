'use client';

import { useState, useEffect } from 'react';
import { BarChart as BarChartIcon, TrendingUp, Search, RefreshCcw } from 'lucide-react';
import { competitors } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';

export default function CompetitorsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await competitors.summary();
      setData(res);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu đối thủ');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 dark:text-gray-400 font-medium tracking-wide flex items-center">
          <RefreshCcw className="w-5 h-5 mr-2 animate-spin text-indigo-400" />
          Đang phân tích dữ liệu đối thủ...
        </div>
      </div>
    );
  }

  if (data && !data.has_competitors) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-24 h-24 bg-gray-800/50 rounded-full flex items-center justify-center mb-6">
          <BarChartIcon className="w-12 h-12 text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide mb-2">Chưa cấu hình Từ Khóa Đối Thủ</h2>
        <p className="text-slate-500 dark:text-gray-400 max-w-md">
          Bạn cần thêm các từ khóa có loại là "Competitor" trong phần Quản lý Từ khóa để hệ thống có thể so sánh Share of Voice.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Phân Tích Đối Thủ</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">So sánh thị phần thảo luận (Share of Voice) và cảm xúc.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Share of Voice Chart */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-indigo-400" />
            Share of Voice (Thị phần thảo luận)
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.data || []}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" tick={{ fill: '#94A3B8' }} />
                <YAxis stroke="#94A3B8" tick={{ fill: '#94A3B8' }} tickFormatter={(val) => `${val}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#E2E8F0' }}
                  formatter={(value: number) => [`${value}%`, 'Share of Voice']}
                />
                <Bar 
                  dataKey="share_of_voice" 
                  radius={[6, 6, 0, 0]}
                >
                  {
                    (data?.data || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.is_brand ? '#6366F1' : '#475569'} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Comparison */}
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
            <BarChartIcon className="w-5 h-5 mr-2 text-emerald-400" />
            Cảm xúc (Sentiment)
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data?.data || []}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94A3B8" tick={{ fill: '#94A3B8' }} />
                <YAxis dataKey="name" type="category" stroke="#94A3B8" tick={{ fill: '#94A3B8' }} width={120} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#E2E8F0' }}
                />
                <Legend />
                <Bar dataKey="sentiment.positive" name="Tích cực" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="sentiment.neutral" name="Trung lập" stackId="a" fill="#64748B" />
                <Bar dataKey="sentiment.negative" name="Tiêu cực" stackId="a" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Raw Data Table */}
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xl mt-8">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Bảng dữ liệu chi tiết</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#0F172A]/50 text-xs uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-gray-800">
                <th className="px-6 py-4 font-medium">Thương hiệu</th>
                <th className="px-6 py-4 font-medium">Share of Voice</th>
                <th className="px-6 py-4 font-medium">Tổng Lượng Mentions</th>
                <th className="px-6 py-4 font-medium">Tích cực</th>
                <th className="px-6 py-4 font-medium">Tiêu cực</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {(data?.data || []).map((row: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50 dark:bg-[#0F172A]/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-3 ${row.is_brand ? 'bg-indigo-500' : 'bg-gray-500'}`}></div>
                      <span className={`font-semibold ${row.is_brand ? 'text-indigo-400' : 'text-slate-700 dark:text-gray-300'}`}>{row.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{row.share_of_voice}%</td>
                  <td className="px-6 py-4 text-slate-700 dark:text-gray-300">{row.volume.toLocaleString()}</td>
                  <td className="px-6 py-4 text-emerald-400 font-medium">{row.sentiment.positive.toLocaleString()}</td>
                  <td className="px-6 py-4 text-rose-400 font-medium">{row.sentiment.negative.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
