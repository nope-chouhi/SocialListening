import React from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface LoadingStateProps {
  message?: string;
  variant?: 'spinner' | 'skeleton';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message,
  variant = 'spinner',
}) => {
  const { t } = useLanguage();
  const displayMessage = message || t('common.loadingData');

  if (variant === 'skeleton') {
    return (
      <div className="space-y-4 w-full p-2">
        <div className="animate-pulse flex space-x-4 p-5 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 shadow-sm">
          <div className="rounded-xl bg-slate-200 dark:bg-white/10 h-12 w-12 shrink-0" />
          <div className="flex-1 space-y-3 py-1">
            <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-1/3" />
            <div className="space-y-2">
              <div className="h-2 bg-slate-200 dark:bg-white/10 rounded w-full" />
              <div className="h-2 bg-slate-200 dark:bg-white/10 rounded w-5/6" />
            </div>
          </div>
        </div>
        <div className="animate-pulse flex space-x-4 p-5 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 shadow-sm">
          <div className="rounded-xl bg-slate-200 dark:bg-white/10 h-12 w-12 shrink-0" />
          <div className="flex-1 space-y-3 py-1">
            <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-1/4" />
            <div className="space-y-2">
              <div className="h-2 bg-slate-200 dark:bg-white/10 rounded w-11/12" />
              <div className="h-2 bg-slate-200 dark:bg-white/10 rounded w-4/5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[250px] w-full">
      <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
      <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 tracking-wide uppercase">
        {displayMessage}
      </p>
    </div>
  );
};
