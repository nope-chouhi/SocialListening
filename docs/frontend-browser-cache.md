# Frontend Browser Cache Configuration

## What is Cached
We have implemented safe, long-lived caching for static and public assets to ensure repeat visits load faster without risking stale data. 

Specifically, the following assets are cached with `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`:
- `/favicon.svg`
- `/manifest.json`

Next.js automatically handles immutable cache headers (`max-age=31536000, immutable`) for generated assets (JS, CSS chunks) inside `/_next/static/` and optimized images in `/_next/image/`, so they were intentionally left to the framework's optimized defaults.

## What is Intentionally Not Cached
- **API Responses (`/api/*`)**: Explicitly set to `no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`. This ensures that all data fetching routed through the Next.js frontend proxy (like mentions, reports, summary, auth status) is always fetched fresh from the backend.
- **Dynamic Pages & Dashboard HTML**: Next.js App Router defaults dynamic pages and authenticated routes to `no-store`. We avoided blanket caching on `/(.*)` to maintain this default safety.
- **PWA/Service Workers**: No complex Service Worker was introduced. HTTP cache headers provide sufficient caching for static assets without the risk and complexity of Service Worker lifecycle management, especially given the dynamic nature of a dashboard.

## Why Authenticated Data Must Not Be Cached Aggressively
Social Listening platforms involve sensitive user-specific data, role-based access control (RBAC), and real-time dashboard updates (mentions, sentiment, alerts). Aggressive caching of HTML or API responses could lead to:
- A user seeing data belonging to a previous session or a different project.
- Stale metrics that no longer reflect the real-time social listening state.
- Security vulnerabilities where a logged-out user could hit the back button and view cached sensitive reports.

## How to Verify Cache Headers in Browser DevTools
1. Open your browser's Developer Tools (F12 or Right-Click -> Inspect).
2. Go to the **Network** tab.
3. Ensure the "Disable cache" checkbox is **unchecked**.
4. Reload the page.
5. Click on static requests like `favicon.svg` or `manifest.json`.
6. In the **Headers** pane, under **Response Headers**, verify the `Cache-Control` header says `public, max-age=86400, stale-while-revalidate=604800`.
7. For any `/api/...` request, verify the `Cache-Control` header includes `no-store, no-cache`.

## Known Limitations
- The current implementation targets explicitly named files in the `public` directory. If a large number of new static assets (like custom fonts or other icons) are added directly to the `public/` directory (rather than imported in JS/CSS or using `next/image`), `next.config.js` may need to be updated to cover them or use an advanced matcher if needed. 
- Some browsers or intermediate network proxies may ignore or modify `stale-while-revalidate` directives, falling back to traditional `max-age` caching.
