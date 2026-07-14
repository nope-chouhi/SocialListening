import React from 'react';
import { AppCard } from '@/components/ui/AppCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import SentimentDonutChart from './SentimentDonutChart';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SentimentOverviewCard({ sentiment, isLoading }: { sentiment: any, isLoading: boolean }) {
  const { t } = useLanguage();
  // If API returns breakdown inside 'breakdown' or directly
  const data = sentiment?.breakdown || sentiment || null;
  
  return (
    <AppCard
      header={
        <SectionHeader
          title={t('dashboard.charts.sentimentBreakdown')}
        />
      }
    >
      <div className="h-[300px] w-full">
        <SentimentDonutChart data={data} isLoading={isLoading} />
      </div>
    </AppCard>
  );
}
