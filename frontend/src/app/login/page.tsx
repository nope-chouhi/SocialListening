'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { API_BASE_URL, auth, resetAuthRedirectLock } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

function getBackendUrl() {
  return (API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
}

/** Cache user profile after login so AuthContext reads instantly on next page */
function cacheUserAfterLogin(token: string) {
  try {
    const backendUrl = getBackendUrl();
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
async function wakeBackend(timeoutMs = 15000): Promise<boolean> {
  const backendUrl = getBackendUrl();
  if (!backendUrl || backendUrl.includes('localhost')) return true; // dev: assume alive
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function shouldRetryAfterWarmup(err: any) {
  const status = err?.response?.status;
  return (
    err?.message === 'TIMEOUT' ||
    err?.code === 'ECONNABORTED' ||
    !err?.response ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginPhase, setLoginPhase] = useState<'idle' | 'waking' | 'authenticating' | 'redirecting'>('idle');
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
      const ok = await wakeBackend(12000);
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
    let isRedirecting = false;

    try {
      // Clear stale auth/session keys before attempting to log in
      clearAuthSession();

      // We give each attempt 90s max to handle slow network and Render cold starts.
      const loginOnce = () => auth.login(email, password, { timeoutMs: 90000 });

      let result: any;
      try {
        result = await loginOnce();
      } catch (firstErr: any) {
        if (!shouldRetryAfterWarmup(firstErr)) {
          throw firstErr;
        }
        setLoginPhase('waking');
        const backendReady = await wakeBackend(60000);
        if (!backendReady) {
          throw firstErr;
        }
        setLoginPhase('authenticating');
        result = await loginOnce();
      }

      // ── Success ──
      resetAuthRedirectLock();
      if (result?.access_token) cacheUserAfterLogin(result.access_token);
      setLoginPhase('redirecting');
      isRedirecting = true;
      window.location.replace('/dashboard');
      return;
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
      if (!isRedirecting) {
        setLoading(false);
        setLoginPhase('idle');
      }
    }
  };

  const btnLabel = () => {
    if (!loading) return 'Đăng nhập';
    const suffix = elapsedSec > 2 ? ` (${elapsedSec}s)` : '';
    if (loginPhase === 'waking') return `Đang chờ máy chủ khởi động...${suffix}`;
    if (loginPhase === 'redirecting') return 'Đang mở dashboard...';
    return `Đang xác thực...${suffix}`;
  };

  return (
    <div className="premium-auth-shell flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-6">
      <div className="premium-auth-card w-full max-w-md min-w-0 space-y-6 rounded-[1.75rem] p-5 sm:p-8">
        <div className="text-center">
          <div className="premium-auth-mark mx-auto grid h-11 w-11 place-items-center rounded-2xl text-sm font-black text-teal-50">N</div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.24em] text-teal-100/70">Nope360 workspace</p>
          <h1 className="mt-2 break-words text-[clamp(1.75rem,8vw,2.25rem)] font-bold leading-tight tracking-[-0.035em] text-gray-900 dark:text-white">Đăng nhập Nope360</h1>
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
              className="mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm transition-colors placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25 dark:border-white/10 dark:bg-white/[0.07] dark:text-white"
              placeholder="admin@example.com"
              autoComplete="email"
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
              className="mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm transition-colors placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25 dark:border-white/10 dark:bg-white/[0.07] dark:text-white"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="premium-auth-submit w-full rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
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
