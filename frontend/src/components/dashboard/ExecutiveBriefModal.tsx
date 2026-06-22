import React, { useState, useEffect } from 'react';
import { X, Copy, Check, FileText, MessageSquare, Zap, Loader2 } from 'lucide-react';
import { ai } from '@/lib/api';
import toast from 'react-hot-toast';

interface ExecutiveBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  mentionIds?: number[];
  incidentId?: number;
}

export default function ExecutiveBriefModal({ isOpen, onClose, mentionIds, incidentId }: ExecutiveBriefModalProps) {
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      generateBrief();
    } else {
      setBrief(null);
    }
  }, [isOpen]);

  const generateBrief = async () => {
    setLoading(true);
    try {
      const data = await ai.generateBrief({ 
        mention_ids: mentionIds, 
        incident_id: incidentId 
      });
      setBrief(data);
    } catch (error: any) {
      toast.error('Lỗi khi tạo báo cáo: ' + (error?.response?.data?.detail || error.message));
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success('Đã sao chép vào clipboard');
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-slate-50 dark:bg-[#0B1220] rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-[#111827]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide">Executive Brief Generator</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Báo cáo tóm tắt cho ban lãnh đạo được tạo bởi AI</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-slate-500 dark:text-gray-400 font-medium tracking-wide">AI đang phân tích và tổng hợp báo cáo...</p>
            </div>
          ) : brief ? (
            <>
              {/* Meta Info */}
              <div className="flex flex-wrap gap-4 p-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500 mb-1">Mức độ rủi ro</span>
                  <span className={`text-sm font-bold uppercase ${
                    brief.risk_level === 'critical' ? 'text-rose-500' :
                    brief.risk_level === 'high' ? 'text-orange-500' :
                    brief.risk_level === 'medium' ? 'text-amber-500' :
                    'text-emerald-500'
                  }`}>
                    {brief.risk_level}
                  </span>
                </div>
                <div className="w-px h-10 bg-gray-800 hidden sm:block"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500 mb-1">Hành động đề xuất</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{brief.recommended_decision}</span>
                </div>
                <div className="w-px h-10 bg-gray-800 hidden sm:block"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500 mb-1">Phụ trách / Thời hạn</span>
                  <span className="text-sm font-semibold text-indigo-400">{brief.owner} • {brief.deadline}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 3-Line Summary */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-5 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-indigo-400" />
                      Tóm tắt 3 dòng (Executive Summary)
                    </h3>
                    <button 
                      onClick={() => handleCopy(brief.summary_3_lines, '3lines')}
                      className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white p-1"
                      title="Copy"
                    >
                      {copied === '3lines' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-gray-800 rounded-lg p-4 flex-1">
                    <p className="text-sm text-slate-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                      {brief.summary_3_lines}
                    </p>
                  </div>
                </div>

                {/* Zalo Brief */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-5 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                      <MessageSquare className="w-4 h-4 mr-2 text-blue-400" />
                      Zalo Short Brief
                    </h3>
                    <button 
                      onClick={() => handleCopy(brief.zalo_brief, 'zalo')}
                      className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white p-1"
                      title="Copy"
                    >
                      {copied === 'zalo' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-gray-800 rounded-lg p-4 flex-1 font-sans">
                    <p className="text-sm text-slate-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                      {brief.zalo_brief}
                    </p>
                  </div>
                </div>
              </div>

              {/* Full Brief */}
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-indigo-400" />
                    Báo cáo đầy đủ (Full Brief)
                  </h3>
                  <button 
                    onClick={() => handleCopy(brief.full_brief, 'full')}
                    className="flex items-center px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-slate-900 dark:text-white rounded-lg transition-colors"
                  >
                    {copied === 'full' ? (
                      <><Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Đã copy</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy toàn bộ</>
                    )}
                  </button>
                </div>
                <div className="bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-gray-800 rounded-lg p-5">
                  <p className="text-sm text-slate-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                    {brief.full_brief}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-10">Không có dữ liệu báo cáo.</div>
          )}
        </div>
      </div>
    </div>
  );
}
