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
  const baseStyles =
    'group/card relative isolate min-w-0 overflow-hidden rounded-xl transition-[border-color,box-shadow,transform] duration-150 ease-out';

  const variants = {
    default:
      'border border-border bg-card text-card-foreground shadow-md',
    glass:
      'glass-panel text-foreground',
    borderless:
      'bg-transparent shadow-none border-0',
  };

  const hoverEffect = hoverable
    ? 'hover:-translate-y-0.5 hover:shadow-lg motion-reduce:hover:translate-y-0'
    : '';

  return (
    <div
      className={`${baseStyles} ${variants[variant]} ${hoverEffect} ${className}`}
      {...props}
    >
      {header && (
        <div className="border-b border-border bg-surface-muted/50 px-5 py-4">
          {header}
        </div>
      )}
      <div className="p-5">
        {children}
      </div>
      {footer && (
        <div className="border-t border-border bg-surface-muted/50 px-5 py-3">
          {footer}
        </div>
      )}
    </div>
  );
};
