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

// Utility/account/help page path prefixes — not article content
const UTILITY_PATH_PREFIXES = [
  '/account',
  '/login',
  '/signin',
  '/sign-in',
  '/logout',
  '/sign-out',
  '/register',
  '/signup',
  '/sign-up',
  '/help',
  '/docs',
  '/documentation',
  '/legal',
  '/license',
  '/policy',
  '/privacy',
  '/terms',
  '/contact',
  '/about',
  '/search',
];

// RSS / Atom feed path segments — not publisher article pages
const FEED_PATH_PREFIXES = [
  '/feed',
  '/feeds',
  '/rss',
  '/atom',
  '/sitemap',
];

// Non-HTTP asset URI schemes to reject
const BLOCKED_SCHEMES = new Set(['data', 'blob', 'javascript', 'sediment', 'asset', 'file']);

const BLOCKED_EXTENSIONS = /\.(js|css|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|mp4|webm|pdf|xml|rss)$/i;

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

function isUtilityPage(parsed: URL): boolean {
  const path = parsed.pathname.toLowerCase();
  if (!path || path === '/') return false;
  return UTILITY_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')
  );
}

function isFeedOrRss(parsed: URL): boolean {
  const path = parsed.pathname.toLowerCase();
  return FEED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '.')
  );
}

export interface VisitUrlStatus {
  url: string | null;
  reason: string | null;
}

/**
 * Returns the safe visit URL and the reason it was blocked (if any).
 * Use this when you need richer feedback about why a URL is unavailable.
 */
export function getVisitUrlStatus(url: string | null | undefined): VisitUrlStatus {
  const trimmed = (url || '').trim();
  if (!trimmed || trimmed.startsWith('/')) {
    return { url: null, reason: 'invalid_or_empty_url' };
  }

  try {
    const parsed = new URL(trimmed);

    if (BLOCKED_SCHEMES.has(parsed.protocol.replace(':', ''))) {
      return { url: null, reason: 'non_http_asset_scheme' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { url: null, reason: 'non_http_scheme' };
    }

    if (isBlockedHost(parsed.hostname)) {
      return { url: null, reason: 'blocked_host' };
    }

    if (isGoogleAmp(parsed)) {
      return { url: null, reason: 'google_amp_url' };
    }

    if (isBlockedPath(parsed.pathname)) {
      return { url: null, reason: 'static_asset' };
    }

    if (isUtilityPage(parsed)) {
      return { url: null, reason: 'utility_page_url' };
    }

    if (isFeedOrRss(parsed)) {
      return { url: null, reason: 'rss_feed_endpoint' };
    }

    return { url: parsed.href, reason: null };
  } catch {
    return { url: null, reason: 'invalid_url_parse_error' };
  }
}

/**
 * Returns a safe visit URL string, or empty string if the URL is blocked.
 * Backwards-compatible with the original getSafeVisitUrl API.
 */
export function getSafeVisitUrl(url: string | null | undefined): string {
  return getVisitUrlStatus(url).url || '';
}
