'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MonitorMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  gradient: string;       // Tailwind gradient classes
  iconBg: string;         // Icon background color
  textColor?: string;     // Value text color
  pulse?: boolean;        // Pulse animation for critical metrics
}

/**
 * MonitorMetricCard — Premium KPI card component
 * Thẻ hiển thị chỉ số quan trọng với gradient background và micro-animations.
 * 
 * Sử dụng:
 *   <MonitorMetricCard
 *     title="Tổng Đề Cập"
 *     value={1234}
 *     icon={MessageCircle}
 *     gradient="from-blue-500 to-indigo-600"
 *     iconBg="bg-blue-400/30"
 *   />
 */
export default function MonitorMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  iconBg,
  textColor = 'text-white',
  pulse = false,
}: MonitorMetricCardProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl p-6
        bg-gradient-to-br ${gradient}
        shadow-lg hover:shadow-xl
        transform hover:scale-[1.02] transition-all duration-300
        group
      `}
    >
      {/* Background decorative circles */}
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
      <div className="absolute -bottom-2 -left-2 w-16 h-16 bg-white/5 rounded-full blur-lg" />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-900 dark:text-white/80 mb-1">{title}</p>
          <p
            className={`text-3xl font-bold ${textColor} tracking-tight ${
              pulse ? 'animate-pulse' : ''
            }`}
          >
            {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-900 dark:text-white/60 mt-1">{subtitle}</p>
          )}
        </div>

        <div
          className={`
            ${iconBg} rounded-xl p-3
            group-hover:scale-110 transition-transform duration-300
          `}
        >
          <Icon className="w-6 h-6 text-slate-900 dark:text-white" />
        </div>
      </div>
    </div>
  );
}
