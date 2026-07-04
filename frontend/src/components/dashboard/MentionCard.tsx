import React, { useState } from 'react';
import { 
  Facebook, Youtube, Globe, Rss, ExternalLink, Activity, 
  CheckCircle2, AlertTriangle, FileText, BrainCircuit, ShieldAlert, ShieldCheck, Image as ImageIcon, Link2, Info
} from 'lucide-react';
import { SentimentBadge, RiskBadge, CrisisLevelBadge } from './Badges';
import DashboardQuickActionButton from './DashboardQuickActionButton';
import { AppCard } from '@/components/ui/AppCard';
import { mentions } from '@/lib/api';
import { getSafeVisitUrl } from '@/lib/visit-url';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

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

function keywordToText(keyword: any): string | null {
  if (typeof keyword === 'string') return keyword.trim() || null;
  if (!keyword || typeof keyword !== 'object') return null;
  const value = keyword.keyword ?? keyword.name ?? keyword.value ?? keyword.text ?? keyword.search_query;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function keywordTexts(keywords: any[] | null | undefined): string[] {
  return (keywords || []).map(keywordToText).filter((value): value is string => Boolean(value));
}

// Check if image URL is valid and safe to render
function isValidImageUrl(url: any): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('sediment://') || url.includes('image_asset_pointer')) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export default function MentionCard({ mention, onActionComplete, userRole }: MentionCardProps) {
  const { t } = useLanguage();
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
    return getSafeVisitUrl(url);
  };

  const rawUrl = mention.canonical_url || mention.url || '';
  const bestUrl = getSafeUrl(rawUrl);
  const keywordLabels = keywordTexts(mention.matched_keywords);
  
  const derivedDomain = extractDomain(bestUrl);
  const sourceDomain = derivedDomain || t('common.unknownSource') || 'Nguồn chưa xác định';

  const imageUrl = isValidImageUrl(mention.image_url) ? mention.image_url : null;

  // Trust & Safety checks based on expected API fields (might be missing, handled safely)
  const isLowConfidence = mention.source_confidence === 'low' || (typeof mention.source_confidence === 'number' && mention.source_confidence < 0.5);
  const isUrlInvalid = mention.url_status === 'invalid' || mention.url_status === 'dead';
  const isBlocked = mention.is_blocked === true;
  
  const disableVisit = isLowConfidence || isUrlInvalid || isBlocked || !bestUrl;
  let visitWarning = null;
  if (!bestUrl) visitWarning = t('mentions.noUrl') || "Không có URL";
  else if (isBlocked) visitWarning = t('mentions.trust.blocked') || "Nguồn bị chặn (Blocked)";
  else if (isUrlInvalid) visitWarning = t('mentions.invalidUrl') || "URL không hợp lệ hoặc đã chết";
  else if (isLowConfidence) visitWarning = t('mentions.trust.low') || "Độ tin cậy của nguồn thấp";

  return (
    <AppCard hoverable className="overflow-hidden border border-slate-200 dark:border-white/10">
      {/* Source & Provenance Header */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg shadow-sm">
            <SourceIcon type={mention.source_type} className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-slate-900 dark:text-white tracking-wide">
                {sourceDomain}
              </span>
              {typeof mention.source_confidence !== 'undefined' && !isLowConfidence && (
                <span title="Độ tin cậy cao"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /></span>
              )}
              {isLowConfidence && (
                <span title="Độ tin cậy thấp"><ShieldAlert className="w-3.5 h-3.5 text-amber-500" /></span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium tracking-wider uppercase">
              {mention.source_type ? t(`mentions.sourceType.${mention.source_type}`) || mention.source_type : (t('common.unknownSource') || 'Unknown Source')} • {new Date(mention.collected_at || mention.published_at).toLocaleString('vi-VN')}
            </span>
          </div>
        </div>
        
        <div className="flex gap-1.5 items-center">
          {mention.ai_provider === 'failed' && (
            <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider text-red-600 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20 rounded-md shadow-sm" title="AI Service Unavailable">
              AI FAILED
            </span>
          )}
          {['dummy', 'dummy_ai', 'dummy_fallback'].includes(mention.ai_provider) && (
            <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-600 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20 rounded-md shadow-sm">
              RULE-BASED
            </span>
          )}
          {mention.ai_provider && !['dummy', 'dummy_ai', 'dummy_fallback', 'failed'].includes(mention.ai_provider) && (
            <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 dark:text-indigo-400 dark:bg-indigo-500/10 dark:border-indigo-500/20 rounded-md shadow-sm">
              {mention.ai_provider.toUpperCase()}
            </span>
          )}
          {mention.sentiment && <SentimentBadge sentiment={mention.sentiment} />}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 flex flex-col md:flex-row gap-4">
        {/* Preview Image if available safely */}
        {imageUrl && (
          <div className="shrink-0 w-full md:w-32 h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5">
            <img src={imageUrl} alt={mention.title || 'Preview'} className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
        
        <div className="flex-1 min-w-0 space-y-2">
          <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight line-clamp-2">
            {mention.title || <span className="text-slate-400 italic font-normal">{t('mentions.noTitle') || "Không có tiêu đề"}</span>}
          </h3>
          <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed line-clamp-3">
            {mention.content || <span className="text-slate-400 italic">{t('mentions.noContent') || "Không có nội dung trích xuất."}</span>}
          </p>
          
          {/* Metadata badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {keywordLabels.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-[10px] tracking-wide font-bold rounded shadow-sm">
                <Link2 className="w-3 h-3" />
                {keywordLabels.join(', ')}
              </span>
            )}
            {typeof mention.risk_score !== 'undefined' && <RiskBadge score={mention.risk_score} />}
            {mention.crisis_level && <CrisisLevelBadge level={mention.crisis_level} />}
          </div>
        </div>
      </div>

      {/* Actions Footer */}
      <div className="px-4 py-3 bg-slate-50/50 dark:bg-black/10 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex space-x-2">
          <DashboardQuickActionButton
            label={t('common.seen') || "Đã xem"}
            icon={CheckCircle2}
            onClick={() => handleAction('review', () => mentions.markReviewed(mention.id), t('mentions.actions.markedReviewed') || 'Đã đánh dấu xem')}
            isLoading={loadingAction === 'review'}
            variant="ghost"
          />
          {(!mention.sentiment || typeof mention.risk_score === 'undefined') && canAnalyze && (
            <DashboardQuickActionButton
              label={t('mentions.actions.analyze') || "Phân tích AI"}
              icon={BrainCircuit}
              onClick={() => handleAction('analyze', () => mentions.analyze(mention.id), t('mentions.actions.requestedAnalyze') || 'Đã yêu cầu phân tích')}
              isLoading={loadingAction === 'analyze'}
              variant="secondary"
            />
          )}
          {canEscalate && mention.risk_score >= 50 && (
            <DashboardQuickActionButton
              label={t('mentions.actions.alert') || "Tạo cảnh báo"}
              icon={AlertTriangle}
              onClick={() => handleAction('alert', () => mentions.createAlert(mention.id), t('mentions.actions.createdAlert') || 'Đã tạo cảnh báo')}
              isLoading={loadingAction === 'alert'}
              variant="danger"
            />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {visitWarning && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded border border-amber-200 dark:border-amber-500/20">
              <Info className="w-3.5 h-3.5" />
              {visitWarning}
            </div>
          )}
          {disableVisit ? (
            <button
              disabled
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-zinc-500 cursor-not-allowed"
              title={visitWarning || t('mentions.cannotVisit') || "Cannot visit link"}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              {t('mentions.safeVisit') || "Truy cập an toàn"}
            </button>
          ) : (
            <a
              href={bestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors shadow-sm"
              title={`${t('mentions.visitSource') || "Truy cập nguồn"}: ${sourceDomain}`}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              {t('mentions.safeVisit') || "Truy cập an toàn"}
            </a>
          )}
        </div>
      </div>
    </AppCard>
  );
}
