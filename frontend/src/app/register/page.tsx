'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu không khớp');
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name
        }),
      });

      if (response.ok) {
        // Registration successful, redirect to login
        toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
        router.push('/login');
      } else {
        const data = await response.json();
        setError(data.detail || 'Đăng ký thất bại');
      }
    } catch (err) {
      setError('Không thể kết nối đến server');
      console.error('Register error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="premium-auth-shell flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-6">
      <div className="premium-auth-card w-full max-w-md min-w-0 space-y-6 rounded-[1.75rem] p-5 sm:p-8">
        <div className="text-center">
          <div className="premium-auth-mark mx-auto grid h-11 w-11 place-items-center rounded-2xl text-sm font-black text-teal-50">N</div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.24em] text-teal-100/70">Nope360 workspace</p>
          <h2 className="mt-2 text-center text-[clamp(1.75rem,8vw,2.25rem)] font-bold leading-tight tracking-[-0.035em] text-gray-900 dark:text-white">
            Đăng ký tài khoản
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Hoặc{' '}
            <Link href="/login" className="font-semibold text-primary transition-colors hover:text-primary-hover">
              đăng nhập nếu đã có tài khoản
            </Link>
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800/30 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Họ và tên
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                className="block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm transition-colors placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 dark:border-white/10 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-300"
                placeholder="Nguyễn Văn A"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm transition-colors placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 dark:border-white/10 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-300"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mật khẩu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm transition-colors placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 dark:border-white/10 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-300"
                placeholder="Ít nhất 6 ký tự"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Xác nhận mật khẩu
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm transition-colors placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 dark:border-white/10 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-300"
                placeholder="Nhập lại mật khẩu"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="premium-auth-submit flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Đang đăng ký...' : 'Đăng ký'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
