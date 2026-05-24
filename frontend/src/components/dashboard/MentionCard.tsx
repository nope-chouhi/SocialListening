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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <SourceIcon type={mention.source_type} className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
              {mention.title || 'Không có tiêu đề'}
            </h3>
            <div className="flex items-center text-xs text-gray-500 mt-1 space-x-2">
              <span className="font-medium text-blue-600">{mention.source_name}</span>
              <span>•</span>
              <span>{new Date(mention.collected_at || mention.published_at).toLocaleString('vi-VN')}</span>
            </div>
          </div>
        </div>
        <div className="flex space-x-1 items-center">
          {mention.ai_provider === 'dummy' && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-orange-700 bg-orange-100 rounded border border-orange-200">
              DUMMY AI
            </span>
          )}
          {mention.ai_provider && mention.ai_provider !== 'dummy' && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-indigo-700 bg-indigo-100 rounded border border-indigo-200">
              {mention.ai_provider.toUpperCase()}
            </span>
          )}
          <SentimentBadge sentiment={mention.sentiment} />
        </div>
      </div>

      <div className="mt-3">
        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
          {mention.content}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {mention.matched_keywords && mention.matched_keywords.length > 0 && (
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 text-xs rounded-full">
            KW: {mention.matched_keywords.join(', ')}
          </span>
        )}
        <RiskBadge score={mention.risk_score} />
        <CrisisLevelBadge level={mention.crisis_level} />
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
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
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Nguồn
          </a>
        </div>
      </div>
    </div>
  );
}
