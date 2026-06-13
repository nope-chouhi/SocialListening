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
              <span className="text-indigo-400 font-semibold tracking-wide">{mention.source_name}</span>
              <span className="text-gray-700">•</span>
              <span>{new Date(mention.collected_at || mention.published_at).toLocaleString('vi-VN')}</span>
            </div>
          </div>
        </div>
        <div className="flex space-x-1.5 items-center">
          {['dummy', 'dummy_ai', 'dummy_fallback'].includes(mention.ai_provider) && (
            <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-400 bg-amber-500/10 rounded-md border border-amber-500/20 shadow-sm">
              RULE-BASED
            </span>
          )}
          {mention.ai_provider && !['dummy', 'dummy_ai', 'dummy_fallback'].includes(mention.ai_provider) && (
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
        {mention.matched_keywords && mention.matched_keywords.length > 0 && (
          <span className="px-2.5 py-1 bg-[#111827] border border-gray-700 text-gray-400 text-[11px] tracking-wide font-medium rounded-md shadow-sm">
            KW: {mention.matched_keywords.join(', ')}
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
          <a
            href={mention.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 text-xs font-medium rounded-xl bg-[#111827] text-gray-300 border border-gray-700 hover:bg-gray-800 transition-colors shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-2" />
            Nguồn
          </a>
        </div>
      </div>
    </div>
  );
}
