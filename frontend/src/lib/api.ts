import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Dev-only: log API base so we know where requests go
if (process.env.NODE_ENV !== 'production') {
  console.log('[API] API_BASE_URL =', API_URL);
} else if (!process.env.NEXT_PUBLIC_API_URL) {
  console.error('[API] NEXT_PUBLIC_API_URL is not configured! Falling back to localhost.');
}

export const api = axios.create({
  baseURL: API_URL,
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

// Response interceptor: log full backend error detail for debugging
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string | any[] }>) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const url = error.config?.url;
    const method = error.config?.method?.toUpperCase();
    const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
    console.error(`[API Error] ${method} ${url} → ${status}:`, msg || error.message);
    return Promise.reject(error);
  }
);

/** Extract readable error message from axios error, including HTTP status. */
export function getErrorMessage(error: any, fallback = 'Lỗi không xác định'): string {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  let msg = fallback;
  if (typeof detail === 'string' && detail) {
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
  summary: async () => {
    const response = await api.get('/api/dashboard/summary');
    return response.data;
  },
  trends: async (range: string = '7d') => {
    const response = await api.get('/api/dashboard/trends', { params: { range } });
    return response.data;
  },
  sentimentSummary: async (range: string = '7d') => {
    const response = await api.get('/api/dashboard/sentiment-summary', { params: { range } });
    return response.data;
  },
  hotKeywords: async (range: string = '7d') => {
    const response = await api.get('/api/dashboard/hot-keywords', { params: { range } });
    return response.data;
  },
  sidebarBadges: async () => {
    const response = await api.get('/api/dashboard/sidebar-badges');
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
  createKeyword: async (data: { group_id: number; keyword: string; is_active?: boolean }) => {
    const response = await api.post('/api/keywords/keywords', data);
    return response.data;
  },
  updateKeyword: async (id: number, data: any) => {
    const response = await api.put(`/api/keywords/keywords/${id}`, data);
    return response.data;
  },
  deleteKeyword: async (id: number) => {
    const response = await api.delete(`/api/keywords/keywords/${id}`);
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
  manualScan: async (data: { keyword_group_ids: number[]; source_ids?: number[]; url?: string }) => {
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
  retryJob: async (jobId: number) => {
    const response = await api.post(`/api/crawl/jobs/${jobId}/retry`);
    return response.data;
  },
  getWorkerStatus: async () => {
    const response = await api.get('/api/crawl/worker-status');
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

// ─── Monitor (Giám sát từ khóa thời gian thực) ───────────────────────────────
export const monitor = {
  /**
   * Bắt đầu theo dõi từ khóa: tạo mock data + sentiment analysis
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
