import React from 'react';

interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'borderless';
  hoverable?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  variant = 'default',
  hoverable = false,
  header,
  footer,
  className = '',
  ...props
}) => {
  const baseStyles = 'rounded-2xl transition-all duration-300 overflow-hidden';

  const variants = {
    default: 'bg-white dark:bg-[#050A15]/40 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-xl',
    glass: 'bg-white/90 dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-2xl',
    borderless: 'bg-transparent',
  };

  const hoverEffect = hoverable
    ? 'hover:border-slate-300 dark:hover:border-white/20 hover:shadow-md dark:hover:shadow-indigo-500/5'
    : '';

  return (
    <div
      className={`${baseStyles} ${variants[variant]} ${hoverEffect} ${className}`}
      {...props}
    >
      {header && (
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
          {header}
        </div>
      )}
      <div className="p-5 flex-1">
        {children}
      </div>
      {footer && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/10">
          {footer}
        </div>
      )}
    </div>
  );
};
