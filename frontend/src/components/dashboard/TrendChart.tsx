import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TrendChartProps {
  data: any[];
  isLoading: boolean;
}

export default function TrendChart({ data, isLoading }: TrendChartProps) {
  if (isLoading) {
    return <div className="h-72 flex items-center justify-center text-gray-500 font-medium">Đang tải biểu đồ...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="h-72 flex items-center justify-center text-gray-500 font-medium">Chưa có dữ liệu xu hướng</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
          <XAxis 
            dataKey="date" 
            tick={{ fill: '#9CA3AF', fontSize: 12 }} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => {
              // Format if it's a date string like YYYY-MM-DD
              if (typeof value === 'string' && value.includes('-')) {
                const parts = value.split('-');
                if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
              }
              return value;
            }}
          />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ 
              borderRadius: '12px', 
              border: '1px solid #374151', 
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
              backgroundColor: '#1E293B',
              color: '#F3F4F6'
            }}
            itemStyle={{ color: '#E5E7EB' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px', color: '#9CA3AF' }} />
          
          <Line type="monotone" name="Tổng Mentions" dataKey="total_mentions" stroke="#6366F1" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#818CF8' }} />
          <Line type="monotone" name="Tiêu Cực" dataKey="negative_mentions" stroke="#F43F5E" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
          <Line type="monotone" name="Cảnh Báo" dataKey="alerts" stroke="#F59E0B" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
          <Line type="monotone" name="Sự Cố" dataKey="incidents" stroke="#A855F7" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
