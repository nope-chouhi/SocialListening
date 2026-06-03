'use client';

import { FileSpreadsheet, Download, Table2, Filter } from 'lucide-react';

export default function ExcelReportPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            Excel Raw Data Export
          </h1>
          <p className="text-sm text-gray-400 mt-1">Xuất toàn bộ dữ liệu gốc ra định dạng Excel / CSV để phân tích riêng.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-400" />
              Bộ lọc trích xuất
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Khoảng thời gian</label>
                <select className="w-full bg-[#050A15] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  <option>30 ngày qua</option>
                  <option>7 ngày qua</option>
                  <option>Hôm nay</option>
                  <option>Tùy chỉnh...</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Loại dữ liệu</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" defaultChecked className="rounded border-white/10 bg-black" />
                    Mentions (Bài viết & Bình luận)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" defaultChecked className="rounded border-white/10 bg-black" />
                    Thống kê nguồn (Sources)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" className="rounded border-white/10 bg-black" />
                    Danh sách Influencers
                  </label>
                </div>
              </div>

              <button className="w-full py-3 mt-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
                <Download className="w-4 h-4" />
                Tải xuống Excel (.xlsx)
              </button>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-6 h-full flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-2xl">
              <Table2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Preview Dữ liệu</h2>
            <p className="text-zinc-400 max-w-sm mb-6">
              File Excel sẽ bao gồm các cột: Thời gian, Nền tảng, Tác giả, Nội dung, Link gốc, Sentiment Score, Reach, Interactions.
            </p>
            <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-500">
              Estimated rows: ~12,450 rows
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
