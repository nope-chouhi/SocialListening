import React from 'react';
import { AppCard } from '@/components/ui/AppCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import HotKeywordsWidget from './HotKeywordsWidget';
import { useLanguage } from '@/contexts/LanguageContext';

export default function HotKeywordsCard({ keywords, isLoading }: { keywords: any, isLoading: boolean }) {
  const { t } = useLanguage();
  return (
    <AppCard
      variant="glass"
      hoverable
      header={
        <SectionHeader
          title={t('dashboard.panels.hotKeywords')}
        />
      }
    >
      <div className="min-h-[300px] w-full">
        <HotKeywordsWidget data={keywords} isLoading={isLoading} />
      </div>
    </AppCard>
  );
}
