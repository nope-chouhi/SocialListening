import React from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface MentionEmptyResultsProps {
  searchState: string;
  searchTerm: string;
  dateRange: string;
  hasFilters: boolean;
  onExtend7Days: () => void;
  onExtend30Days: () => void;
  onClearFilters: () => void;
  onScanClick: () => void;
  isScanning: boolean;
}

export function MentionEmptyResults({
  searchState,
  searchTerm,
  dateRange,
  hasFilters,
  onExtend7Days,
  onExtend30Days,
  onClearFilters,
  onScanClick,
  isScanning
}: MentionEmptyResultsProps) {
  const { t } = useLanguage();

  return (
    <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#050A15] rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
      {searchState === 'TYPING' || searchState === 'SEARCHING_DB' ? (
        <>
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-600 dark:text-slate-500 dark:text-gray-400">
            {searchState === 'TYPING' ? t('mentions.typingKeyword') : `${t('mentions.searchingFor')} '${searchTerm}'...`}
          </p>
        </>
      ) : (
        <>
          <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-slate-500 dark:text-gray-400" />
          </div>
          
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
            {dateRange === '1d' 
              ? t('mentions.noResultsToday') 
              : searchTerm 
                ? `${t('mentions.noResultsFor')} '${searchTerm}'.` 
                : t('mentions.noDataYet')}
          </h3>
          
          {dateRange === '1d' ? (
            <div className="flex flex-wrap gap-3 mt-4 justify-center">
              <button onClick={onExtend7Days} className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors">
                {t('mentions.extend7Days')}
              </button>
              <button onClick={onExtend30Days} className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors">
                {t('mentions.extend30Days')}
              </button>
              {hasFilters && (
                <button onClick={onClearFilters} className="px-4 py-2 bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
                  {t('mentions.clearSourceFilter')}
                </button>
              )}
            </div>
          ) : (
            <p className="text-gray-600 dark:text-slate-500 dark:text-gray-400 mb-6 max-w-sm">
              {t('mentions.noDataHint')}
            </p>
          )}

          {['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) && (
            <div className="mt-6 flex items-center gap-2 text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-lg text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin" /> {t('mentions.scanningMoreData')}
            </div>
          )}
          
          {searchState === 'NO_LOCAL_RESULTS' && !['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) && searchTerm && (
            <div className="mt-4">
              <button 
                onClick={onScanClick} 
                disabled={isScanning || searchTerm.length < 2} 
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> {t('mentions.tryScanAgain')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
