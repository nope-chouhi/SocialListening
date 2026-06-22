import React from 'react';

export function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    high: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    low: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  };
  
  const bgClass = colors[severity?.toLowerCase()] || 'bg-white dark:bg-[#1E293B] text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-700';
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide shadow-sm ${bgClass}`}>
      {severity ? severity.toUpperCase() : 'CHƯA XÁC ĐỊNH'}
    </span>
  );
}

export function SentimentBadge({ sentiment }: { sentiment: string }) {
  const colors: Record<string, string> = {
    positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    neutral: 'bg-white dark:bg-[#1E293B] text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-700',
    negative: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  
  const bgClass = colors[sentiment?.toLowerCase()] || 'bg-white dark:bg-[#1E293B] text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-700';
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide shadow-sm ${bgClass}`}>
      {sentiment ? sentiment.replace('_', ' ').toUpperCase() : 'CHƯA PHÂN TÍCH'}
    </span>
  );
}

export function RiskBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return null;
  
  let color = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
  if (score >= 80) color = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  else if (score >= 60) color = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  else if (score >= 40) color = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide shadow-sm ${color}`}>
      Risk: {score}
    </span>
  );
}

export function CrisisLevelBadge({ level }: { level: number | null | undefined }) {
  if (!level) return null;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 tracking-wide shadow-sm`}>
      Crisis: L{level}
    </span>
  );
}

export function SidebarBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  
  return (
    <span className="inline-flex items-center justify-center px-2 py-1 text-[10px] font-bold leading-none text-white bg-rose-500 shadow-sm shadow-rose-500/20 rounded-full ml-auto tracking-wide">
      {count > 99 ? '99+' : count}
    </span>
  );
}
