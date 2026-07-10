import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
}) => {
  return (
    <div className="relative isolate mb-8 min-w-0 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-4 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/[0.10] dark:bg-[#07111f]/72 dark:shadow-[0_26px_80px_rgba(0,0,0,0.42)] sm:p-6">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/90 to-transparent dark:via-cyan-100/35" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-400/10" />
      <div className="pointer-events-none absolute -bottom-24 left-8 h-40 w-40 rounded-full bg-indigo-300/15 blur-3xl dark:bg-indigo-500/10" />

      <div className="relative flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="min-w-0 break-words text-2xl font-black tracking-[-0.035em] text-slate-950 dark:text-white sm:text-3xl">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
