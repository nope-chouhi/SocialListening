import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AppCard } from './AppCard';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  changeLabel?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  changeLabel,
  icon,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <AppCard className="animate-pulse">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-3 flex-1">
            <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-2/3" />
            <div className="h-8 bg-slate-300 dark:bg-white/20 rounded w-1/2" />
            <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-3/4" />
          </div>
          <div className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-xl" />
        </div>
      </AppCard>
    );
  }

  const changeColors = {
    positive: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20',
    negative: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20',
    neutral: 'text-slate-500 bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5',
  };

  return (
    <AppCard hoverable className="h-full">
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 tracking-wide uppercase truncate">
            {title}
          </p>
          <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
            {value}
          </p>

          {(change !== undefined || changeLabel) && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {change !== undefined && (
                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold border rounded-md ${changeColors[changeType]}`}>
                  {changeType === 'positive' && <ArrowUpRight className="w-3 h-3" />}
                  {changeType === 'negative' && <ArrowDownRight className="w-3 h-3" />}
                  {change}%
                </span>
              )}
              {changeLabel && (
                <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500">
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {icon && (
          <div className="w-10 h-10 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl flex items-center justify-center text-slate-500 dark:text-gray-400 shrink-0">
            {icon}
          </div>
        )}
      </div>
    </AppCard>
  );
};
