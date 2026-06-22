'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface SentimentBreakdown {
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  positive_pct: number;
  negative_pct: number;
  neutral_pct: number;
}

interface MonitorSentimentChartProps {
  data: SentimentBreakdown | null;
  isLoading: boolean;
}

/**
 * MonitorSentimentChart — Enhanced donut chart with center label
 * Biểu đồ tròn sentiment với nhãn trung tâm hiển thị tổng số.
 * 
 * Color palette sử dụng HSL-tailored colors:
 * - Tích cực: Emerald gradient (#10B981 → #34D399)
 * - Trung lập: Slate (#94A3B8)
 * - Tiêu cực: Rose gradient (#F43F5E → #FB7185)
 */
export default function MonitorSentimentChart({
  data,
  isLoading,
}: MonitorSentimentChartProps) {
  if (isLoading) {
    return (
      <div className="h-72 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || (data.positive_count + data.negative_count + data.neutral_count) === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-slate-500 dark:text-gray-400">
        <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
        <p className="text-sm">Chưa có dữ liệu sắc thái</p>
      </div>
    );
  }

  const total = data.positive_count + data.negative_count + data.neutral_count;

  const chartData = [
    { name: 'Tích cực', value: data.positive_count, color: '#10B981', pct: data.positive_pct },
    { name: 'Trung lập', value: data.neutral_count, color: '#94A3B8', pct: data.neutral_pct },
    { name: 'Tiêu cực', value: data.negative_count, color: '#F43F5E', pct: data.negative_pct },
  ].filter((item) => item.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0].payload;
      return (
        <div className="bg-gray-900 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl shadow-xl border border-gray-700/50 text-sm">
          <p className="font-semibold">{entry.name}</p>
          <p className="text-slate-700 dark:text-gray-300">
            {entry.value} đề cập ({entry.pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({
    cx,
    cy,
  }: any) => {
    return (
      <g>
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-gray-800 dark:fill-gray-200 text-2xl font-bold"
          style={{ fontSize: '24px', fontWeight: 700 }}
        >
          {total.toLocaleString('vi-VN')}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-gray-500 text-xs"
          style={{ fontSize: '11px' }}
        >
          đề cập
        </text>
      </g>
    );
  };

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
            animationBegin={0}
            animationDuration={800}
            animationEasing="ease-out"
            label={false}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                className="hover:opacity-80 transition-opacity duration-200 cursor-pointer"
              />
            ))}
          </Pie>
          {/* Center label */}
          <Pie
            data={[{ value: 1 }]}
            cx="50%"
            cy="50%"
            innerRadius={0}
            outerRadius={0}
            dataKey="value"
            label={renderCustomLabel}
            isAnimationActive={false}
          >
            <Cell fill="transparent" />
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            iconSize={10}
            formatter={(value: string) => (
              <span className="text-sm text-gray-600 dark:text-slate-500 dark:text-gray-400">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
