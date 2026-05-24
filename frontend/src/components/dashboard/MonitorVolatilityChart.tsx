'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface VolatilityDataPoint {
  date: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
}

interface MonitorVolatilityChartProps {
  data: VolatilityDataPoint[];
  isLoading: boolean;
}

/**
 * MonitorVolatilityChart — Area chart for mention volatility over time
 * Biểu đồ vùng hiển thị biến động đề cập theo ngày.
 * Sử dụng gradient fill dưới đường line để tạo hiệu ứng premium.
 */
export default function MonitorVolatilityChart({
  data,
  isLoading,
}: MonitorVolatilityChartProps) {
  if (isLoading) {
    return (
      <div className="h-72 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-gray-400">
        <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        <p className="text-sm">Chưa có dữ liệu biến động</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Format date dd/mm
      let dateStr = label;
      if (typeof label === 'string' && label.includes('-')) {
        const parts = label.split('-');
        if (parts.length === 3) dateStr = `${parts[2]}/${parts[1]}`;
      }

      return (
        <div className="bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl border border-gray-700/50 text-sm min-w-[160px]">
          <p className="font-semibold mb-2 text-gray-300">📅 {dateStr}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between items-center gap-4 py-0.5">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-300">{entry.name}</span>
              </div>
              <span className="font-medium">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradNegative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradPositive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" strokeOpacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => {
              if (typeof value === 'string' && value.includes('-')) {
                const parts = value.split('-');
                if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
              }
              return value;
            }}
          />
          <YAxis
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '16px' }}
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => (
              <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>
            )}
          />

          <Area
            type="monotone"
            name="Tổng"
            dataKey="total"
            stroke="#6366F1"
            strokeWidth={2.5}
            fill="url(#gradTotal)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: '#6366F1', fill: '#fff' }}
            animationDuration={1000}
          />
          <Area
            type="monotone"
            name="Tiêu cực"
            dataKey="negative"
            stroke="#F43F5E"
            strokeWidth={2}
            fill="url(#gradNegative)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#F43F5E', fill: '#fff' }}
            animationDuration={1200}
          />
          <Area
            type="monotone"
            name="Tích cực"
            dataKey="positive"
            stroke="#10B981"
            strokeWidth={2}
            fill="url(#gradPositive)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#10B981', fill: '#fff' }}
            animationDuration={1400}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
