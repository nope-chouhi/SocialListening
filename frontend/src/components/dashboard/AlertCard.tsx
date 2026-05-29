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
      alert.severity === 'critical' ? 'bg-rose-500/5 border-rose-500/20' : 
      alert.severity === 'high' ? 'bg-amber-500/5 border-amber-500/20' : 
      'bg-[#1E293B] border-gray-800'
    } ${isResolved ? 'opacity-75' : ''}`}>
      
      <div className="flex items-start space-x-3">
        <div className={`mt-0.5 p-2 rounded-xl border ${
          alert.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
          alert.severity === 'high' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
          alert.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
          'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
        }`}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white tracking-wide truncate pr-2">
              {alert.title}
            </h3>
            <SeverityBadge severity={alert.severity} />
          </div>
          
          <p className="mt-1.5 text-sm text-gray-400 line-clamp-2">
            {alert.message || alert.reason || 'Không có mô tả'}
          </p>
          
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-gray-500">
            <span className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 shadow-sm ${
                alert.status === 'new' ? 'bg-indigo-500 shadow-indigo-500/50' :
                alert.status === 'acknowledged' ? 'bg-amber-500 shadow-amber-500/50' :
                alert.status === 'resolved' ? 'bg-emerald-500 shadow-emerald-500/50' :
                'bg-gray-500'
              }`}></span>
              {alert.status.toUpperCase()}
            </span>
            <span className="text-gray-700">•</span>
            <span className="tracking-wide">{new Date(alert.created_at).toLocaleString('vi-VN')}</span>
            {alert.mention_id && (
              <>
                <span className="text-gray-700">•</span>
                <a href={`/dashboard/mentions/${alert.mention_id}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center transition-colors">
                  Xem mention <Info className="w-3 h-3 ml-1" />
                </a>
              </>
            )}
          </div>

          {!isResolved && (
            <div className="mt-4 pt-4 border-t border-gray-800/80 flex flex-wrap gap-3">
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
