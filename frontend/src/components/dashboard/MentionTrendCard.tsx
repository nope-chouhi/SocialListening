import React from 'react';
import { AppCard } from '@/components/ui/AppCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import TrendChart from './TrendChart';

export default function MentionTrendCard({ trends, isLoading }: { trends: any, isLoading: boolean }) {
  return (
    <AppCard
      header={
        <SectionHeader
          title="Mention Volume Trend"
        />
      }
    >
      <div className="h-[300px] w-full">
        <TrendChart data={trends ?? []} isLoading={isLoading} />
      </div>
    </AppCard>
  );
}
