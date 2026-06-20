'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, resetAuthRedirectLock } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

/** Cache user profile after login so AuthContext reads instantly on next page */
function cacheUserAfterLogin(token: string) {
  try {
    const backendUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
    const meUrl = backendUrl ? `${backendUrl}/api/auth/me` : '/api/auth/me';
    fetch(meUrl, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (user) localStorage.setItem('cached_user', JSON.stringify(user));
      })
      .catch(() => {});
  } catch {}
}

/** Wake up Render backend by calling /health directly to bypass Vercel 10s proxy limit */
async function wakeBackend(): Promise<boolean> {
  const backendUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
  if (!backendUrl || backendUrl.includes('localhost')) return true; // dev: assume alive
  try {
    // Render free tier cold starts take 50-60 seconds. 
    // We MUST wait long enough, otherwise we falsely report it as offline.
    const res = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(90000), // Wait up to 90s for cold start
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginPhase, setLoginPhase] = useState<'idle' | 'waking' | 'authenticating'>('idle');
  const [serverStatus, setServerStatus] = useState<'checking' | 'ready' | 'slow'>('checking');
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Show session-expired banner if redirected from 401
  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
  }, [searchParams]);

  // Wake backend silently on page load (non-blocking)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setServerStatus('checking');
      const ok = await wakeBackend();
      if (!cancelled) setServerStatus(ok ? 'ready' : 'slow');
    })();
    return () => { cancelled = true; };
  }, []);

  // Elapsed time counter while loading
  useEffect(() => {
    if (loading) {
      setElapsedSec(0);
      timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedSec(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading]);

  const clearAuthSession = () => {
    const keysToRemove = [
      'access_token',
      'refresh_token',
      'cached_user',
      'auth_store',
      'permissions',
      'selected_project_id',
      'health_error'
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
  };

  const handleResetSession = () => {
    clearAuthSession();
    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setLoginPhase('authenticating');

    try {
      // Clear stale auth/session keys before attempting to log in
      clearAuthSession();

      // We give it 90s max to handle slow network and Render cold starts.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 90000)
      );
      
      const result = await Promise.race([auth.login(email, password), timeout]) as any;

      // ── Success ──
      resetAuthRedirectLock();
      if (result?.access_token) cacheUserAfterLogin(result.access_token);
      router.replace('/dashboard');
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        setError('Sai email hoặc mật khẩu.');
      } else if (status && status >= 500) {
        setError('Lỗi máy chủ, vui lòng thử lại sau.');
      } else if (err.message === 'TIMEOUT' || err.code === 'ECONNABORTED' || !err.response) {
        setError('Kết nối quá hạn. Vui lòng kiểm tra mạng và thử lại.');
      } else {
        setError(err.response?.data?.detail || 'Đăng nhập thất bại. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
      setLoginPhase('idle');
    }
  };

  const btnLabel = () => {
    if (!loading) return 'Đăng nhập';
    const suffix = elapsedSec > 2 ? ` (${elapsedSec}s)` : '';
    if (loginPhase === 'waking') return `Đang chờ máy chủ khởi động...${suffix}`;
    return `Đang xác thực...${suffix}`;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#000511]">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-[#0D1526] rounded-lg shadow-lg border border-gray-100 dark:border-white/10">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Đăng nhập Nope</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Đăng nhập vào hệ thống</p>

          {/* Server warm-up indicator */}
          {serverStatus === 'checking' && !loading && (
            <p className="mt-2 text-xs text-amber-500 flex items-center justify-center gap-1.5">
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Đang kiểm tra trạng thái máy chủ...
            </p>
          )}
          {serverStatus === 'ready' && !loading && (
            <p className="mt-2 text-xs text-emerald-500 flex items-center justify-center gap-1.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Máy chủ sẵn sàng
            </p>
          )}
          {serverStatus === 'slow' && !loading && (
            <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30 rounded text-xs text-orange-600 dark:text-orange-400 text-left">
              <p className="font-semibold mb-1">⚠️ Lưu ý (Render Free Tier):</p>
              <p>Máy chủ đang ngủ. Quá trình đăng nhập đầu tiên có thể mất <span className="font-bold">45-60 giây</span> để đánh thức hệ thống. Vui lòng bấm Đăng nhập và đợi.</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md border border-red-200 dark:border-red-800/30">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {btnLabel()}
              </span>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>

        {/* Elapsed time hint when login is slow */}
        {loading && elapsedSec >= 5 && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            {elapsedSec < 50 
              ? `Hệ thống đang khởi động (thường mất ~50s), vui lòng không tắt trang...`
              : 'Sắp xong rồi, vui lòng đợi thêm chút nữa...'}
          </p>
        )}

        <div className="flex flex-col items-center gap-3 mt-4">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>Chưa có tài khoản?{' '}
              <a href="/register" className="font-medium text-blue-600 hover:text-blue-500">
                Đăng ký ngay
              </a>
            </p>
          </div>
          
          <button
            onClick={handleResetSession}
            type="button"
            className="text-xs font-medium text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 underline underline-offset-2 transition-colors"
          >
            Reset phiên đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <LoadingSpinner 
        message="Đang tải..."
        submessage="Vui lòng đợi trong giây lát"
      />
    }>
      <LoginContent />
    </Suspense>
  );
}
