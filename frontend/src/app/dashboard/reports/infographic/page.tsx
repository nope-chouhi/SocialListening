'use client';

import { Image as ImageIcon, Download, Share2, Sparkles } from 'lucide-react';

export default function InfographicPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-pink-400" />
            Infographic Generator
          </h1>
          <p className="text-sm text-gray-400 mt-1">AI tự động thiết kế báo cáo dạng ảnh (Infographic) đẹp mắt để chia sẻ cho sếp và đối tác.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Chia sẻ
          </button>
          <button className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-pink-500/20">
            <Download className="w-4 h-4" /> Tải xuống PNG
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h3 className="text-sm font-bold text-white mb-4">Giao diện (Theme)</h3>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button className="h-16 rounded-lg bg-zinc-900 border-2 border-pink-500 relative flex items-center justify-center">
                <span className="text-xs font-bold text-white">Dark Mode</span>
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-pink-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">✓</div>
              </button>
              <button className="h-16 rounded-lg bg-zinc-100 border-2 border-transparent hover:border-zinc-300 relative flex items-center justify-center">
                <span className="text-xs font-bold text-zinc-900">Light Mode</span>
              </button>
            </div>

            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              Tùy chọn hiển thị AI
            </h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 text-sm text-zinc-300 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-white/10 bg-black accent-pink-500" />
                Hiển thị Điểm Sentiment
              </label>
              <label className="flex items-center gap-3 text-sm text-zinc-300 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-white/10 bg-black accent-pink-500" />
                Đám mây từ khóa (Word Cloud)
              </label>
              <label className="flex items-center gap-3 text-sm text-zinc-300 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-white/10 bg-black accent-pink-500" />
                Top 3 bài viết nổi bật nhất
              </label>
            </div>
            
            <button className="w-full mt-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              Tạo lại Infographic (AI)
            </button>
          </div>
        </div>

        <div className="md:col-span-2">
          {/* Mock Infographic Preview */}
          <div className="bg-[#111827] rounded-xl shadow-2xl border border-white/10 overflow-hidden relative min-h-[600px] flex flex-col items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-pink-500/10 pointer-events-none" />
            
            <ImageIcon className="w-16 h-16 text-pink-500/50 mb-4 animate-pulse" />
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-2">
              SOCIAL LISTENING REPORT
            </h2>
            <p className="text-zinc-500 text-sm mb-8">June 2026 Overview</p>
            
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm px-6">
              <div className="bg-white/5 rounded-lg p-4 text-center border border-white/5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Mentions</p>
                <p className="text-2xl font-bold text-white">12,450</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center border border-white/5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Sentiment</p>
                <p className="text-2xl font-bold text-emerald-400">85%</p>
              </div>
            </div>
            
            <p className="text-xs text-zinc-600 mt-12">(Bản xem trước mẫu đồ họa)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
