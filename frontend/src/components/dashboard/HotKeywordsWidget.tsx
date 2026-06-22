import React from 'react';
import { Flame } from 'lucide-react';

interface HotKeyword {
  keyword: string;
  count: number;
  negative_count: number;
  risk_score_avg: number;
}

export default function HotKeywordsWidget({ data, isLoading }: { data: HotKeyword[] | null; isLoading: boolean }) {
  if (isLoading) {
    return <div className="h-48 flex items-center justify-center text-slate-500 dark:text-gray-400 font-medium tracking-wide">Đang tải từ khóa...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-500 dark:text-gray-400 font-medium tracking-wide">Chưa có từ khóa nổi bật</div>;
  }

  return (
    <div className="space-y-4">
      {data.slice(0, 5).map((kw, i) => (
        <div key={kw.keyword} className="flex items-center justify-between p-3.5 bg-white dark:bg-[#1E293B] hover:bg-[#283548] rounded-xl border border-slate-200 dark:border-gray-800 transition-colors shadow-sm">
          <div className="flex items-center space-x-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${i < 3 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-white dark:bg-[#111827] text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-gray-700'}`}>
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white tracking-wide">{kw.keyword}</p>
              <div className="flex space-x-2 mt-1 text-xs font-medium">
                <span className="text-slate-500 dark:text-gray-400">{kw.count} mentions</span>
                {kw.negative_count > 0 && (
                  <span className="text-rose-400">({kw.negative_count} tiêu cực)</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className={`px-2.5 py-1 text-xs rounded-md font-medium tracking-wide shadow-sm ${
              kw.risk_score_avg >= 70 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
              kw.risk_score_avg >= 40 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
              'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
            }`}>
              Rủi ro: {kw.risk_score_avg.toFixed(1)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
