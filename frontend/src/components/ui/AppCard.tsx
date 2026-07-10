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
  const baseStyles = 'group/card relative isolate min-w-0 overflow-hidden rounded-[1.35rem] transition-[border-color,box-shadow,transform,background-color] duration-200 ease-out';

  const variants = {
    default:
      'border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-white/[0.10] dark:bg-[#07111f]/78 dark:shadow-[0_22px_70px_rgba(0,0,0,0.42)] dark:backdrop-blur-xl',
    glass:
      'border border-slate-200/70 bg-white/90 shadow-[0_22px_55px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-white/[0.12] dark:bg-white/[0.055] dark:shadow-[0_28px_80px_rgba(0,0,0,0.48)]',
    borderless: 'bg-transparent shadow-none',
  };

  const hoverEffect = hoverable
    ? 'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:hover:border-cyan-200/22 dark:hover:shadow-[0_30px_90px_rgba(14,165,233,0.10)] motion-reduce:hover:translate-y-0'
    : '';

  const showEdgeLight = variant !== 'borderless';

  return (
    <div
      className={`${baseStyles} ${variants[variant]} ${hoverEffect} ${className}`}
      {...props}
    >
      {showEdgeLight && (
        <>
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-80 dark:via-cyan-100/35" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-cyan-300/0 blur-3xl transition-opacity duration-300 group-hover/card:bg-cyan-300/10" />
        </>
      )}
      {header && (
        <div className="relative border-b border-slate-100/80 bg-slate-50/70 px-5 py-4 dark:border-white/[0.07] dark:bg-white/[0.035]">
          {header}
        </div>
      )}
      <div className="relative flex-1 p-5">
        {children}
      </div>
      {footer && (
        <div className="relative border-t border-slate-100/80 bg-slate-50/70 px-5 py-3 dark:border-white/[0.07] dark:bg-black/15">
          {footer}
        </div>
      )}
    </div>
  );
};
