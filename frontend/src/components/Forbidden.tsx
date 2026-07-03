import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

interface ForbiddenProps {
  message?: string;
  showBackButton?: boolean;
}

export default function Forbidden({ 
  message,
  showBackButton = true 
}: ForbiddenProps) {
  const { t } = useLanguage();
  const displayMessage = message || t('common.forbiddenMessage');

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-6">
          <ShieldAlert className="w-10 h-10 text-red-600" />
        </div>
        
        <h1 className="text-4xl font-bold text-gray-900 mb-2">403</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">{t('common.forbiddenTitle')}</h2>
        
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          {displayMessage}
        </p>
        
        {showBackButton && (
          <Link
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('common.backToDashboard')}
          </Link>
        )}
      </div>
    </div>
  );
}
