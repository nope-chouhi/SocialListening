import React from 'react';

export function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-blue-100 text-blue-800 border-blue-200',
  };
  
  const bgClass = colors[severity?.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200';
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${bgClass}`}>
      {severity?.toUpperCase() || 'UNKNOWN'}
    </span>
  );
}

export function SentimentBadge({ sentiment }: { sentiment: string }) {
  const colors: Record<string, string> = {
    positive: 'bg-green-100 text-green-800 border-green-200',
    neutral: 'bg-gray-100 text-gray-800 border-gray-200',
    negative_low: 'bg-orange-100 text-orange-800 border-orange-200',
    negative_medium: 'bg-red-100 text-red-800 border-red-200',
    negative_high: 'bg-red-200 text-red-900 border-red-300',
  };
  
  const bgClass = colors[sentiment?.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200';
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${bgClass}`}>
      {sentiment?.replace('_', ' ').toUpperCase() || 'N/A'}
    </span>
  );
}

export function RiskBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return null;
  
  let color = 'bg-blue-100 text-blue-800';
  if (score >= 80) color = 'bg-red-100 text-red-800';
  else if (score >= 60) color = 'bg-orange-100 text-orange-800';
  else if (score >= 40) color = 'bg-yellow-100 text-yellow-800';
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border border-transparent ${color}`}>
      Risk: {score}
    </span>
  );
}

export function CrisisLevelBadge({ level }: { level: number | null | undefined }) {
  if (!level) return null;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200`}>
      Crisis: L{level}
    </span>
  );
}

export function SidebarBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  
  return (
    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full ml-auto">
      {count > 99 ? '99+' : count}
    </span>
  );
}
