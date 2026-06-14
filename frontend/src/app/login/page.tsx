'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, resetAuthRedirectLock } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

/** Cache user profile after login so AuthContext reads instantly on next page */
function cacheUserAfterLogin(token: string) {
  try {
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (user) localStorage.setItem('cached_user', JSON.stringify(user));
      })
      .catch(() => {});
  } catch {}
}

/** Wake up Render backend by calling /health directly (bypasses Next.js /api proxy) */
async function wakeBackend(): Promise<boolean> {
  const backendUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
  if (!backendUrl) return true; // dev: assume alive
  try {
    const res = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(22000),
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
  const [loginPhase, setLoginPhase] = useState<'idle' | 'connecting' | 'authenticating'>('idle');
  const [serverStatus, setServerStatus] = useState<'checking' | 'ready' | 'slow'>('checking');

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

  /** Single login attempt with a hard timeout */
  const attemptLogin = (ms: number) => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    );
    return Promise.race([auth.login(email, password), timeout]) as Promise<any>;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // If backend hasn't confirmed ready yet, wake it first
      if (serverStatus !== 'ready') {
        setLoginPhase('connecting');
        await wakeBackend();
      }

      setLoginPhase('authenticating');
      let result: any;

      try {
        // First attempt — 30s timeout
        result = await attemptLogin(30000);
      } catch (firstErr: any) {
        const isNetworkOrTimeout =
          firstErr.message === 'TIMEOUT' ||
          firstErr.code === 'ECONNABORTED' ||
          !firstErr.response;

        if (!isNetworkOrTimeout) throw firstErr; // auth error → bubble up for classification

        // Network/timeout: wake backend, then retry once
        setLoginPhase('connecting');
        const alive = await wakeBackend();
        if (!alive) {
          setError('Máy chủ phản hồi chậm hoặc chưa sẵn sàng. Vui lòng thử lại sau.');
          return;
        }

        setLoginPhase('authenticating');
        result = await attemptLogin(30000); // retry
      }

      // ── Success ──────────────────────────────────────────────────────────
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
        setError('Máy chủ phản hồi chậm hoặc chưa sẵn sàng. Vui lòng thử lại sau.');
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
    if (loginPhase === 'connecting') return 'Đang kết nối máy chủ...';
    return 'Đang xác thực...';
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
              Đang kết nối máy chủ...
            </p>
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

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Chưa có tài khoản?{' '}
            <a href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Đăng ký ngay
            </a>
          </p>
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
