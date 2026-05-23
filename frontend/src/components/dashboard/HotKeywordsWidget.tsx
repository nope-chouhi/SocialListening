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
    return <div className="h-48 flex items-center justify-center text-gray-500">Đang tải từ khóa...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-500">Chưa có từ khóa nổi bật</div>;
  }

  return (
    <div className="space-y-4">
      {data.slice(0, 5).map((kw, i) => (
        <div key={kw.keyword} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${i < 3 ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-600'}`}>
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{kw.keyword}</p>
              <div className="flex space-x-2 mt-1 text-xs">
                <span className="text-gray-500">{kw.count} mentions</span>
                {kw.negative_count > 0 && (
                  <span className="text-red-500">({kw.negative_count} tiêu cực)</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
              kw.risk_score_avg >= 70 ? 'bg-red-100 text-red-800' :
              kw.risk_score_avg >= 40 ? 'bg-orange-100 text-orange-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              Rủi ro: {kw.risk_score_avg.toFixed(1)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
