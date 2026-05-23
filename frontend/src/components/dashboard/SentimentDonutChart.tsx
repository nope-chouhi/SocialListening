import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

export default function SentimentDonutChart({ data, isLoading }: { data: SentimentData | null; isLoading: boolean }) {
  if (isLoading) {
    return <div className="h-64 flex items-center justify-center text-gray-500">Đang tải...</div>;
  }

  if (!data || data.total === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-500">Chưa có dữ liệu sắc thái</div>;
  }

  const chartData = [
    { name: 'Tích cực', value: data.positive, color: '#10B981' }, // emerald-500
    { name: 'Trung lập', value: data.neutral, color: '#9CA3AF' }, // gray-400
    { name: 'Tiêu cực', value: data.negative, color: '#EF4444' }, // red-500
  ].filter(item => item.value > 0);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [`${value} mention${value > 1 ? 's' : ''}`, '']}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
