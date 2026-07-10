import React from 'react';
import { FileText } from 'lucide-react';
import { AppCard } from '@/components/ui/AppCard';
import MentionCard from './MentionCard';
import { useLanguage } from '@/contexts/LanguageContext';

export default function RecentMentionsPanel({ 
  mentions, 
  isLoading, 
  userRole, 
  onActionComplete 
}: { 
  mentions: any[]; 
  isLoading: boolean;
  userRole: string;
  onActionComplete: () => void;
}) {
  const { t } = useLanguage();
  return (
    <AppCard
      variant="glass"
      className="flex flex-col h-[600px]"
      header={
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">{t('dashboard.panels.recentMentions')}</h2>
          <span className="text-[10px] font-black tracking-[0.1em] uppercase bg-indigo-50 border border-indigo-200 text-indigo-600 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300 px-3 py-1.5 rounded-lg shadow-sm">Top 10</span>
        </div>
      }
    >
      <div className="h-full overflow-y-auto space-y-3 custom-scrollbar pr-2 -mr-2">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex space-x-4 p-4 border border-slate-100 dark:border-white/5 rounded-lg bg-slate-50 dark:bg-white/5">
                <div className="rounded-full bg-slate-200 dark:bg-white/10 h-10 w-10"></div>
                <div className="flex-1 space-y-3 py-1">
                  <div className="h-2 bg-slate-200 dark:bg-white/10 rounded w-3/4"></div>
                  <div className="space-y-2">
                    <div className="h-2 bg-slate-200 dark:bg-white/10 rounded"></div>
                    <div className="h-2 bg-slate-200 dark:bg-white/10 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !mentions || mentions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-zinc-400 font-medium tracking-wide pb-10">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center border border-slate-100 dark:border-white/10 shadow-sm">
              <FileText className="w-8 h-8 text-slate-400 dark:text-zinc-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-zinc-300">{t('dashboard.panels.noRecentMentions')}</p>
            <p className="text-xs mt-1.5 text-slate-400 dark:text-zinc-500">{t('dashboard.panels.waitForData')}</p>
          </div>
        ) : (
          mentions.map((mention: any) => (
            <MentionCard 
              key={mention.id} 
              mention={mention} 
              userRole={userRole}
              onActionComplete={onActionComplete} 
            />
          ))
        )}
      </div>
    </AppCard>
  );
}
