'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

type VolumePoint = {
  time: string;
  mentions: number;
};

export default function RealtimeVolumeChart({
  data,
  isLoading,
}: {
  data: VolumePoint[];
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
        Chưa có dữ liệu volume
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: 'rgba(15,23,42,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="mentions"
          name="Mentions"
          stroke="#7C3AED"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#10B981' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
