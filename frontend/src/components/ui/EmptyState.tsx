import React from 'react';
import { HelpCircle } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <HelpCircle className="w-8 h-8 text-slate-400" />,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px] rounded-2xl bg-white dark:bg-[#050A15]/40 border border-slate-200 dark:border-white/10 shadow-sm">
      <div className="w-16 h-16 mb-4 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center border border-slate-100 dark:border-white/5 shadow-sm">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5 tracking-wide">
        {title}
      </h3>
      <p className="text-xs text-slate-500 dark:text-gray-400 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
