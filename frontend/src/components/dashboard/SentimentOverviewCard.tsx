import React from 'react';
import { AppCard } from '@/components/ui/AppCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import SentimentDonutChart from './SentimentDonutChart';

export default function SentimentOverviewCard({ sentiment, isLoading }: { sentiment: any, isLoading: boolean }) {
  // If API returns breakdown inside 'breakdown' or directly
  const data = sentiment?.breakdown || sentiment || null;
  
  return (
    <AppCard
      header={
        <SectionHeader
          title="Sentiment Distribution"
        />
      }
    >
      <div className="h-[300px] w-full">
        <SentimentDonutChart data={data} isLoading={isLoading} />
      </div>
    </AppCard>
  );
}
