'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { keywords as keywordsApi, crawl } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast, { Toaster } from 'react-hot-toast';
import { 
  ArrowRight, ArrowLeft, Loader2, Globe, FileText, 
  Rss, Youtube, Facebook, Instagram, Video, ShieldAlert,
  CheckCircle2, AlertCircle
} from 'lucide-react';

export default function NewProjectPage() {
  const router = useRouter();
  const { fetchProjects, setActiveProject } = useProject();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [projectName, setProjectName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [excludedKeywords, setExcludedKeywords] = useState('');
  
  const [sources, setSources] = useState({
    web: true,
    news: true,
    blogs: true,
    rss: true,
    youtube: false,
    facebook: false,
    tiktok: false,
  });

  const handleNext = () => setStep(s => Math.min(s + 1, 5));
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));

  const handleCreate = async () => {
    try {
      setLoading(true);
      const loadingToast = toast.loading('Đang tạo dự án và cấu hình quét...');

      // 1. Create KeywordGroup (Project)
      const newGroup = await keywordsApi.createGroup({
        name: projectName.trim(),
        description: `Dự án tạo từ Setup Wizard`,
      });

      // 2. Add Included Keywords
      const includedList = keywords.split(',').map(k => k.trim()).filter(Boolean);
      for (const kw of includedList) {
        await keywordsApi.createKeyword({
          keyword: kw,
          group_id: newGroup.id,
          keyword_type: 'general',
        });
      }

      // 3. Add Excluded Keywords
      const excludedList = excludedKeywords.split(',').map(k => k.trim()).filter(Boolean);
      for (const kw of excludedList) {
        await keywordsApi.createKeyword({
          keyword: kw,
          group_id: newGroup.id,
          keyword_type: 'negative_phrase',
          is_excluded: true
        });
      }

      // 4. Trigger Web Scan
      const payload = {
        keyword_group_ids: [newGroup.id],
        mode: 'AUTO_DISCOVERY',
        keywords: includedList,
        // Optional: pass sources config to backend if supported by crawl API
      };
      await crawl.manualScan(payload);

      toast.dismiss(loadingToast);
      toast.success('Dự án đã được tạo thành công! Đang thu thập dữ liệu.');
      
      // Update global context
      await fetchProjects();
      setActiveProject(newGroup);
      
      // Redirect to Mentions
      router.push('/dashboard/mentions');
      
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Có lỗi xảy ra khi tạo dự án');
    } finally {
      setLoading(false);
    }
  };

  const isNextDisabled = () => {
    if (step === 1 && !projectName.trim()) return true;
    if (step === 2 && !keywords.trim()) return true;
    return false;
  };

  return (
    <div className="max-w-3xl mx-auto py-10">
      <Toaster position="top-right" />
      
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white mb-3">Tạo Dự án Mới</h1>
        <p className="text-gray-400">Thiết lập bộ từ khóa và nguồn dữ liệu để bắt đầu lắng nghe</p>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-12 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-800 -z-10 rounded-full" />
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-500 -z-10 rounded-full transition-all duration-300"
          style={{ width: `${((step - 1) / 3) * 100}%` }}
        />
        {[1, 2, 3, 4].map(i => (
          <div 
            key={i}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-4 transition-colors ${
              step >= i 
                ? 'bg-indigo-600 border-[#050A15] text-white' 
                : 'bg-gray-800 border-[#050A15] text-gray-500'
            }`}
          >
            {step > i ? <CheckCircle2 className="w-5 h-5" /> : i}
          </div>
        ))}
      </div>

      {/* Steps Content */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-8 shadow-2xl">
        
        {step === 1 && (
          <div className="animate-fadeIn">
            <h2 className="text-xl font-semibold text-white mb-2">Tên dự án / Thương hiệu</h2>
            <p className="text-sm text-gray-400 mb-6">Đặt tên cho dự án này (ví dụ: Tên công ty, Sản phẩm, Tên đối thủ).</p>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="VD: Vinfast, TTH Hospital..."
              className="w-full px-5 py-4 bg-[#1E293B] border border-gray-700 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-600"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && !isNextDisabled() && handleNext()}
            />
          </div>
        )}

        {step === 2 && (
          <div className="animate-fadeIn">
            <h2 className="text-xl font-semibold text-white mb-2">Từ khóa chính cần theo dõi</h2>
            <p className="text-sm text-gray-400 mb-6">Hệ thống sẽ thu thập bài viết chứa ÍT NHẤT MỘT trong các từ khóa này. Phân cách bằng dấu phẩy (,).</p>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="VD: TTH, Bệnh viện TTH, TTH Hospital"
              className="w-full px-5 py-4 bg-[#1E293B] border border-gray-700 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-600 min-h-[150px]"
              autoFocus
            />
          </div>
        )}

        {step === 3 && (
          <div className="animate-fadeIn">
            <h2 className="text-xl font-semibold text-white mb-2">Từ khóa loại trừ (Tùy chọn)</h2>
            <p className="text-sm text-gray-400 mb-6">Bài viết sẽ bị bỏ qua nếu chứa bất kỳ từ khóa nào dưới đây. Phân cách bằng dấu phẩy (,).</p>
            <textarea
              value={excludedKeywords}
              onChange={(e) => setExcludedKeywords(e.target.value)}
              placeholder="VD: tuyển dụng, xả hàng, khuyến mãi..."
              className="w-full px-5 py-4 bg-[#1E293B] border border-gray-700 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-transparent transition-all placeholder-gray-600 min-h-[150px]"
              autoFocus
            />
            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-3 text-blue-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">Bỏ trống nếu bạn muốn thu thập mọi bài viết có chứa từ khóa chính.</p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fadeIn">
            <h2 className="text-xl font-semibold text-white mb-2">Nguồn dữ liệu</h2>
            <p className="text-sm text-gray-400 mb-6">Chọn các nền tảng bạn muốn hệ thống quét dữ liệu.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${sources.web ? 'bg-indigo-500/10 border-indigo-500/50 text-white' : 'bg-[#1E293B] border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                <input type="checkbox" checked={sources.web} onChange={(e) => setSources({...sources, web: e.target.checked})} className="hidden" />
                <Globe className={`w-6 h-6 mr-3 ${sources.web ? 'text-indigo-400' : ''}`} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Web & Forums</p>
                </div>
                {sources.web && <CheckCircle2 className="w-5 h-5 text-indigo-500" />}
              </label>

              <label className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${sources.news ? 'bg-indigo-500/10 border-indigo-500/50 text-white' : 'bg-[#1E293B] border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                <input type="checkbox" checked={sources.news} onChange={(e) => setSources({...sources, news: e.target.checked})} className="hidden" />
                <FileText className={`w-6 h-6 mr-3 ${sources.news ? 'text-indigo-400' : ''}`} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Báo chí (News)</p>
                </div>
                {sources.news && <CheckCircle2 className="w-5 h-5 text-indigo-500" />}
              </label>
              
              <label className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${sources.blogs ? 'bg-indigo-500/10 border-indigo-500/50 text-white' : 'bg-[#1E293B] border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                <input type="checkbox" checked={sources.blogs} onChange={(e) => setSources({...sources, blogs: e.target.checked})} className="hidden" />
                <FileText className={`w-6 h-6 mr-3 ${sources.blogs ? 'text-indigo-400' : ''}`} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Blogs</p>
                </div>
                {sources.blogs && <CheckCircle2 className="w-5 h-5 text-indigo-500" />}
              </label>

              <label className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${sources.rss ? 'bg-indigo-500/10 border-indigo-500/50 text-white' : 'bg-[#1E293B] border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                <input type="checkbox" checked={sources.rss} onChange={(e) => setSources({...sources, rss: e.target.checked})} className="hidden" />
                <Rss className={`w-6 h-6 mr-3 ${sources.rss ? 'text-orange-400' : ''}`} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">RSS Feeds</p>
                </div>
                {sources.rss && <CheckCircle2 className="w-5 h-5 text-indigo-500" />}
              </label>

              <label className="flex items-center p-4 rounded-xl border bg-[#1E293B] border-gray-700 text-gray-400 cursor-not-allowed opacity-60">
                <Youtube className="w-6 h-6 mr-3 text-red-500" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">YouTube</p>
                  <p className="text-[10px] text-gray-500">Yêu cầu cấu hình API Key</p>
                </div>
              </label>

              <label className="flex items-center p-4 rounded-xl border bg-[#1E293B] border-gray-700 text-gray-400 cursor-not-allowed opacity-60">
                <Facebook className="w-6 h-6 mr-3 text-blue-500" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Facebook / Instagram</p>
                  <p className="text-[10px] text-gray-500">Yêu cầu Meta OAuth</p>
                </div>
              </label>

              <label className="flex items-center p-4 rounded-xl border bg-[#1E293B] border-gray-700 text-gray-400 cursor-not-allowed opacity-60">
                <Video className="w-6 h-6 mr-3 text-pink-500" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">TikTok</p>
                  <p className="text-[10px] text-rose-400">Connector required</p>
                </div>
              </label>
            </div>
          </div>
        )}

      </div>

      {/* Footer Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={step === 1 || loading}
          className={`flex items-center gap-2 px-6 py-3 font-medium rounded-xl transition-all ${
            step === 1 ? 'opacity-0 cursor-default' : 'bg-[#111827] text-gray-400 hover:text-white border border-gray-800 hover:bg-gray-800'
          }`}
        >
          <ArrowLeft className="w-5 h-5" /> Quay lại
        </button>

        {step < 4 ? (
          <button
            onClick={handleNext}
            disabled={isNextDisabled()}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
          >
            Tiếp tục <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
            {loading ? 'Đang tạo dự án...' : 'Tạo Dự án & Bắt đầu quét'}
          </button>
        )}
      </div>

    </div>
  );
}
