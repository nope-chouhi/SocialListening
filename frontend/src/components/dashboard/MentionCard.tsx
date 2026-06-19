import React, { useState } from 'react';
import { 
  Facebook, Youtube, Globe, Rss, ExternalLink, Activity, 
  CheckCircle2, AlertTriangle, FileText, BrainCircuit 
} from 'lucide-react';
import { SentimentBadge, RiskBadge, CrisisLevelBadge } from './Badges';
import DashboardQuickActionButton from './DashboardQuickActionButton';
import { mentions } from '@/lib/api';
import toast from 'react-hot-toast';

interface MentionCardProps {
  mention: any;
  onActionComplete: () => void;
  userRole?: string;
}

const SourceIcon = ({ type, className }: { type: string, className?: string }) => {
  switch (type?.toLowerCase()) {
    case 'facebook': return <Facebook className={className} />;
    case 'youtube': return <Youtube className={className} />;
    case 'rss': return <Rss className={className} />;
    case 'news': return <FileText className={className} />;
    default: return <Globe className={className} />;
  }
};

function isBlockedVisitHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'news.google.com' ||
    host === 'www.news.google.com' ||
    host === 'lh3.googleusercontent.com' ||
    host === 'googleusercontent.com' ||
    host.endsWith('.googleusercontent.com')
  );
}

function isMediaFilePath(pathname: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif|ico)$/i.test(pathname);
}

function keywordToText(keyword: any): string | null {
  if (typeof keyword === 'string') return keyword.trim() || null;
  if (!keyword || typeof keyword !== 'object') return null;
  const value = keyword.keyword ?? keyword.name ?? keyword.value ?? keyword.text ?? keyword.search_query;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function keywordTexts(keywords: any[] | null | undefined): string[] {
  return (keywords || []).map(keywordToText).filter((value): value is string => Boolean(value));
}

export default function MentionCard({ mention, onActionComplete, userRole }: MentionCardProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const canAnalyze = ['analyst', 'manager', 'admin', 'super_admin'].includes(userRole || '');
  const canEscalate = ['manager', 'admin', 'super_admin'].includes(userRole || '');

  const handleAction = async (action: string, apiCall: () => Promise<any>, successMsg: string) => {
    setLoadingAction(action);
    try {
      await apiCall();
      toast.success(successMsg);
      onActionComplete();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Có lỗi xảy ra');
    } finally {
      setLoadingAction(null);
    }
  };

  // Helper to derive a clean domain from a URL string
  const extractDomain = (url: string) => {
    try {
      if (!url) return '';
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };

  const getSafeUrl = (url: string) => {
    try {
      if (!url || url.trim() === '' || url.startsWith('/')) return '';
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      if (isBlockedVisitHost(parsed.hostname) || isMediaFilePath(parsed.pathname)) return '';
      return parsed.href;
    } catch {
      return '';
    }
  };

  const bestUrl = getSafeUrl(mention.canonical_url || mention.url || '');
  const keywordLabels = keywordTexts(mention.matched_keywords);

  const getSourceDisplay = () => {
    if (mention.domain && mention.domain.toLowerCase() !== 'unknown') {
      return mention.domain;
    }
    const derivedDomain = extractDomain(bestUrl);
    if (derivedDomain) return derivedDomain;
    return 'Nguồn chưa xác định';
  };

  return (
    <div className="bg-[#1E293B] rounded-xl shadow-sm border border-gray-800 p-4 hover:shadow-md hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#111827] border border-gray-700/50 rounded-xl shadow-sm">
            <SourceIcon type={mention.source_type} className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white tracking-wide line-clamp-1 pr-2">
              {mention.title || 'Không có tiêu đề'}
            </h3>
            <div className="flex items-center text-xs text-gray-400 mt-1.5 space-x-2 font-medium">
              <span className="text-indigo-400 font-semibold tracking-wide">{getSourceDisplay()}</span>
              <span className="text-gray-700">•</span>
              <span>{new Date(mention.collected_at || mention.published_at).toLocaleString('vi-VN')}</span>
            </div>
          </div>
        </div>
        <div className="flex space-x-1.5 items-center">
          {mention.ai_provider === 'failed' && (
            <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider text-red-400 bg-red-500/10 rounded-md border border-red-500/20 shadow-sm" title="AI Service Unavailable">
              AI FAILED
            </span>
          )}
          {['dummy', 'dummy_ai', 'dummy_fallback'].includes(mention.ai_provider) && (
            <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-400 bg-amber-500/10 rounded-md border border-amber-500/20 shadow-sm">
              RULE-BASED
            </span>
          )}
          {mention.ai_provider && !['dummy', 'dummy_ai', 'dummy_fallback', 'failed'].includes(mention.ai_provider) && (
            <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider text-indigo-400 bg-indigo-500/10 rounded-md border border-indigo-500/20 shadow-sm">
              {mention.ai_provider.toUpperCase()}
            </span>
          )}
          <SentimentBadge sentiment={mention.sentiment} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm text-gray-300 leading-relaxed line-clamp-2">
          {mention.content}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {keywordLabels.length > 0 && (
          <span className="px-2.5 py-1 bg-[#111827] border border-gray-700 text-gray-400 text-[11px] tracking-wide font-medium rounded-md shadow-sm">
            KW: {keywordLabels.join(', ')}
          </span>
        )}
        <RiskBadge score={mention.risk_score} />
        <CrisisLevelBadge level={mention.crisis_level} />
      </div>

      <div className="mt-4 pt-4 border-t border-gray-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex space-x-2">
          <DashboardQuickActionButton
            label="Đã xem"
            icon={CheckCircle2}
            onClick={() => handleAction('review', () => mentions.markReviewed(mention.id), 'Đã đánh dấu xem')}
            isLoading={loadingAction === 'review'}
            variant="ghost"
          />
          {(!mention.sentiment || !mention.risk_score) && canAnalyze && (
            <DashboardQuickActionButton
              label="Phân tích AI"
              icon={BrainCircuit}
              onClick={() => handleAction('analyze', () => mentions.analyze(mention.id), 'Đã phân tích xong')}
              isLoading={loadingAction === 'analyze'}
              variant="secondary"
            />
          )}
        </div>
        
        <div className="flex space-x-2">
          {canEscalate && mention.risk_score >= 50 && (
            <DashboardQuickActionButton
              label="Tạo cảnh báo"
              icon={AlertTriangle}
              onClick={() => handleAction('alert', () => mentions.createAlert(mention.id), 'Đã tạo cảnh báo')}
              isLoading={loadingAction === 'alert'}
              variant="danger"
            />
          )}
          {(() => {
            if (!bestUrl) return null;
            return (
              <a
                href={bestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 text-xs font-medium rounded-xl border transition-colors shadow-sm bg-[#111827] text-gray-300 border-gray-700 hover:bg-gray-800"
                title="Nguon bai viet"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                Nguồn
              </a>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
