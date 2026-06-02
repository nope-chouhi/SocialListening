'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

type Point = {
  time: string;
  reach: number;
  interactions: number;
};

export default function ReachInteractionsChart({
  data,
  isLoading,
}: {
  data: Point[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="h-[220px] flex items-center justify-center text-zinc-500 text-sm">
        Đang tải...
      </div>
    );
  }

  const chartData = (data || []).map((d) => ({
    ...d,
    label: new Date(d.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  }));

  if (!chartData.length) {
    return (
      <div className="h-[220px] flex items-center justify-center text-zinc-500 text-sm">
        Chưa có dữ liệu reach / tương tác
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            background: 'rgba(15,23,42,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
          }}
        />
        <Legend />
        <Bar dataKey="reach" name="Reach" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
        <Bar dataKey="interactions" name="Tương tác" fill="#10B981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
