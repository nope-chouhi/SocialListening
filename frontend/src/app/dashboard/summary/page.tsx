'use client';

import { PieChart, BarChart3, TrendingUp, Search, Sparkles } from 'lucide-react';

export default function AnalysisPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <PieChart className="w-6 h-6 text-indigo-400" />
            Analysis Summary
          </h1>
          <p className="text-sm text-gray-400 mt-1">Phân tích chuyên sâu về dữ liệu Social Listening của bạn.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Placeholder for AI Summary */}
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-900/40 to-purple-900/20 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-500/30 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-indigo-300">Executive Summary</h2>
          </div>
          <div className="space-y-4">
            <div className="h-4 bg-white/5 rounded w-3/4 animate-pulse"></div>
            <div className="h-4 bg-white/5 rounded w-full animate-pulse"></div>
            <div className="h-4 bg-white/5 rounded w-5/6 animate-pulse"></div>
            <div className="h-4 bg-white/5 rounded w-2/3 animate-pulse"></div>
          </div>
        </div>

        {/* Placeholder for Sentiment */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-6">
          <h2 className="text-base font-bold text-white mb-6">Sentiment Breakdown</h2>
          <div className="relative h-48 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border-[12px] border-emerald-500/80 border-r-rose-500/80 border-b-amber-500/80 animate-[spin_10s_linear_infinite]" />
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-2xl font-bold text-white">85%</span>
              <span className="text-xs text-zinc-400 uppercase tracking-widest">Positive</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-6 h-80 flex flex-col items-center justify-center text-center">
          <BarChart3 className="w-12 h-12 text-zinc-600 mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Phân bố nền tảng</h3>
          <p className="text-sm text-zinc-400">Dữ liệu chi tiết về nguồn bài viết sẽ hiển thị ở đây.</p>
          <div className="mt-6 px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-sm font-medium">
            Đang tải dữ liệu phân tích...
          </div>
        </div>
        
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-6 h-80 flex flex-col items-center justify-center text-center">
          <TrendingUp className="w-12 h-12 text-zinc-600 mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Tốc độ lan truyền</h3>
          <p className="text-sm text-zinc-400">Đồ thị tốc độ lan truyền Viral sẽ hiển thị ở đây.</p>
          <div className="mt-6 px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-sm font-medium">
            Đang tổng hợp Metrics...
          </div>
        </div>
      </div>
    </div>
  );
}
