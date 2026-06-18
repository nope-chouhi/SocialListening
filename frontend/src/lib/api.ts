import axios, { AxiosError } from 'axios';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const BACKEND_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

/** Exported so debug panels can show the configured backend URL */
export const API_BASE_URL = BACKEND_URL;

// In production, requests go through Next.js rewrites (same-origin proxy).
// In dev, requests also go through Next.js rewrites (configured in next.config.js).
// No baseURL needed — all /api/* paths are relative to the current origin.
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL) {
  console.error('[API] NEXT_PUBLIC_API_URL is not configured! Rewrites will proxy to localhost:8000.');
}

export const api = axios.create({
  // No baseURL — requests go to same origin, proxied by Next.js rewrites
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Track if we're already handling a 401 redirect to prevent duplicate redirects
let isRedirectingToLogin = false;

/** Reset the redirect lock (call after successful login) */
export function resetAuthRedirectLock() {
  isRedirectingToLogin = false;
}

// Response interceptor: handle 401 globally + log errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string | any[] }>) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const url = error.config?.url;
    const method = error.config?.method?.toUpperCase();
    const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
    
    if (process.env.NODE_ENV === 'production') {
      console.error(`[API Error] ${method} ${url} → ${status}`);
    } else {
      console.error(`[API Error] ${method} ${url} → ${status}:`, msg || error.message);
    }

    // Global 401 handler: clear token and redirect to login once.
    // For ALL 401 errors, swallow the rejection so downstream .catch() / toast.error
    // never fires — the user is about to be redirected anyway.
    if (status === 401) {
      if (!isRedirectingToLogin) {
        isRedirectingToLogin = true;
        localStorage.removeItem('access_token');
        // Use window.location for hard redirect — works from any context
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          console.warn('[API] Token expired/invalid — redirecting to login');
          window.location.href = '/login?expired=1';
        }
      }
      // Return a never-resolving promise to swallow the error silently
      return new Promise(() => {});
    }

    return Promise.reject(error);
  }
);

/** Check if an error is a 401 auth error — these are handled globally, so skip toasting. */
export function isAuthError(error: any): boolean {
  return error?.response?.status === 401;
}

/** Extract readable error message from axios error, including HTTP status. */
export function getErrorMessage(error: any, fallback = 'Lỗi không xác định'): string {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  const requestUrl = error?.config?.url || '';
  const fullUrl = error?.config?.baseURL ? `${error.config.baseURL}${requestUrl}` : requestUrl;

  // ── No response at all (Network Error / CORS / ad blocker / backend down) ──
  if (!error?.response && error?.message === 'Network Error') {
    return `Không kết nối được backend. Kiểm tra NEXT_PUBLIC_API_URL, CORS hoặc Render. URL: ${fullUrl}`;
  }

  // ── Specific HTTP status codes ──
  if (status === 401 || status === 403) {
    return 'Phiên đăng nhập chưa hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.';
  }

  if (status === 404) {
    return `Không tìm thấy API. Kiểm tra endpoint frontend/backend. URL: ${requestUrl}`;
  }

  if (status === 307 || status === 308) {
    return `API bị redirect (${status}). Kiểm tra dấu / cuối URL.`;
  }

  if (status === 500) {
    return 'Backend xử lý lỗi. Kiểm tra Render logs.';
  }

  // ── Parse detail from response body ──
  let msg = fallback;
  if (typeof detail === 'string' && detail) {
    // Backend CONFIG_REQUIRED pattern
    if (detail.startsWith('CONFIG_REQUIRED')) {
      return 'Chưa cấu hình Web Search provider (SerpAPI).';
    }
    msg = detail;
  } else if (Array.isArray(detail) && detail.length > 0) {
    msg = detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
  } else if (error?.message) {
    msg = error.message;
  }
  return status ? `${msg} (HTTP ${status})` : msg;
}

export function getUserFacingErrorMessage(
  error: any,
  productionFallback = 'Lỗi khi tải dữ liệu. Vui lòng kiểm tra backend hoặc database migration.'
): string {
  if (process.env.NODE_ENV === 'production') {
    return productionFallback;
  }
  return getErrorMessage(error, productionFallback);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const webinar = {
  register: async (data: { email: string; name: string; webinar_title: string; webinar_time: string; timezone: string }) => {
    const response = await api.post('/api/webinar/register', data);
    return response.data;
  }
};

export const auth = {
  login: async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    const response = await api.post('/api/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
    }
    return response.data;
  },
  getContext: async () => {
    const response = await api.get('/api/auth/me/context');
    return response.data;
  },
  register: async (email: string, password: string, full_name: string) => {
    const response = await api.post('/api/auth/register', { email, password, full_name });
    return response.data;
  },
  logout: () => {
    localStorage.removeItem('access_token');
  },
  getCurrentUser: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboard = {
  overview: async (projectId: number): Promise<any> => { const response = await api.get('/api/dashboard/overview', { params: { project_id: projectId } }); return response.data; },
  summary: async (range: string = '30d', projectId?: number) => {
    const params: any = { range };
    if (projectId) params.project_id = projectId;
    const response = await api.get('/api/dashboard/summary', { params });
    return response.data;
  },
  trends: async (range: string = '7d', projectId?: number) => {
    const params: any = { range };
    if (projectId) params.project_id = projectId;
    const response = await api.get('/api/dashboard/trends', { params });
    return response.data;
  },
  sentimentSummary: async (range: string = '7d', projectId?: number) => {
    const params: any = { range };
    if (projectId) params.project_id = projectId;
    const response = await api.get('/api/dashboard/sentiment-summary', { params });
    return response.data;
  },
  hotKeywords: async (range: string = '7d', projectId?: number) => {
    const params: any = { range };
    if (projectId) params.project_id = projectId;
    const response = await api.get('/api/dashboard/hot-keywords', { params });
    return response.data;
  },
  sidebarBadges: async () => {
    const response = await api.get('/api/dashboard/sidebar-badges');
    return response.data;
  },
  realtimeMetrics: async (projectId?: number, hours = 24) => {
    const response = await api.get('/api/realtime/metrics', {
      params: { project_id: projectId, hours },
    });
    return response.data;
  },
};

// ─── Keywords ────────────────────────────────────────────────────────────────
export const keywords = {
  listGroups: async () => {
    const response = await api.get('/api/keywords/groups');
    return response.data;
  },
  createGroup: async (data: { name: string; description?: string }) => {
    const response = await api.post('/api/keywords/groups', data);
    return response.data;
  },
  updateGroup: async (id: number, data: any) => {
    const response = await api.put(`/api/keywords/groups/${id}`, data);
    return response.data;
  },
  deleteGroup: async (id: number) => {
    const response = await api.delete(`/api/keywords/groups/${id}`);
    return response.data;
  },
  listKeywordsInGroup: async (groupId: number) => {
    const response = await api.get(`/api/keywords/groups/${groupId}/keywords`);
    return response.data;
  },
  createKeyword: async (data: { group_id: number; keyword: string; keyword_type?: string; is_active?: boolean; is_excluded?: boolean }) => {
    const response = await api.post('/api/keywords', data);
    return response.data;
  },
  createKeywordsBulk: async (data: { group_id: number; keywords: string[]; keyword_type?: string; is_active?: boolean; is_excluded?: boolean }) => {
    const response = await api.post('/api/keywords/bulk', data);
    return response.data;
  },
  updateKeyword: async (id: number, data: any) => {
    const response = await api.put(`/api/keywords/${id}`, data);
    return response.data;
  },
  deleteKeyword: async (id: number) => {
    const response = await api.delete(`/api/keywords/${id}`);
    return response.data;
  },
};

// ─── Sources ──────────────────────────────────────────────────────────────────
export const sources = {
  // Groups
  listGroups: async () => {
    const response = await api.get('/api/sources/groups');
    return response.data;
  },
  createGroup: async (data: { name: string; description?: string }) => {
    const response = await api.post('/api/sources/groups', data);
    return response.data;
  },
  updateGroup: async (id: number, data: any) => {
    const response = await api.put(`/api/sources/groups/${id}`, data);
    return response.data;
  },
  deleteGroup: async (id: number) => {
    const response = await api.delete(`/api/sources/groups/${id}`);
    return response.data;
  },
  // Sources
  list: async (params?: any) => {
    const response = await api.get('/api/sources', { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/sources/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    // Ensure meta_data field not metadata
    const payload = { ...data };
    if ('metadata' in payload) {
      payload.meta_data = payload.metadata;
      delete payload.metadata;
    }
    const response = await api.post('/api/sources', payload);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const payload = { ...data };
    if ('metadata' in payload) {
      payload.meta_data = payload.metadata;
      delete payload.metadata;
    }
    const response = await api.put(`/api/sources/${id}`, payload);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/sources/${id}`);
    return response.data;
  },
  test: async (id: number) => {
    const response = await api.post(`/api/sources/${id}/test`);
    return response.data;
  },
  scan: async (id: number) => {
    const response = await api.post(`/api/sources/${id}/scan`);
    return response.data;
  },
};

// ─── Crawl / Scan ─────────────────────────────────────────────────────────────
export const crawl = {
  getCapabilities: async () => {
    const response = await api.get('/api/crawl/capabilities');
    return response.data;
  },
  manualScan: async (data: { keyword_group_ids?: number[]; keywords?: string[]; source_ids?: number[]; url?: string; mode?: string; project_id?: number; max_results?: number; query?: string; source_types?: string[]; expand_keywords?: boolean; auto_triggered?: boolean; reason?: string; current_result_count?: number }) => {
    // Sent as a single JSON object — backend expects ManualScanRequest body
    const response = await api.post('/api/crawl/manual-scan', data);
    return response.data;
  },
  getScanHistory: async (page: number = 1, page_size: number = 20) => {
    const response = await api.get('/api/crawl/scan-history', { params: { page, page_size } });
    return response.data;
  },
  getJobs: async (page: number = 1, page_size: number = 20, status?: string) => {
    const response = await api.get('/api/crawl/jobs', { params: { page, page_size, status } });
    return response.data;
  },
  getJob: async (id: number) => {
    const response = await api.get(`/api/crawl/jobs/${id}`);
    return response.data;
  },
  retryJob: async (jobId: number) => {
    const response = await api.post(`/api/crawl/jobs/${jobId}/retry`);
    return response.data;
  },
  getWorkerStatus: async () => {
    const response = await api.get('/api/system/worker-status');
    return response.data;
  },
  getSchedulerStatus: async () => {
    const response = await api.get('/api/crawl/scheduler/status');
    return response.data;
  },
  testFeed: async (url: string) => {
    const response = await api.post('/api/crawl/test-feed', null, { params: { url } });
    return response.data;
  },
};

// ─── Mentions ─────────────────────────────────────────────────────────────────
export const mentions = {
  list: async (params?: any) => {
    const response = await api.get('/api/mentions', { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/mentions/${id}`);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/mentions/${id}`);
    return response.data;
  },
  analyze: async (id: number) => {
    const response = await api.post(`/api/mentions/${id}/analyze`);
    return response.data;
  },
  createAlert: async (id: number, data?: { title?: string; severity?: string }) => {
    const response = await api.post(`/api/mentions/${id}/create-alert`, null, { params: data });
    return response.data;
  },
  createIncident: async (id: number, data?: { title?: string; description?: string }) => {
    const response = await api.post(`/api/mentions/${id}/create-incident`, null, { params: data });
    return response.data;
  },
  markReviewed: async (id: number) => {
    const response = await api.post(`/api/mentions/${id}/mark-reviewed`);
    return response.data;
  },
  updateTags: async (id: number, tags: string[]) => {
    const response = await api.put(`/api/mentions/${id}/tags`, { tags });
    return response.data;
  },
  updateMute: async (id: number, is_muted: boolean) => {
    const response = await api.put(`/api/mentions/${id}/mute`, { is_muted });
    return response.data;
  },
  muteDomain: async (domain: string, project_id: number) => {
    const response = await api.post('/api/mentions/mute-domain', { domain, project_id });
    return response.data;
  },
  muteAuthor: async (author: string, project_id: number) => {
    const response = await api.post('/api/mentions/mute-author', { author, project_id });
    return response.data;
  },
  visit: async (id: number) => {
    const response = await api.post(`/api/mentions/${id}/visit`);
    return response.data;
  },
  updateSentiment: async (id: number, sentiment: string) => {
    const response = await api.put(`/api/mentions/${id}/sentiment`, { sentiment });
    return response.data;
  },
  exportCsv: async (params?: Record<string, unknown>) => {
    const response = await api.get('/api/mentions/export', {
      params,
      responseType: 'blob',
    });
    return response.data as Blob;
  },
  analyzeSentiment: async (text: string) => {
    const response = await api.post('/api/ai/sentiment', { text });
    return response.data;
  },
  summary: async (projectId?: number) => {
    const params: any = {};
    if (projectId) params.project_id = projectId;
    const response = await api.get('/api/mentions/summary', { params });
    return response.data;
  },
  addToReport: async (id: number, add: boolean) => {
    const response = await api.put(`/api/mentions/${id}/add-to-report`, { add_to_report: add });
    return response.data;
  },
  summarize: async (data: { mention_ids?: number[]; filters?: any; project_id?: number }) => {
    const response = await api.post('/api/mentions/summarize', data, { timeout: 20000 });
    return response.data;
  },
};

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alerts = {
  list: async (params?: any) => {
    const response = await api.get('/api/alerts', { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/alerts/${id}`);
    return response.data;
  },
  create: async (data: { title: string; severity: string; mention_id?: number; message?: string }) => {
    // Sends JSON body — matches AlertCreateBody on backend
    const response = await api.post('/api/alerts', data);
    return response.data;
  },
  acknowledge: async (id: number) => {
    const response = await api.post(`/api/alerts/${id}/acknowledge`);
    return response.data;
  },
  resolve: async (id: number) => {
    const response = await api.post(`/api/alerts/${id}/resolve`);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/alerts/${id}`);
    return response.data;
  },
  ignore: async (id: number) => {
    const response = await api.post(`/api/alerts/${id}/ignore`);
    return response.data;
  },
  createIncident: async (id: number, data?: { title?: string; description?: string }) => {
    const response = await api.post(`/api/alerts/${id}/create-incident`, null, { params: data });
    return response.data;
  },
  checkRules: async (data: { project_id?: number; name: string; rule_type: string; threshold: number; window_hours: number; is_active: boolean }) => {
    const response = await api.post('/api/alerts/check-rules', data);
    return response.data;
  },
};

// ─── Saved Filters ─────────────────────────────────────────────────────────────
export const savedFilters = {
  list: async (projectId?: number) => {
    const params: any = {};
    if (projectId) params.project_id = projectId;
    const response = await api.get('/api/saved-filters', { params });
    return response.data;
  },
  create: async (data: { name: string; filter_json: any; is_default?: boolean }, projectId?: number) => {
    const params: any = {};
    if (projectId) params.project_id = projectId;
    const response = await api.post('/api/saved-filters', data, { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/saved-filters/${id}`);
    return response.data;
  },
  update: async (id: number, data: { name?: string; filter_json?: any; is_default?: boolean }) => {
    const response = await api.put(`/api/saved-filters/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/saved-filters/${id}`);
    return response.data;
  },
};

// ─── Incidents ────────────────────────────────────────────────────────────────
export const incidents = {
  list: async (params?: any) => {
    const response = await api.get('/api/incidents', { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/incidents/${id}`);
    return response.data;
  },
  create: async (data: { title: string; description?: string; mention_id?: number; deadline?: string }) => {
    // Sends JSON body — matches IncidentCreateBody on backend
    const response = await api.post('/api/incidents', data);
    return response.data;
  },
  update: async (id: number, data: { title?: string; description?: string; status?: string; resolution_notes?: string; deadline?: string }) => {
    // Sends JSON body — matches IncidentUpdateBody on backend
    const response = await api.put(`/api/incidents/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/incidents/${id}`);
    return response.data;
  },
  close: async (id: number) => {
    const response = await api.post(`/api/incidents/${id}/close`);
    return response.data;
  },
  getLogs: async (id: number) => {
    const response = await api.get(`/api/incidents/${id}/logs`);
    return response.data;
  },
  addLog: async (id: number, data: { action: string; notes?: string }) => {
    const response = await api.post(`/api/incidents/${id}/logs`, data);
    return response.data;
  },
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reports = {
  overview: async (projectId: number): Promise<any> => { const response = await api.get('/api/dashboard/overview', { params: { project_id: projectId } }); return response.data; },
  summary: async () => {
    const response = await api.get('/api/reports/summary');
    return response.data;
  },
  list: async (params?: any) => {
    const response = await api.get('/api/reports', { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/reports/${id}`);
    return response.data;
  },
  create: async (data: { report_type: string; title: string; description?: string; start_date: string; end_date: string }) => {
    const response = await api.post('/api/reports', data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/reports/${id}`);
    return response.data;
  },
};

// ─── Legal Response (Takedown) ────────────────────────────────────────────────
export const legalResponse = {
  generateDraft: async (data: {
    draft_type: string;
    platform?: string;
    content_url?: string;
    incident_summary?: string;
    brand_name?: string;
    contact_info?: Record<string, string>;
    additional_context?: string;
  }) => {
    const response = await api.post('/api/takedown/generate-draft', data);
    return response.data;
  },
  createRecord: async (data: { incident_id: number; platform: string; content_url: string; reason: string; description: string }) => {
    const response = await api.post('/api/takedown/records', data);
    return response.data;
  },
  listRecords: async (incident_id?: number) => {
    const response = await api.get('/api/takedown/records', { params: incident_id ? { incident_id } : undefined });
    return response.data;
  },
  updateStatus: async (record_id: number, status: string, platform_response?: string) => {
    const response = await api.put(`/api/takedown/records/${record_id}/status`, { status, platform_response });
    return response.data;
  },
};

// ─── Services ─────────────────────────────────────────────────────────────────
export const services = {
  // Categories
  listCategories: async () => {
    const response = await api.get('/api/services/categories');
    return response.data;
  },
  createCategory: async (data: any) => {
    const response = await api.post('/api/services/categories', data);
    return response.data;
  },
  updateCategory: async (id: number, data: any) => {
    const response = await api.put(`/api/services/categories/${id}`, data);
    return response.data;
  },
  deleteCategory: async (id: number) => {
    const response = await api.delete(`/api/services/categories/${id}`);
    return response.data;
  },
  // Services catalog
  list: async (params?: any) => {
    const response = await api.get('/api/services', { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/services/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/api/services', data);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const response = await api.put(`/api/services/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/services/${id}`);
    return response.data;
  },
  getDashboardSummary: async () => {
    const response = await api.get('/api/services/dashboard-summary');
    return response.data;
  },
};

// ─── Service Requests (separate prefix to avoid routing conflict) ──────────────
export const serviceRequests = {
  list: async (params?: any) => {
    // Uses /api/service-requests (not /api/services/requests) to avoid FastAPI path conflict
    const response = await api.get('/api/service-requests', { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/service-requests/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/api/service-requests', data);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const response = await api.put(`/api/service-requests/${id}`, data);
    return response.data;
  },
  submit: async (id: number, data?: any) => {
    const response = await api.post(`/api/service-requests/${id}/submit`, data || {});
    return response.data;
  },
  approve: async (id: number, data?: any) => {
    const response = await api.post(`/api/service-requests/${id}/approve`, data || {});
    return response.data;
  },
  reject: async (id: number, data: { note: string }) => {
    const response = await api.post(`/api/service-requests/${id}/reject`, data);
    return response.data;
  },
  complete: async (id: number, data: { result_summary: string; note?: string }) => {
    const response = await api.post(`/api/service-requests/${id}/complete`, data);
    return response.data;
  },
  cancel: async (id: number, data: { note: string }) => {
    const response = await api.post(`/api/service-requests/${id}/cancel`, data);
    return response.data;
  },
  getLogs: async (id: number) => {
    const response = await api.get(`/api/service-requests/${id}/logs`);
    return response.data;
  },
  addLog: async (id: number, data: any) => {
    const response = await api.post(`/api/service-requests/${id}/logs`, data);
    return response.data;
  },
  getDeliverables: async (id: number) => {
    const response = await api.get(`/api/service-requests/${id}/deliverables`);
    return response.data;
  },
  createDeliverable: async (id: number, data: any) => {
    const response = await api.post(`/api/service-requests/${id}/deliverables`, data);
    return response.data;
  },
};

// ─── Monitor (Giám sát từ khóa — quét nguồn thật) ─────────────────────────────
export const monitor = {
  /**
   * Bắt đầu theo dõi từ khóa: lưu keyword + quét nguồn thật
   * POST /api/monitor/start
   */
  startTracking: async (keyword: string) => {
    const response = await api.post('/api/monitor/start', { keyword });
    return response.data;
  },

  /**
   * Lấy dashboard tổng hợp cho từ khóa
   * GET /api/monitor/dashboard?keyword={keyword}
   */
  getDashboard: async (keyword: string) => {
    const response = await api.get('/api/monitor/dashboard', { params: { keyword } });
    return response.data;
  },

  /**
   * Phân tích AI cảnh báo khủng hoảng cho từ khóa
   * GET /api/monitor/ai-analysis?keyword={keyword}
   */
  getAiAnalysis: async (keyword: string) => {
    const response = await api.get('/api/monitor/ai-analysis', { params: { keyword } });
    return response.data;
  },
};

// ─── AI (Executive Brief & etc) ───────────────────────────────────────────────
export const ai = {
  generateBrief: async (data: { mention_ids?: number[]; incident_id?: number }) => {
    const response = await api.post('/api/ai/generate-brief', data);
    return response.data;
  },
};

// ─── Evidence Locker ──────────────────────────────────────────────────────────
export const evidence = {
  list: async (incidentId: number) => {
    const response = await api.get(`/api/evidence/incident/${incidentId}`);
    return response.data;
  },
  create: async (incidentId: number, data: {
    file_name: string;
    file_path: string;
    file_type?: string;
    file_size?: number;
    capture_method?: string;
    original_url?: string;
    metadata?: string;
  }) => {
    const response = await api.post(`/api/evidence/${incidentId}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/evidence/${id}`);
    return response.data;
  },
};

// ─── AI Chat ──────────────────────────────────────────────────────────────────
export const aiChat = {
  chat: async (messages: { role: string; content: string }[]) => {
    const response = await api.post('/api/ai/chat', messages);
    return response.data;
  },
};

// ─── Competitors ─────────────────────────────────────────────────────────────
export const competitors = {
  overview: async (projectId: number): Promise<any> => { const response = await api.get('/api/dashboard/overview', { params: { project_id: projectId } }); return response.data; },
  summary: async () => {
    const response = await api.get('/api/competitors/summary');
    return response.data;
  },
};

// ─── Influencers ─────────────────────────────────────────────────────────────
export const influencers = {
  leaderboard: async () => {
    const response = await api.get('/api/influencers/leaderboard');
    return response.data;
  },
};

// ─── Reputation ─────────────────────────────────────────────────────────────
export const reputation = {
  listCases: async (params?: any) => {
    const response = await api.get('/api/reputation/cases', { params });
    return response.data;
  },
  getCase: async (id: number) => {
    const response = await api.get(`/api/reputation/cases/${id}`);
    return response.data;
  },
  createCase: async (data: any) => {
    const response = await api.post('/api/reputation/cases', data);
    return response.data;
  },
  updateCase: async (id: number, data: any) => {
    const response = await api.patch(`/api/reputation/cases/${id}`, data);
    return response.data;
  },
  createFromMention: async (mentionId: number) => {
    const response = await api.post(`/api/reputation/cases/from-mention/${mentionId}`);
    return response.data;
  },
  listEvidence: async (caseId: number) => {
    const response = await api.get(`/api/reputation/cases/${caseId}/evidence`);
    return response.data;
  },
  addEvidence: async (caseId: number, data: any) => {
    const response = await api.post(`/api/reputation/cases/${caseId}/evidence`, data);
    return response.data;
  },
  listActions: async (caseId: number) => {
    const response = await api.get(`/api/reputation/cases/${caseId}/actions`);
    return response.data;
  },
  addAction: async (caseId: number, data: any) => {
    const response = await api.post(`/api/reputation/cases/${caseId}/actions`, data);
    return response.data;
  },
  updateAction: async (actionId: number, data: any) => {
    const response = await api.patch(`/api/reputation/actions/${actionId}`, data);
    return response.data;
  },
  draftResponse: async (caseId: number) => {
    const response = await api.post(`/api/reputation/cases/${caseId}/draft-response`);
    return response.data;
  },
  draftCorrection: async (caseId: number) => {
    const response = await api.post(`/api/reputation/cases/${caseId}/draft-correction-request`);
    return response.data;
  },
  draftPlatformReport: async (caseId: number) => {
    const response = await api.post(`/api/reputation/cases/${caseId}/draft-platform-report`);
    return response.data;
  },
  draftExecutiveBrief: async (caseId: number) => {
    const response = await api.post(`/api/reputation/cases/${caseId}/executive-brief`);
    return response.data;
  },
};

// ─── Auto Discovery ───────────────────────────────────────────────────────────
export const discovery = {
  createJob: async (data: {
    keywords: string[];
    keyword_group_id?: number;
    exclude_keywords?: string[];
    language?: string;
    country?: string;
    limit?: number;
    date_range?: string;
  }) => {
    const response = await api.post('/api/discovery/jobs', data);
    return response.data;
  },
  listJobs: async (page: number = 1, page_size: number = 20) => {
    const response = await api.get('/api/discovery/jobs', { params: { page, page_size } });
    return response.data;
  },
  getJob: async (id: number) => {
    const response = await api.get(`/api/discovery/jobs/${id}`);
    return response.data;
  },
  connectorStatus: async () => {
    const response = await api.get('/api/discovery/connector-status');
    return response.data;
  },
};

// ─── Discovered Sources ───────────────────────────────────────────────────────
export const discoveredSources = {
  list: async (params?: any) => {
    const response = await api.get('/api/discovery/sources', { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/discovery/sources/${id}`);
    return response.data;
  },
  approveRss: async (id: number, data?: { name?: string }) => {
    const response = await api.post(`/api/discovery/sources/${id}/approve-rss`, data || {});
    return response.data;
  },
  approveWebsite: async (id: number, data?: { name?: string }) => {
    const response = await api.post(`/api/discovery/sources/${id}/approve-website`, data || {});
    return response.data;
  },
  reject: async (id: number) => {
    const response = await api.post(`/api/discovery/sources/${id}/reject`);
    return response.data;
  },
  block: async (id: number, data?: { reason?: string }) => {
    const response = await api.post(`/api/discovery/sources/${id}/block`, data || {});
    return response.data;
  },
  refreshRss: async (id: number) => {
    const response = await api.post(`/api/discovery/sources/${id}/refresh-rss-discovery`);
    return response.data;
  },
};

export const collectors = {
  run: (projectId?: number) => api.post(`/api/collectors/run${projectId ? `?project_id=${projectId}` : ''}`),
  runRss: async () => {
    const response = await api.post('/api/collectors/run/rss');
    return response.data;
  },
  getStatus: async () => {
    const response = await api.get('/api/collectors/status');
    return response.data;
  },
};



