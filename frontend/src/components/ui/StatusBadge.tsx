import React from 'react';

type StatusType = 'positive' | 'neutral' | 'negative' | 'warning' | 'info' | 'success' | 'error';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  showDot = true,
}) => {
  const configs: Record<StatusType, { bg: string; dot: string }> = {
    positive: {
      bg: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
      dot: 'bg-emerald-500',
    },
    success: {
      bg: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
      dot: 'bg-emerald-500',
    },
    neutral: {
      bg: 'bg-slate-50 text-slate-600 border-slate-150 dark:bg-white/5 dark:text-gray-300 dark:border-white/5',
      dot: 'bg-slate-400 dark:bg-gray-400',
    },
    negative: {
      bg: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
      dot: 'bg-rose-500',
    },
    error: {
      bg: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
      dot: 'bg-rose-500',
    },
    warning: {
      bg: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
      dot: 'bg-amber-500',
    },
    info: {
      bg: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
      dot: 'bg-blue-500',
    },
  };

  const current = configs[status] || configs.neutral;
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider border rounded-md ${current.bg} ${sizeClasses}`}>
      {showDot && <span className={`rounded-full shrink-0 ${dotSize} ${current.dot}`} />}
      {label}
    </span>
  );
};
