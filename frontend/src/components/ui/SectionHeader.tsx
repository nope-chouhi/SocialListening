import React from 'react';

interface SectionHeaderProps {
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  badge,
  actions,
  className = '',
}) => {
  return (
    <div className={`flex justify-between items-center pb-3 mb-4 border-b border-slate-100 dark:border-white/5 ${className}`}>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
          {title}
        </h2>
        {badge}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};
