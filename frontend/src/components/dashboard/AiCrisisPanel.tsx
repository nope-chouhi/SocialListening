'use client';

import React from 'react';
import { AlertTriangle, Shield, Zap } from 'lucide-react';

interface ActionItem {
  step: number;
  title: string;
  description: string;
  priority: string; // critical, high, medium, low
}

interface AiCrisisPanelProps {
  keyword: string;
  crisisSummary: string;
  riskLevel: string;          // Low, Medium, High
  actionItems: ActionItem[];
  negativeMentionsCount: number;
  totalMentions: number;
  isLoading: boolean;
}

/**
 * AiCrisisPanel — Elegant AI Insight panel
 * Hiển thị cảnh báo khủng hoảng AI và các bước hành động.
 * 
 * Chỉ hiển thị khi risk_level là "Medium" hoặc "High".
 * Sử dụng glassmorphism + animated gradient border cho High risk.
 */
export default function AiCrisisPanel({
  keyword,
  crisisSummary,
  riskLevel,
  actionItems,
  negativeMentionsCount,
  totalMentions,
  isLoading,
}: AiCrisisPanelProps) {
  // Chỉ hiển thị khi risk >= Medium
  if (!isLoading && riskLevel === 'Low') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-100 dark:bg-gray-700/50 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-700/50 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const isHigh = riskLevel === 'High';

  // Risk level badge config
  const riskConfig = {
    High: {
      bgGradient: 'from-red-500/10 via-red-500/5 to-orange-500/10',
      borderColor: 'border-red-500/30',
      badgeBg: 'bg-red-500',
      badgeText: 'Cao',
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      glowColor: 'shadow-red-500/20',
    },
    Medium: {
      bgGradient: 'from-amber-500/10 via-amber-500/5 to-yellow-500/10',
      borderColor: 'border-amber-500/30',
      badgeBg: 'bg-amber-500',
      badgeText: 'Trung bình',
      icon: Zap,
      iconColor: 'text-amber-500',
      glowColor: 'shadow-amber-500/20',
    },
    Low: {
      bgGradient: 'from-emerald-500/10 via-emerald-500/5 to-green-500/10',
      borderColor: 'border-emerald-500/30',
      badgeBg: 'bg-emerald-500',
      badgeText: 'Thấp',
      icon: Shield,
      iconColor: 'text-emerald-500',
      glowColor: 'shadow-emerald-500/10',
    },
  };

  const config = riskConfig[riskLevel as keyof typeof riskConfig] || riskConfig.Low;
  const RiskIcon = config.icon;

  // Priority badge colors
  const priorityColors: Record<string, string> = {
    critical: 'bg-red-500 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-amber-500 text-white',
    low: 'bg-gray-400 text-white',
  };

  return (
    <div
      className={`
        relative rounded-2xl overflow-hidden
        border ${config.borderColor}
        bg-gradient-to-br ${config.bgGradient}
        backdrop-blur-sm
        shadow-lg ${config.glowColor}
        transition-all duration-500 ease-out
      `}
      style={{
        animation: 'fadeSlideUp 0.5s ease-out',
      }}
    >
      {/* Animated gradient border for High risk */}
      {isHigh && (
        <div className="absolute inset-0 rounded-2xl border-2 border-red-500/40 animate-pulse pointer-events-none" />
      )}

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`
                p-2.5 rounded-xl
                ${isHigh ? 'bg-red-500/20 animate-pulse' : 'bg-amber-500/20'}
              `}
            >
              <RiskIcon className={`w-6 h-6 ${config.iconColor}`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                🤖 Phân Tích AI — Cảnh Báo Khủng Hoảng
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Từ khóa: <span className="font-medium">{keyword}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`
                px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                ${config.badgeBg} text-white shadow-sm
              `}
            >
              {config.badgeText}
            </span>
            <span className="text-xs text-slate-500 dark:text-gray-400">
              {negativeMentionsCount}/{totalMentions} tiêu cực
            </span>
          </div>
        </div>

        {/* Crisis Summary */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 mb-5 border border-gray-200/50 dark:border-gray-700/50">
          <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
            {crisisSummary}
          </p>
        </div>

        {/* Action Items */}
        {actionItems.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <span>📋</span> Hành Động Đề Xuất
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {actionItems.map((item) => (
                <div
                  key={item.step}
                  className="
                    bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm
                    rounded-xl p-4
                    border border-gray-200/50 dark:border-gray-700/50
                    hover:shadow-md transition-shadow duration-200
                    group
                  "
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500 text-white text-xs font-bold">
                      {item.step}
                    </span>
                    <span
                      className={`
                        px-2 py-0.5 rounded text-[10px] font-semibold uppercase
                        ${priorityColors[item.priority] || priorityColors.low}
                      `}
                    >
                      {item.priority === 'critical'
                        ? 'Khẩn cấp'
                        : item.priority === 'high'
                        ? 'Cao'
                        : item.priority === 'medium'
                        ? 'Vừa'
                        : 'Thấp'}
                    </span>
                  </div>
                  <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                    {item.title}
                  </h5>
                  <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
