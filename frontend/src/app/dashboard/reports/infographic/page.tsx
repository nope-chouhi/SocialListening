'use client';

import { Image as ImageIcon, Download, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function InfographicPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-pink-400" />
          Infographic Generator
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          Xuất báo cáo dạng ảnh/infographic.
        </p>
      </div>

      <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-12 text-center">
        <div className="w-20 h-20 bg-pink-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-pink-500/20">
          <ImageIcon className="w-10 h-10 text-pink-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Coming Soon</h2>
        <p className="text-slate-500 dark:text-gray-400 max-w-md mx-auto mb-8 text-sm leading-relaxed">
          Tính năng Infographic Generator đang được phát triển. Bạn có thể sử dụng các tính năng xuất dữ liệu hiện có:
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Xuất PDF Report
          </Link>
          <Link
            href="/dashboard/reports/excel"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Xuất Excel CSV
          </Link>
        </div>
        <div className="mt-8 inline-block px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-400 font-medium">
          ⏳ Infographic Generator — Coming soon
        </div>
      </div>
    </div>
  );
}
