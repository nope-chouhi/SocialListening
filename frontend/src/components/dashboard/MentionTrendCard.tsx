import React from 'react';
import { AppCard } from '@/components/ui/AppCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import TrendChart from './TrendChart';
import { useLanguage } from '@/contexts/LanguageContext';

export default function MentionTrendCard({ trends, isLoading }: { trends: any, isLoading: boolean }) {
  const { t } = useLanguage();
  return (
    <AppCard
      variant="glass"
      hoverable
      header={
        <SectionHeader
          title={t('dashboard.charts.mentionVolume')}
        />
      }
    >
      <div className="h-[300px] w-full">
        <TrendChart data={trends ?? []} isLoading={isLoading} />
      </div>
    </AppCard>
  );
}
