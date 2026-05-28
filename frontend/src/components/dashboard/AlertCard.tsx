import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, XCircle, Info } from 'lucide-react';
import { SeverityBadge } from './Badges';
import DashboardQuickActionButton from './DashboardQuickActionButton';
import { alerts } from '@/lib/api';
import toast from 'react-hot-toast';

interface AlertCardProps {
  alert: any;
  onActionComplete: () => void;
  userRole?: string;
}

export default function AlertCard({ alert, onActionComplete, userRole }: AlertCardProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const canAcknowledge = ['analyst', 'manager', 'admin', 'super_admin'].includes(userRole || '');
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

  const isResolved = alert.status === 'resolved' || alert.status === 'ignored';

  return (
    <div className={`rounded-xl shadow-sm border p-4 transition-all ${
      alert.severity === 'critical' ? 'bg-red-50/50 border-red-200' : 
      alert.severity === 'high' ? 'bg-orange-50/50 border-orange-200' : 
      'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
    } ${isResolved ? 'opacity-75' : ''}`}>
      
      <div className="flex items-start space-x-3">
        <div className={`mt-0.5 p-2 rounded-full ${
          alert.severity === 'critical' ? 'bg-red-100 text-red-600' :
          alert.severity === 'high' ? 'bg-orange-100 text-orange-600' :
          alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
          'bg-blue-100 text-blue-600'
        }`}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate pr-2">
              {alert.title}
            </h3>
            <SeverityBadge severity={alert.severity} />
          </div>
          
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {alert.message || alert.reason || 'Không có mô tả'}
          </p>
          
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-1.5 ${
                alert.status === 'new' ? 'bg-blue-500' :
                alert.status === 'acknowledged' ? 'bg-yellow-500' :
                alert.status === 'resolved' ? 'bg-green-500' :
                'bg-gray-500'
              }`}></span>
              {alert.status.toUpperCase()}
            </span>
            <span>•</span>
            <span>{new Date(alert.created_at).toLocaleString('vi-VN')}</span>
            {alert.mention_id && (
              <>
                <span>•</span>
                <a href={`/dashboard/mentions/${alert.mention_id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                  Xem mention <Info className="w-3 h-3 ml-1" />
                </a>
              </>
            )}
          </div>

          {!isResolved && (
            <div className="mt-3 pt-3 border-t border-gray-200/60 dark:border-gray-700 flex flex-wrap gap-2">
              {alert.status === 'new' && canAcknowledge && (
                <DashboardQuickActionButton
                  label="Đã tiếp nhận"
                  icon={CheckCircle}
                  onClick={() => handleAction('ack', () => alerts.acknowledge(alert.id), 'Đã tiếp nhận cảnh báo')}
                  isLoading={loadingAction === 'ack'}
                  variant="primary"
                />
              )}
              
              {canEscalate && (
                <DashboardQuickActionButton
                  label="Tạo sự cố"
                  icon={ShieldAlert}
                  onClick={() => handleAction('incident', () => alerts.createIncident(alert.id), 'Đã chuyển thành sự cố')}
                  isLoading={loadingAction === 'incident'}
                  variant="danger"
                />
              )}
              
              {canEscalate && (
                <DashboardQuickActionButton
                  label="Bỏ qua"
                  icon={XCircle}
                  onClick={() => handleAction('ignore', () => alerts.ignore(alert.id), 'Đã bỏ qua cảnh báo')}
                  isLoading={loadingAction === 'ignore'}
                  variant="ghost"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
