'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Radar,
  MessageCircle,
  ThumbsUp,
  AlertTriangle,
  Shield,
  RefreshCcw,
  Loader2,
  ExternalLink,
  TrendingUp,
  Sparkles,
  Clock,
  AlertCircle,
  Link as LinkIcon,
  ServerOff,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

// Components
import MonitorMetricCard from '@/components/dashboard/MonitorMetricCard';
import MonitorSentimentChart from '@/components/dashboard/MonitorSentimentChart';
import MonitorVolatilityChart from '@/components/dashboard/MonitorVolatilityChart';
import AiCrisisPanel from '@/components/dashboard/AiCrisisPanel';
import PlatformBadge from '@/components/dashboard/PlatformBadge';
import SentimentTag from '@/components/dashboard/SentimentTag';

// API
import { monitor } from '@/lib/api';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface SentimentBreakdown {
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  positive_pct: number;
  negative_pct: number;
  neutral_pct: number;
}

interface MentionItem {
  id: number;
  platform: string;
  content: string;
  author: string;
  sentiment: string | null;
  sentiment_score: number | null;
  risk_score: number | null;
  reach: number;
  url: string;
  created_at: string | null;
}

interface VolatilityPoint {
  date: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
}

interface BuzzwordItem {
  word: string;
  count: number;
}

interface DashboardData {
  keyword: string;
  total_mentions: number;
  sentiment_breakdown: SentimentBreakdown;
  dangerous_negative_count: number;
  alert_risk_status: string;
  top_buzzwords: BuzzwordItem[];
  mentions: MentionItem[];
  volatility_data: VolatilityPoint[];
  message?: string;
}

interface ActionItem {
  step: number;
  title: string;
  description: string;
  priority: string;
}

interface AiAnalysisData {
  keyword: string;
  crisis_summary: string;
  risk_level: string;
  action_items: ActionItem[];
  negative_mentions_count: number;
  total_mentions: number;
  top_negative_themes?: { theme: string; count: number }[];
}

interface StartResult {
  keyword: string;
  keyword_created: boolean;
  sources_scanned: number;
  crawl_jobs_created: number;
  mentions_created: number;
  alerts_created: number;
  message: string;
  worker_status?: string | null;
}

// ============================================================================
// MONITOR DASHBOARD PAGE — REAL DATA ONLY
// ============================================================================

export default function MonitorDashboardPage() {
  // ── State ─────────────────────────────────────────────────────────────
  const [keyword, setKeyword] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisData | null>(null);
  const [startResult, setStartResult] = useState<StartResult | null>(null);

  const [isTracking, setIsTracking] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleStartTracking = useCallback(async () => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập từ khóa cần theo dõi');
      return;
    }

    setIsTracking(true);
    setActiveKeyword(trimmed);
    setDashboardData(null);
    setAiAnalysis(null);
    setStartResult(null);

    try {
      // Step 1: POST /api/monitor/start — quét nguồn thật
      const result: StartResult = await monitor.startTracking(trimmed);
      setStartResult(result);
      setLastScanTime(new Date().toLocaleTimeString('vi-VN'));

      // Show real message from backend
      if (result.sources_scanned === 0) {
        toast.error(result.message, { duration: 6000 });
      } else if (result.mentions_created > 0) {
        toast.success(result.message, { duration: 4000 });
      } else {
        toast(result.message, { icon: '📭', duration: 5000 });
      }

      // Step 2 & 3: Load dashboard + AI analysis if we have mentions
      if (result.sources_scanned > 0) {
        await Promise.all([
          fetchDashboardData(trimmed),
          fetchAiAnalysis(trimmed),
        ]);
      }
    } catch (error: any) {
      console.error('[Monitor] Start tracking error:', error);
      const msg = error?.response?.data?.detail || 'Lỗi khi bắt đầu theo dõi';
      toast.error(msg);
    } finally {
      setIsTracking(false);
    }
  }, [keyword]);

  const fetchDashboardData = async (kw: string) => {
    setIsLoadingDashboard(true);
    try {
      const data = await monitor.getDashboard(kw);
      setDashboardData(data);
    } catch (error: any) {
      console.error('[Monitor] Dashboard error:', error);
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  const fetchAiAnalysis = async (kw: string) => {
    setIsLoadingAi(true);
    try {
      const data = await monitor.getAiAnalysis(kw);
      setAiAnalysis(data);
    } catch (error: any) {
      console.error('[Monitor] AI analysis error:', error);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleRefresh = () => {
    if (activeKeyword) {
      Promise.all([
        fetchDashboardData(activeKeyword),
        fetchAiAnalysis(activeKeyword),
      ]);
      setLastScanTime(new Date().toLocaleTimeString('vi-VN'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isTracking) {
      handleStartTracking();
    }
  };

  // ── Risk status config ────────────────────────────────────────────────
  const riskStatusConfig: Record<string, { color: string; icon: any; label: string }> = {
    High: { color: 'from-red-500 to-rose-600', icon: AlertTriangle, label: 'Cao' },
    Medium: { color: 'from-amber-500 to-orange-600', icon: AlertTriangle, label: 'Trung bình' },
    Low: { color: 'from-emerald-500 to-green-600', icon: Shield, label: 'Thấp' },
  };

  const riskStatus = dashboardData?.alert_risk_status || 'Low';
  const riskConfig = riskStatusConfig[riskStatus] || riskStatusConfig.Low;

  // ── Format time ago ───────────────────────────────────────────────────
  const formatTimeAgo = (isoStr: string | null): string => {
    if (!isoStr) return '';
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      return `${Math.floor(diffHours / 24)} ngày trước`;
    } catch {
      return '';
    }
  };

  // ── Determine if we should show "no sources" warning ──────────────────
  const showNoSourcesWarning = startResult && startResult.sources_scanned === 0;
  const showWorkerWarning = startResult?.worker_status === 'not_running';
  const showNoMentionsInfo = startResult && startResult.sources_scanned > 0 && startResult.mentions_created === 0;

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* ─── HEADER ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
              <Radar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Monitor
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Giám sát từ khóa — Quét nguồn thật — Phân tích cảm xúc AI
              </p>
            </div>
          </div>
        </div>

        {activeKeyword && (
          <div className="flex items-center gap-3">
            {lastScanTime && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                Quét lúc {lastScanTime}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isLoadingDashboard}
              className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
              title="Làm mới dữ liệu"
            >
              <RefreshCcw className={`w-5 h-5 ${isLoadingDashboard ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* ─── SEARCH & CONTROL BAR ────────────────────────────────────── */}
      <div
        className="
          relative overflow-hidden rounded-2xl
          bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5
          border border-indigo-200/50 dark:border-indigo-800/30
          backdrop-blur-sm
          p-6
        "
        id="monitor-search-bar"
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-indigo-500/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập từ khóa theo dõi (ví dụ: Vinamilk, VinFast, TTH...)"
              className="
                w-full pl-12 pr-4 py-4
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                rounded-xl
                text-gray-900 dark:text-white
                placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500
                shadow-sm hover:shadow-md transition-shadow duration-200
                text-base
              "
              id="monitor-keyword-input"
            />
          </div>

          <button
            onClick={handleStartTracking}
            disabled={isTracking || !keyword.trim()}
            className="
              px-8 py-4
              bg-gradient-to-r from-indigo-600 to-purple-600
              hover:from-indigo-700 hover:to-purple-700
              disabled:from-gray-400 disabled:to-gray-500
              text-white font-semibold
              rounded-xl shadow-lg shadow-indigo-500/25
              hover:shadow-xl hover:shadow-indigo-500/30
              transform hover:scale-[1.02] active:scale-[0.98]
              transition-all duration-200
              flex items-center gap-2
              disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none
              whitespace-nowrap
            "
            id="monitor-start-button"
          >
            {isTracking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang quét nguồn...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Bắt Đầu Theo Dõi
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── NO SOURCES WARNING ──────────────────────────────────────── */}
      {showNoSourcesWarning && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-800/40 rounded-xl">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200 mb-1">
                Chưa có nguồn quét
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                {startResult.message}
                {' '}Hệ thống cần ít nhất một nguồn RSS hoặc Website để quét dữ liệu thật.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/dashboard/sources"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <LinkIcon className="w-4 h-4" />
                  Thêm nguồn RSS/Web
                </Link>
                <Link
                  href="/dashboard/scan"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 text-sm font-medium rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                >
                  Scan Center
                </Link>
              </div>
              {startResult.keyword_created && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                  Từ khóa &quot;{startResult.keyword}&quot; đã được lưu vào hệ thống.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── WORKER NOT RUNNING WARNING ──────────────────────────────── */}
      {showWorkerWarning && !showNoSourcesWarning && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/50 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <ServerOff className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <div className="flex-1">
              <p className="text-sm text-orange-700 dark:text-orange-300">
                <span className="font-semibold">Worker chưa chạy.</span>{' '}
                RSS sẽ không tự quét 24/7. Bạn có thể quét thủ công tại{' '}
                <Link href="/dashboard/scan" className="underline font-medium">Scan Center</Link>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── NO MENTIONS FOUND ───────────────────────────────────────── */}
      {showNoMentionsInfo && !dashboardData && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-2xl p-6 text-center">
          <MessageCircle className="w-10 h-10 text-blue-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-blue-900 dark:text-blue-200 mb-1">
            Không tìm thấy đề cập nào phù hợp
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 max-w-md mx-auto">
            Đã quét {startResult.sources_scanned} nguồn nhưng không tìm thấy nội dung
            nào khớp với từ khóa &quot;{startResult.keyword}&quot;.
            Thử thêm nguồn hoặc chọn từ khóa khác.
          </p>
          {startResult.keyword_created && (
            <p className="text-xs text-blue-500 mt-2">
              Từ khóa đã được lưu — hệ thống sẽ tự quét khi worker chạy.
            </p>
          )}
        </div>
      )}

      {/* ─── EMPTY STATE ─────────────────────────────────────────────── */}
      {!dashboardData && !isLoadingDashboard && !isTracking && !startResult && (
        <div className="text-center py-20">
          <div className="inline-flex p-4 bg-indigo-500/10 rounded-2xl mb-4">
            <Radar className="w-12 h-12 text-indigo-500 opacity-60" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Sẵn sàng giám sát
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Nhập từ khóa cần theo dõi và nhấn &quot;Bắt Đầu Theo Dõi&quot; để quét
            các nguồn RSS/Web đã cấu hình và phân tích cảm xúc bằng AI.
          </p>
        </div>
      )}

      {/* ─── SCAN RESULT SUMMARY ─────────────────────────────────────── */}
      {startResult && startResult.sources_scanned > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Nguồn đã quét: <strong className="text-gray-900 dark:text-white">{startResult.sources_scanned}</strong>
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Crawl jobs: <strong className="text-gray-900 dark:text-white">{startResult.crawl_jobs_created}</strong>
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Đề cập mới: <strong className="text-gray-900 dark:text-white">{startResult.mentions_created}</strong>
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Cảnh báo: <strong className="text-gray-900 dark:text-white">{startResult.alerts_created}</strong>
            </span>
            {startResult.keyword_created && (
              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                + Keyword đã lưu
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── KPI METRIC CARDS ────────────────────────────────────────── */}
      {(dashboardData || isLoadingDashboard) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="monitor-kpi-grid">
          <MonitorMetricCard
            title="Tổng Đề Cập"
            value={dashboardData?.total_mentions || 0}
            subtitle={activeKeyword ? `Từ khóa: ${activeKeyword}` : undefined}
            icon={MessageCircle}
            gradient="from-blue-500 to-indigo-600"
            iconBg="bg-blue-400/30"
          />
          <MonitorMetricCard
            title="Tỉ Lệ Tích Cực"
            value={`${dashboardData?.sentiment_breakdown?.positive_pct || 0}%`}
            subtitle={`${dashboardData?.sentiment_breakdown?.positive_count || 0} đề cập tích cực`}
            icon={ThumbsUp}
            gradient="from-emerald-500 to-teal-600"
            iconBg="bg-emerald-400/30"
          />
          <MonitorMetricCard
            title="Đề Cập Nguy Hiểm"
            value={dashboardData?.dangerous_negative_count || 0}
            subtitle="Tiêu cực mức trung bình + cao"
            icon={AlertTriangle}
            gradient="from-rose-500 to-red-600"
            iconBg="bg-rose-400/30"
            pulse={(dashboardData?.dangerous_negative_count || 0) > 3}
          />
          <MonitorMetricCard
            title="Mức Cảnh Báo"
            value={riskConfig.label}
            subtitle={`${dashboardData?.sentiment_breakdown?.negative_pct || 0}% tiêu cực`}
            icon={riskConfig.icon}
            gradient={riskConfig.color}
            iconBg="bg-white/20"
          />
        </div>
      )}

      {/* ─── ANALYTICS CHARTS ────────────────────────────────────────── */}
      {(dashboardData || isLoadingDashboard) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="monitor-charts">
          {/* Volatility Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                Biến Động Đề Cập
              </h2>
              <span className="text-xs text-gray-400">7 ngày gần nhất</span>
            </div>
            <MonitorVolatilityChart
              data={dashboardData?.volatility_data || []}
              isLoading={isLoadingDashboard}
            />
          </div>

          {/* Sentiment Donut */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Phân Bố Sắc Thái
            </h2>
            <MonitorSentimentChart
              data={dashboardData?.sentiment_breakdown || null}
              isLoading={isLoadingDashboard}
            />

            {/* Buzzwords */}
            {dashboardData?.top_buzzwords && dashboardData.top_buzzwords.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Từ Khóa Nổi Bật
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {dashboardData.top_buzzwords.slice(0, 8).map((bw) => (
                    <span
                      key={bw.word}
                      className="px-2 py-0.5 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-100 dark:border-indigo-800/50"
                    >
                      {bw.word}
                      <span className="ml-1 text-indigo-400 dark:text-indigo-500 text-[10px]">
                        {bw.count}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── AI CRISIS PANEL ─────────────────────────────────────────── */}
      {(aiAnalysis || isLoadingAi) && (
        <div id="monitor-ai-panel">
          <AiCrisisPanel
            keyword={activeKeyword}
            crisisSummary={aiAnalysis?.crisis_summary || ''}
            riskLevel={aiAnalysis?.risk_level || 'Low'}
            actionItems={aiAnalysis?.action_items || []}
            negativeMentionsCount={aiAnalysis?.negative_mentions_count || 0}
            totalMentions={aiAnalysis?.total_mentions || 0}
            isLoading={isLoadingAi}
          />
        </div>
      )}

      {/* ─── REAL MENTIONS FEED ──────────────────────────────────────── */}
      {dashboardData && dashboardData.mentions.length > 0 && (
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
          id="monitor-mentions-feed"
        >
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 rounded-t-2xl">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-500" />
              Đề Cập Từ Nguồn Thật
            </h2>
            <span className="text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-full">
              {dashboardData.mentions.length} đề cập
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30">
                  <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                    Nguồn
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                    Nội dung
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                    Tác giả
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                    Sắc thái
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                    Thời gian
                  </th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {dashboardData.mentions.map((mention) => (
                  <tr
                    key={mention.id}
                    className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors duration-150 group"
                  >
                    <td className="px-5 py-3.5">
                      <PlatformBadge platform={mention.platform} />
                    </td>
                    <td className="px-5 py-3.5 max-w-md">
                      <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 leading-relaxed">
                        {mention.content}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {mention.author || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <SentimentTag sentiment={mention.sentiment} />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatTimeAgo(mention.created_at)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <a
                        href={mention.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-indigo-500"
                        title="Xem nguồn gốc"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── NEGATIVE THEMES ─────────────────────────────────────────── */}
      {aiAnalysis?.top_negative_themes && aiAnalysis.top_negative_themes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            Chủ Đề Tiêu Cực Nổi Bật
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {aiAnalysis.top_negative_themes.map((theme) => (
              <div
                key={theme.theme}
                className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 rounded-xl px-4 py-3 text-center hover:shadow-md transition-shadow duration-200"
              >
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  {theme.theme}
                </p>
                <p className="text-xs text-red-500/70 dark:text-red-500/60 mt-0.5">
                  {theme.count} đề cập
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
