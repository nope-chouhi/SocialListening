import React, { useState, useEffect } from 'react';
import { X, Lock, Plus, Trash2, ExternalLink, Link2, FileText, CameraOff } from 'lucide-react';
import { evidence, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { useDialog } from '@/components/ui/Dialog';

interface EvidenceLockerModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: any;
}

export default function EvidenceLockerModal({ isOpen, onClose, incident }: EvidenceLockerModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { confirm } = useDialog();
  
  // New evidence form
  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen && incident) {
      fetchEvidence();
    } else {
      setItems([]);
      setShowAdd(false);
      setUrl('');
      setNote('');
    }
  }, [isOpen, incident]);

  const fetchEvidence = async () => {
    setLoading(true);
    try {
      const data = await evidence.list(incident.id);
      setItems(data || []);
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi tải dữ liệu bằng chứng');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTextSnapshot = async () => {
    if (!url.trim()) {
      toast.error('Vui lòng nhập URL hoặc mô tả');
      return;
    }
    setSubmitting(true);
    try {
      await evidence.create(incident.id, {
        file_name: 'Text Snapshot',
        file_path: note || 'Không có ghi chú',
        file_type: 'text/html',
        capture_method: 'manual',
        original_url: url,
        metadata: JSON.stringify({ note })
      });
      toast.success('Lưu bằng chứng thành công');
      setShowAdd(false);
      setUrl('');
      setNote('');
      fetchEvidence();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi lưu bằng chứng');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Xóa bằng chứng',
      message: 'Bạn có chắc chắn muốn xóa bằng chứng này?',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await evidence.delete(id);
      toast.success('Xóa thành công');
      fetchEvidence();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi xóa');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#0B1220] rounded-2xl shadow-2xl border border-gray-800 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-[#111827] rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl">
              <Lock className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Evidence Locker</h2>
              <p className="text-xs text-gray-400 mt-0.5 font-medium tracking-wide">
                Bảo vệ bằng chứng cho sự cố #{incident?.id}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-[#111827] border border-indigo-500/30 rounded-xl p-4 flex items-start space-x-3">
            <CameraOff className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-indigo-400">Chưa tích hợp chụp ảnh màn hình tự động (Screenshot)</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Trong giai đoạn MVP, tính năng lưu trữ chụp ảnh bằng chứng gốc tự động chưa được bật. 
                Bạn có thể lưu dạng Text Snapshot (URL và ghi chú).
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">Danh sách bằng chứng</h3>
            {!showAdd && (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Thêm Bằng Chứng
              </button>
            )}
          </div>

          {showAdd && (
            <div className="bg-[#111827] border border-gray-700 p-5 rounded-xl space-y-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">URL Nguồn</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-[#0B1220] border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-gray-600"
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Ghi chú (Tùy chọn)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full bg-[#0B1220] border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-gray-600 resize-none"
                  placeholder="Người đăng nhắc đến..."
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveTextSnapshot}
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-900/20 disabled:opacity-50 transition-all"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu Snapshot'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-10 text-gray-500 text-sm font-medium tracking-wide">Đang tải...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 bg-[#111827] border border-gray-800 rounded-xl border-dashed">
              <FileText className="w-8 h-8 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium tracking-wide">Chưa có bằng chứng nào được lưu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="bg-[#111827] border border-gray-800 p-4 rounded-xl flex items-start justify-between group hover:border-gray-700 transition-colors">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-[#0B1220] rounded-lg border border-gray-800 mt-0.5">
                      <Link2 className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">{item.file_name}</span>
                        <span className="text-[10px] text-gray-500">{new Date(item.captured_at).toLocaleString('vi-VN')}</span>
                      </div>
                      <a 
                        href={item.original_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center mt-1 w-fit group/link"
                      >
                        <span className="truncate max-w-xs">{item.original_url}</span>
                        <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-50 group-hover/link:opacity-100" />
                      </a>
                      {item.file_path && item.file_path !== 'Không có ghi chú' && (
                        <p className="text-xs text-gray-400 mt-2 bg-[#0B1220] p-2 rounded border border-gray-800">
                          {item.file_path}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Xóa bằng chứng"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
