import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Activity, Clock, FileText, Link2, AlertTriangle, MessageSquare } from 'lucide-react';
import { incidents as incidentsApi, mentions as mentionsApi, getErrorMessage } from '@/lib/api';
import { getSafeVisitUrl } from '@/lib/visit-url';
import { SentimentBadge, RiskBadge, CrisisLevelBadge } from '@/components/dashboard/Badges';
import toast from 'react-hot-toast';

interface CrisisWarRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: any;
}

export default function CrisisWarRoomModal({ isOpen, onClose, incident }: CrisisWarRoomModalProps) {
  const [loading, setLoading] = useState(false);
  const [mention, setMention] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && incident) {
      fetchData();
    } else {
      setMention(null);
      setLogs([]);
    }
  }, [isOpen, incident]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch logs
      const logsData = await incidentsApi.getLogs(incident.id);
      setLogs(logsData || []);

      // Fetch origin mention if exists
      if (incident.mention_id) {
        const mentionData = await mentionsApi.get(incident.mention_id);
        setMention(mentionData);
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi tải dữ liệu War Room');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !incident) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-slate-50 dark:bg-[#0B1220] rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-800 flex flex-col h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-[#111827] rounded-t-2xl shrink-0">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
              <ShieldAlert className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">Crisis War Room</h2>
                <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-gray-700">
                  INCIDENT #{incident.id}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1 font-medium">{incident.title}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-slate-500 dark:text-gray-400 font-medium">Đang thiết lập phòng chỉ huy...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Main Column */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Status & Deadline */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-5">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Trạng Thái Hiện Tại</h4>
                    <span className="text-lg font-bold text-slate-900 dark:text-white uppercase">{incident.status.replace('_', ' ')}</span>
                  </div>
                  <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-5">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Thời Hạn Xử Lý</h4>
                    <span className={`text-lg font-bold ${incident.is_overdue ? 'text-rose-500' : 'text-indigo-400'}`}>
                      {incident.deadline ? new Date(incident.deadline).toLocaleString('vi-VN') : 'Không có'}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {incident.description && (
                  <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-5">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Mô Tả Sự Cố
                    </h4>
                    <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed bg-slate-50 dark:bg-[#0B1220] p-4 rounded-lg border border-gray-800/50">
                      {incident.description}
                    </p>
                  </div>
                )}

                {/* Timeline */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-5">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                    Timeline Sự Kiện
                  </h4>
                  <div className="space-y-4">
                    <div className="relative border-l-2 border-indigo-500/30 ml-3 pl-5 py-2">
                      <div className="absolute w-3 h-3 bg-indigo-500 rounded-full -left-[7px] top-3 ring-4 ring-[#111827]"></div>
                      <span className="text-[10px] font-bold text-indigo-400">{new Date(incident.created_at).toLocaleString('vi-VN')}</span>
                      <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">Phát hiện và ghi nhận sự cố</p>
                    </div>
                    {logs.map((log) => (
                      <div key={log.id} className="relative border-l-2 border-slate-300 dark:border-gray-700 ml-3 pl-5 py-2">
                        <div className="absolute w-3 h-3 bg-gray-600 rounded-full -left-[7px] top-3 ring-4 ring-[#111827]"></div>
                        <span className="text-[10px] font-bold text-gray-500">{new Date(log.created_at).toLocaleString('vi-VN')}</span>
                        <p className="text-sm font-medium text-slate-900 dark:text-white mt-1 uppercase">{log.action}</p>
                        {log.notes && <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{log.notes}</p>}
                        {(log.old_status || log.new_status) && (
                          <div className="text-[10px] font-medium text-gray-500 mt-2 bg-slate-50 dark:bg-[#0B1220] inline-block px-2 py-1 rounded border border-slate-200 dark:border-gray-800">
                            {log.old_status} <span className="mx-1">→</span> {log.new_status}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Sidebar Column */}
              <div className="space-y-6">
                
                {/* AI Analysis of Origin Mention */}
                {mention && mention.ai_analysis ? (
                  <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-5">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center">
                      <Activity className="w-3.5 h-3.5 mr-1.5" />
                      Phân tích Nguồn Gốc (AI)
                    </h4>
                    
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-[#0B1220] rounded-xl border border-slate-200 dark:border-gray-800 mb-4">
                      <span className="text-4xl font-black text-rose-500">{mention.ai_analysis.risk_score}</span>
                      <span className="text-[10px] font-bold text-gray-500 uppercase mt-1">Risk Score</span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-800/50">
                        <span className="text-xs text-slate-500 dark:text-gray-400 font-medium">Crisis Level</span>
                        <CrisisLevelBadge level={mention.ai_analysis.crisis_level} />
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-gray-800/50">
                        <span className="text-xs text-slate-500 dark:text-gray-400 font-medium">Sentiment</span>
                        <SentimentBadge sentiment={mention.ai_analysis.sentiment} />
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-gray-800/50">
                        <span className="text-xs text-slate-500 dark:text-gray-400 font-medium">Khẩn cấp</span>
                        <span className="text-xs font-bold text-rose-400 uppercase">{mention.ai_analysis.urgency}</span>
                      </div>
                      {mention.ai_analysis.escalation_needed && (
                        <div className="mt-4 p-2 bg-rose-500/10 border border-rose-500/20 rounded text-center">
                          <span className="text-xs font-bold text-rose-500 flex items-center justify-center">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Yêu cầu leo thang
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-5 text-center">
                    <p className="text-sm text-gray-500 font-medium tracking-wide">Không có dữ liệu AI cho sự kiện gốc</p>
                  </div>
                )}

                {/* Origin Mention Details */}
                {mention && (
                  <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-5">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center">
                      <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                      Nội Dung Gốc
                    </h4>
                    <p className="text-sm text-slate-700 dark:text-gray-300 bg-slate-50 dark:bg-[#0B1220] p-3 rounded-lg border border-slate-200 dark:border-gray-800 line-clamp-4 leading-relaxed mb-4">
                      {mention.content}
                    </p>
                    {getSafeVisitUrl(mention.canonical_url || mention.url) && (<a
                      href={getSafeVisitUrl(mention.canonical_url || mention.url)}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-slate-900 dark:text-white text-xs font-semibold rounded-lg transition-colors border border-slate-300 dark:border-gray-700 hover:border-gray-600"
                    >
                      <Link2 className="w-3.5 h-3.5 mr-1.5" /> Xem Tại Nguồn
                    </a>)}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
