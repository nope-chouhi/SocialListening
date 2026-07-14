'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Radio, TrendingUp, Users, MessageCircle, Smile, type LucideIcon } from 'lucide-react';
import { dashboard } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { withTimeout } from '@/lib/utils/timeout';
import RealtimeVolumeChart from './RealtimeVolumeChart';
import ReachInteractionsChart from './ReachInteractionsChart';
import SentimentDonutChart from './SentimentDonutChart';
import { useLanguage } from '@/contexts/LanguageContext';

type RealtimeMetrics = {
  total_mentions: number;
  reach: number;
  interactions: number;
  sentiment_score_pct: number;
  sentiment_breakdown: {
    positive: number;
    negative: number;
    neutral: number;
    positive_pct: number;
    negative_pct: number;
    neutral_pct: number;
  };
  volume: { time: string; mentions: number; reach: number; interactions: number }[];
};

const REFRESH_MS = 5000;

function StatCard({
  title,
  value,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="premium-surface premium-edge-light rounded-2xl p-5 transition-shadow hover:shadow-[0_24px_65px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_28px_90px_rgba(14,165,233,0.10)]"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{title}</span>
        <div className={`p-2 rounded-lg ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
    </motion.div>
  );
}

export default function RealtimeStatsSection({ projectId }: { projectId?: number | null }) {
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await withTimeout(dashboard.realtimeMetrics(projectId ?? undefined), 10000);
      setMetrics(data);
    } catch (e: any) {
      const safeMsg = e?.response?.status ? `HTTP ${e.response.status}` : e?.message || 'Unknown error';
      console.error(`[RealtimeStats] Failed to load metrics. Error: ${safeMsg}`);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMetrics();
    const id = setInterval(fetchMetrics, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchMetrics]);

  useSocket((evt) => {
    if (evt.event === 'new-mention') {
      fetchMetrics();
    }
  });

  const breakdown = metrics?.sentiment_breakdown;
  const sentimentChartData = breakdown
    ? {
        positive: breakdown.positive,
        neutral: breakdown.neutral,
        negative: breakdown.negative,
        unknown: 0,
        total: breakdown.positive + breakdown.neutral + breakdown.negative,
      }
    : null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between rounded-[1.5rem] border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.035]">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('dashboard.realtimeMonitor')}</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 bg-white/5 px-2 py-0.5 rounded">
            refresh 5s
          </span>
        </div>
        <Activity className="w-4 h-4 text-violet-400" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title={t('dashboard.metrics.totalMentions')}
          value={(metrics?.total_mentions ?? 0).toLocaleString()}
          icon={TrendingUp}
          accent="bg-brand-blue/20 text-blue-300"
        />
        <StatCard
          title={t('dashboard.metrics.reach')}
          value={(metrics?.reach ?? 0).toLocaleString()}
          icon={Users}
          accent="bg-brand-purple/20 text-violet-300"
        />
        <StatCard
          title={t('dashboard.metrics.interactions')}
          value={(metrics?.interactions ?? 0).toLocaleString()}
          icon={MessageCircle}
          accent="bg-brand-green/20 text-emerald-300"
        />
        <StatCard
          title={t('dashboard.metrics.sentimentScore')}
          value={`${metrics?.sentiment_score_pct ?? 0}%`}
          icon={Smile}
          accent="bg-brand-green/20 text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 premium-surface premium-edge-light rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('dashboard.charts.mentionVolume')}</h3>
          <RealtimeVolumeChart data={metrics?.volume ?? []} isLoading={loading} />
        </div>
        <div className="premium-surface premium-edge-light rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('dashboard.charts.sentimentBreakdown')}</h3>
          <SentimentDonutChart data={sentimentChartData} isLoading={loading} />
          {breakdown && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-emerald-400 font-bold">{breakdown.positive_pct}%</span>
                <p className="text-zinc-500">{t('mentions.sentiment.positive')}</p>
              </div>
              <div>
                <span className="text-zinc-400 font-bold">{breakdown.neutral_pct}%</span>
                <p className="text-zinc-500">{t('mentions.sentiment.neutral')}</p>
              </div>
              <div>
                <span className="text-rose-400 font-bold">{breakdown.negative_pct}%</span>
                <p className="text-zinc-500">{t('mentions.sentiment.negative')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('dashboard.charts.reachAndInteractions')}</h3>
        <ReachInteractionsChart data={metrics?.volume ?? []} isLoading={loading} />
      </div>
    </section>
  );
}
