import React from 'react';
import { MetricCard } from '@/components/ui/MetricCard';
import { TrendingUp, Users, MessageCircle, Activity } from 'lucide-react';

export default function DashboardMetricGrid({ metrics, isLoading }: { metrics: any, isLoading: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Mentions"
        value={metrics?.total_mentions?.toLocaleString() ?? 0}
        icon={<TrendingUp />}
        isLoading={isLoading}
      />
      <MetricCard
        title="Reach"
        value={metrics?.reach?.toLocaleString() ?? metrics?.total_reach?.toLocaleString() ?? 0}
        icon={<Users />}
        isLoading={isLoading}
      />
      <MetricCard
        title="Interactions"
        value={metrics?.interactions?.toLocaleString() ?? metrics?.total_interactions?.toLocaleString() ?? 0}
        icon={<MessageCircle />}
        isLoading={isLoading}
      />
      <MetricCard
        title="Sentiment Score"
        value={`${metrics?.sentiment_score_pct ?? metrics?.sentiment_score ?? 0}%`}
        icon={<Activity />}
        isLoading={isLoading}
      />
    </div>
  );
}
