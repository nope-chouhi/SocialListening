'use client';

import { Award, Calendar, Users, PlayCircle, CheckCircle2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useDialog } from '@/components/ui/Dialog';

export default function WebinarPage() {
  const { prompt, alert } = useDialog();

  const handleRegister = async () => {
    const email = await prompt({
      title: 'Đăng ký tham dự Webinar',
      message: 'Nhập email của bạn để nhận link Zoom và tài liệu.',
      placeholder: 'your@email.com',
      confirmText: 'Đăng ký ngay',
      icon: <Mail className="w-6 h-6" />,
    });
    if (email === null) return;
    if (email && email.includes('@')) {
      localStorage.setItem('webinar_registered', email);
      await alert({
        title: 'Đăng ký thành công! 🎉',
        message: `Link Zoom và tài liệu sẽ được gửi đến: ${email}`,
        variant: 'success',
        confirmText: 'Tuyệt vời!',
      });
    } else {
      await alert({
        title: 'Email không hợp lệ',
        message: 'Vui lòng nhập đúng định dạng email (ví dụ: ten@email.com).',
        variant: 'warning',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-900 to-[#030614] border border-blue-500/30 p-12 text-center flex flex-col items-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-500/20 blur-[100px] pointer-events-none" />

        <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 relative z-10 border border-blue-400/30">
          <Award className="w-10 h-10 text-blue-400" />
        </div>

        <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-widest rounded-full mb-4 relative z-10 border border-blue-500/30">
          Free Online Masterclass
        </span>

        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-6 relative z-10 max-w-3xl leading-tight">
          Get a Social Listening Certificate with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Nope360</span>
        </h1>

        <p className="text-lg text-blue-200/70 max-w-2xl mb-10 relative z-10">
          Nâng cao kỹ năng giám sát truyền thông, xử lý khủng hoảng và nắm bắt Insight khách hàng với chứng chỉ chuyên môn độc quyền từ chúng tôi.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 relative z-10">
          <button
            onClick={handleRegister}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 text-lg"
          >
            <CheckCircle2 className="w-5 h-5" />
            Đăng ký giữ chỗ ngay
          </button>
          <Link href="/dashboard" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-slate-900 dark:text-white rounded-xl font-bold transition-all border border-white/10 flex items-center justify-center">
            Trở về Dashboard
          </Link>
        </div>
      </div>

      {/* Details Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 flex flex-col items-center text-center">
          <Calendar className="w-8 h-8 text-cyan-400 mb-4" />
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">Lịch trình</h3>
          <p className="text-sm text-zinc-400">Thứ Tư, 03 Tháng 6, 2026<br/>20:00 - 22:00 (GMT+7)</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 flex flex-col items-center text-center">
          <PlayCircle className="w-8 h-8 text-rose-400 mb-4" />
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">Hình thức</h3>
          <p className="text-sm text-zinc-400">Trực tuyến qua Zoom<br/>(Link sẽ được gửi qua Email)</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 flex flex-col items-center text-center">
          <Users className="w-8 h-8 text-emerald-400 mb-4" />
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">Đối tượng</h3>
          <p className="text-sm text-zinc-400">Marketing Manager, PR Executive, Brand Manager</p>
        </div>
      </div>
    </div>
  );
}
