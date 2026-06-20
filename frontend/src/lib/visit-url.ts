const BLOCKED_HOSTS = new Set([
  'news.google.com',
  'www.news.google.com',
  'lh3.googleusercontent.com',
  'googleusercontent.com',
  'google-analytics.com',
  'www.google-analytics.com',
  'googletagmanager.com',
  'www.googletagmanager.com',
  'googleadservices.com',
  'www.googleadservices.com',
  'doubleclick.net',
  'www.doubleclick.net',
  'gstatic.com',
  'www.gstatic.com',
]);

const BLOCKED_HOST_SUFFIXES = [
  'googleusercontent.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googleadservices.com',
  'doubleclick.net',
  'gstatic.com',
];

const STATIC_HOST_LABELS = new Set([
  'ad',
  'ads',
  'analytics',
  'asset',
  'assets',
  'cdn',
  'css',
  'font',
  'fonts',
  'gtag',
  'image',
  'images',
  'img',
  'js',
  'media',
  'pagead',
  'script',
  'scripts',
  'static',
  'tag',
  'tracking',
]);

const BLOCKED_PATH_PATTERNS = [
  '/analytics.js',
  '/gtag/js',
  '/collect',
  '/ads',
  '/pagead/',
  '/recaptcha/',
];

const BLOCKED_EXTENSIONS = /\.(js|css|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|mp4|webm|pdf)$/i;

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) return true;
  return host.split('.').some((label) => STATIC_HOST_LABELS.has(label));
}

function isBlockedPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return BLOCKED_EXTENSIONS.test(path) || BLOCKED_PATH_PATTERNS.some((pattern) => path.includes(pattern));
}

function isGoogleAmp(parsed: URL): boolean {
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  return (host === 'google.com' || host === 'www.google.com') && (path === '/amp' || path.startsWith('/amp/'));
}

export function getSafeVisitUrl(url: string | null | undefined): string {
  const trimmed = (url || '').trim();
  if (!trimmed || trimmed.startsWith('/')) return '';

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (isBlockedHost(parsed.hostname) || isBlockedPath(parsed.pathname) || isGoogleAmp(parsed)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

