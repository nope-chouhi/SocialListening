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
      <AppCard className="h-full" variant="glass">
        <div className="animate-pulse space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="h-3 rounded-full bg-slate-200 dark:bg-white/10 w-2/3" />
              <div className="h-8 rounded-xl bg-slate-300 dark:bg-white/15 w-1/2" />
            </div>
            <div className="h-11 w-11 rounded-2xl bg-slate-200 dark:bg-white/10" />
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10" />
        </div>
      </AppCard>
    );
  }

  const changeColors = {
    positive: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-300 dark:bg-emerald-400/10 dark:border-emerald-300/20',
    negative: 'text-rose-600 bg-rose-50 border-rose-100 dark:text-rose-300 dark:bg-rose-400/10 dark:border-rose-300/20',
    neutral: 'text-slate-600 bg-slate-50 border-slate-100 dark:text-slate-300 dark:bg-white/[0.06] dark:border-white/10',
  };

  return (
    <AppCard hoverable variant="glass" className="h-full">
      <div className="flex h-full flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {title}
            </p>
            <p className="truncate text-3xl font-black tracking-[-0.045em] text-slate-950 dark:text-white tabular-nums">
              {value}
            </p>
          </div>

          {icon && (
            <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 text-slate-600 shadow-inner dark:border-white/10 dark:bg-white/[0.055] dark:text-cyan-100">
              <div className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-cyan-100/40" />
              {React.isValidElement(icon)
                ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
                    className: `h-5 w-5 ${(icon.props as { className?: string }).className || ''}`.trim(),
                  })
                : icon}
            </div>
          )}
        </div>

        {(change !== undefined || changeLabel) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
            {change !== undefined && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${changeColors[changeType]}`}>
                {changeType === 'positive' && <ArrowUpRight className="h-3.5 w-3.5" />}
                {changeType === 'negative' && <ArrowDownRight className="h-3.5 w-3.5" />}
                {change}%
              </span>
            )}
            {changeLabel && (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-500">
                {changeLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </AppCard>
  );
};
