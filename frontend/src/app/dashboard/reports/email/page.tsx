'use client';

import { Mail, Clock, Send, CheckCircle2 } from 'lucide-react';

export default function EmailReportsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
          <Mail className="w-6 h-6 text-indigo-400" />
          Email Reports Setup
        </h1>
        <p className="text-sm text-gray-400 mt-1">Lên lịch nhận báo cáo tự động qua Email định kỳ.</p>
      </div>

      <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-8">
        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-white/10">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center">
            <Send className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Tự động hóa báo cáo</h2>
            <p className="text-sm text-zinc-400 mt-1">Hệ thống sẽ tổng hợp số liệu và gửi thẳng vào hộp thư của bạn.</p>
          </div>
        </div>

        <form className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-bold text-zinc-300">Tần suất gửi</label>
              <select className="w-full bg-[#050A15] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500">
                <option>Hàng ngày (8:00 AM)</option>
                <option>Hàng tuần (Thứ 2)</option>
                <option>Hàng tháng (Ngày 1)</option>
              </select>
            </div>
            
            <div className="space-y-3">
              <label className="text-sm font-bold text-zinc-300">Loại báo cáo</label>
              <select className="w-full bg-[#050A15] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500">
                <option>Executive Summary (Tóm tắt nhanh)</option>
                <option>Full Analytics (Chi tiết)</option>
                <option>Crisis Alert (Chỉ cảnh báo sự cố)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-zinc-300">Email nhận báo cáo (Cách nhau bằng dấu phẩy)</label>
            <input 
              type="text" 
              placeholder="admin@nope.com, marketing@nope.com" 
              className="w-full bg-[#050A15] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-6 flex justify-end gap-3">
            <button type="button" className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors">
              Hủy
            </button>
            <button type="button" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Lưu cấu hình
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
