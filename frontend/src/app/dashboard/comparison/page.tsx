'use client';

import { Scale, Users, TrendingUp, Search } from 'lucide-react';

export default function ComparisonPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <Scale className="w-6 h-6 text-emerald-400" />
            Comparison
          </h1>
          <p className="text-sm text-gray-400 mt-1">So sánh từ khóa, đối thủ cạnh tranh hoặc các chiến dịch khác nhau.</p>
        </div>
        <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-emerald-500/20">
          + Thêm đối tượng so sánh
        </button>
      </div>

      <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-12 text-center flex flex-col items-center justify-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
          <Scale className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Tính năng Comparison đang được hoàn thiện</h2>
        <p className="text-zinc-400 max-w-lg mx-auto mb-8 leading-relaxed">
          Sắp tới bạn sẽ có thể tạo bảng so sánh SOV (Share of Voice), phân tích sắc thái đa đối thủ và biểu đồ rada so sánh chất lượng tương tác trực quan.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full text-left">
          <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
            <Users className="w-5 h-5 text-indigo-400 mb-3" />
            <h3 className="font-bold text-white mb-1">So sánh Đối thủ</h3>
            <p className="text-xs text-zinc-500">Đánh giá hiệu suất truyền thông giữa thương hiệu của bạn và đối thủ.</p>
          </div>
          <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
            <Search className="w-5 h-5 text-amber-400 mb-3" />
            <h3 className="font-bold text-white mb-1">So sánh Từ khóa</h3>
            <p className="text-xs text-zinc-500">Theo dõi trend và sức hút của nhiều từ khóa cùng một lúc.</p>
          </div>
          <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
            <TrendingUp className="w-5 h-5 text-rose-400 mb-3" />
            <h3 className="font-bold text-white mb-1">So sánh Chiến dịch</h3>
            <p className="text-xs text-zinc-500">Phân tích hiệu quả các chiến dịch Marketing qua các thời kỳ.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
