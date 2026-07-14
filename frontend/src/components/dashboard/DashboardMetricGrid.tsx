import React from 'react';
import { MetricCard } from '@/components/ui/MetricCard';
import { TrendingUp, Users, MessageCircle, Activity } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DashboardMetricGrid({ metrics, isLoading }: { metrics: any, isLoading: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title={t('dashboard.metrics.totalMentions')}
        value={metrics?.total_mentions?.toLocaleString() ?? 0}
        icon={<TrendingUp />}
        isLoading={isLoading}
      />
      <MetricCard
        title={t('dashboard.metrics.reach')}
        value={metrics?.reach?.toLocaleString() ?? metrics?.total_reach?.toLocaleString() ?? 0}
        icon={<Users />}
        isLoading={isLoading}
      />
      <MetricCard
        title={t('dashboard.metrics.interactions')}
        value={metrics?.interactions?.toLocaleString() ?? metrics?.total_interactions?.toLocaleString() ?? 0}
        icon={<MessageCircle />}
        isLoading={isLoading}
      />
      <MetricCard
        title={t('dashboard.metrics.sentimentScore')}
        value={`${metrics?.sentiment_score_pct ?? metrics?.sentiment_score ?? 0}%`}
        icon={<Activity />}
        isLoading={isLoading}
      />
    </div>
  );
}
