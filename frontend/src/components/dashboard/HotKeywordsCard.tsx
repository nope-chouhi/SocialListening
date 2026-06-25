import React from 'react';
import { AppCard } from '@/components/ui/AppCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import HotKeywordsWidget from './HotKeywordsWidget';

export default function HotKeywordsCard({ keywords, isLoading }: { keywords: any, isLoading: boolean }) {
  return (
    <AppCard
      header={
        <SectionHeader
          title="Hot Keywords"
        />
      }
    >
      <div className="min-h-[300px] w-full">
        <HotKeywordsWidget data={keywords} isLoading={isLoading} />
      </div>
    </AppCard>
  );
}
