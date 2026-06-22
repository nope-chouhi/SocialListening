'use client';

export default function LoadingSpinner({ 
  message = "Khởi tạo hệ thống...", 
  submessage 
}: { 
  message?: string;
  submessage?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F4F5F7] dark:bg-[#000511] overflow-hidden relative">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/20 dark:bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/4 -translate-y-3/4 w-[400px] h-[400px] bg-purple-500/20 dark:bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        {/* Modern Logo Spinner */}
        <div className="relative w-24 h-24 mb-10 flex items-center justify-center">
          {/* Animated concentric rings */}
          <div className="absolute inset-0 rounded-full border border-indigo-200 dark:border-white/10 animate-[spin_4s_linear_infinite]" />
          <div className="absolute inset-2 rounded-full border border-purple-200 dark:border-white/10 animate-[spin_3s_linear_infinite_reverse]" />
          <div className="absolute inset-4 rounded-full border border-t-indigo-500 border-l-indigo-500 border-r-transparent border-b-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-[spin_1.5s_ease-in-out_infinite]" />
          
          {/* Core branding element */}
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.6)] border border-white/20 animate-pulse">
            <span className="text-slate-900 dark:text-white font-black text-xl leading-none">N</span>
          </div>
        </div>

        {/* Text content with glassmorphism backing */}
        <div className="text-center bg-white/50 dark:bg-[#0a0f1c]/50 backdrop-blur-md px-8 py-6 rounded-2xl border border-white/40 dark:border-white/10 shadow-xl">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 mb-3 tracking-tight">
            {message}
          </h2>
          
          {submessage ? (
            <p className="text-sm text-gray-600 dark:text-slate-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
              {submessage}
            </p>
          ) : (
            <p className="text-sm text-gray-600 dark:text-slate-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
              Đang tải dữ liệu và chuẩn bị không gian làm việc của bạn...
            </p>
          )}

          {/* Progress dots */}
          <div className="flex items-center justify-center space-x-2 mt-6">
            <div className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-[bounce_1s_infinite_0ms]" />
            <div className="w-1.5 h-1.5 bg-purple-500 dark:bg-purple-400 rounded-full animate-[bounce_1s_infinite_150ms]" />
            <div className="w-1.5 h-1.5 bg-pink-500 dark:bg-pink-400 rounded-full animate-[bounce_1s_infinite_300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
