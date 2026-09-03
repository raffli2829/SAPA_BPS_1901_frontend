// ============================================================
// SAPA BPS 1901 IN — Backend API Client Integration
// ============================================================

import {
  Dataset,
  DataRecord,
  ReviewRequest,
  AuditLog,
  User,
  Category,
  DashboardSummary,
} from './types';

// ============================================================
// Konfigurasi Terpusat Base URL Backend WhatsApp & REST API
// ============================================================
const isClient = typeof window !== 'undefined';
const isLocalOrigin = isClient && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.')
);

const PUBLIC_BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
const LOCAL_BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:80').replace(/\/$/, '');
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

// Target primer: URL relatif untuk Next.js server rewrite jika di lingkungan lokal,
// atau PUBLIC_BACKEND_URL jika di hosting publik luar.
const RAW_BACKEND_URL = isLocalOrigin
  ? ''
  : (PUBLIC_BACKEND_URL || LOCAL_BACKEND_URL || (isClient ? '' : (process.env.BACKEND_INTERNAL_URL || 'http://localhost:80')));

const BASE_URL = RAW_BACKEND_URL ? RAW_BACKEND_URL.replace(/\/$/, '') : '';

export function getEffectiveBackendUrl(): string {
  if (!isClient) return LOCAL_BACKEND_URL || 'http://localhost:80';
  if (isLocalOrigin) return window.location.origin + ' (Port 80 Proxy)';
  return PUBLIC_BACKEND_URL || window.location.origin;
}

async function safeFetch<T>(url: string, options?: RequestInit): Promise<T | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  const path = url.startsWith('/') ? url : `/${url}`;
  const fullUrl = url.startsWith('http')
    ? url
    : (BASE_URL ? `${BASE_URL}${path}` : path);

  try {
    const res = await fetch(fullUrl, {
      cache: 'no-store',
      ...options,
      headers,
    });

    if (res.ok) {
      const json = await res.json();
      return json?.data !== undefined ? json.data : json;
    }

    // Fallback tier 1: Jika proxy lokal mengembalikan error atau 502/500, coba tembak langsung port 80 backend
    if (isLocalOrigin && !fullUrl.startsWith(LOCAL_BACKEND_URL)) {
      try {
        const directRes = await fetch(`${LOCAL_BACKEND_URL}${path}`, { ...options, headers });
        if (directRes.ok) {
          const json = await directRes.json();
          return json?.data !== undefined ? json.data : json;
        }
      } catch {}
    }

    // Fallback tier 2: Jika public ngrok URL tersedia dan berbeda dari fullUrl
    if (PUBLIC_BACKEND_URL && !fullUrl.startsWith(PUBLIC_BACKEND_URL)) {
      try {
        const ngrokRes = await fetch(`${PUBLIC_BACKEND_URL}${path}`, { ...options, headers });
        if (ngrokRes.ok) {
          const json = await ngrokRes.json();
          return json?.data !== undefined ? json.data : json;
        }
      } catch {}
    }

    console.warn(`[API] HTTP ${res.status} pada ${fullUrl}`);
    return null;
  } catch (err) {
    // Fallback saat fetch network error
    if (isLocalOrigin && !fullUrl.startsWith(LOCAL_BACKEND_URL)) {
      try {
        const directRes = await fetch(`${LOCAL_BACKEND_URL}${path}`, { ...options, headers });
        if (directRes.ok) {
          const json = await directRes.json();
          return json?.data !== undefined ? json.data : json;
        }
      } catch {}
    }
    if (PUBLIC_BACKEND_URL && !fullUrl.startsWith(PUBLIC_BACKEND_URL)) {
      try {
        const ngrokRes = await fetch(`${PUBLIC_BACKEND_URL}${path}`, { ...options, headers });
        if (ngrokRes.ok) {
          const json = await ngrokRes.json();
          return json?.data !== undefined ? json.data : json;
        }
      } catch {}
    }
    console.error(`[API Network Error] Gagal menghubungi backend di ${url}:`, err);
    return null;
  }
}

export const BackendApi = {
  // Datasets
  async getDatasets(): Promise<Dataset[] | null> {
    return safeFetch<Dataset[]>(`${BASE_URL}/api/backend/datasets`);
  },

  async getDatasetById(id: string): Promise<Dataset | null> {
    return safeFetch<Dataset>(`${BASE_URL}/api/backend/datasets/${id}`);
  },

  async createDataset(dataset: Partial<Dataset>): Promise<Dataset | null> {
    return safeFetch<Dataset>(`${BASE_URL}/api/backend/datasets`, {
      method: 'POST',
      body: JSON.stringify(dataset),
    });
  },

  async updateDataset(id: string, dataset: Partial<Dataset>): Promise<Dataset | null> {
    return safeFetch<Dataset>(`${BASE_URL}/api/backend/datasets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dataset),
    });
  },

  async deleteDataset(id: string): Promise<boolean> {
    const res = await safeFetch<{ success: boolean }>(`${BASE_URL}/api/backend/datasets/${id}`, {
      method: 'DELETE',
    });
    return !!res?.success;
  },

  // Records
  async getRecords(datasetId?: string): Promise<DataRecord[] | null> {
    const q = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    return safeFetch<DataRecord[]>(`${BASE_URL}/api/backend/records${q}`);
  },

  async createRecord(record: Partial<DataRecord>): Promise<DataRecord | null> {
    return safeFetch<DataRecord>(`${BASE_URL}/api/backend/records`, {
      method: 'POST',
      body: JSON.stringify(record),
    });
  },

  async updateRecord(id: string, record: Partial<DataRecord>): Promise<DataRecord | null> {
    return safeFetch<DataRecord>(`${BASE_URL}/api/backend/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    });
  },

  async deleteRecord(id: string): Promise<boolean> {
    const res = await safeFetch<{ success: boolean }>(`${BASE_URL}/api/backend/records/${id}`, {
      method: 'DELETE',
    });
    return !!res?.success;
  },

  async bulkSaveRecords(datasetId: string, records: Partial<DataRecord>[]): Promise<DataRecord[] | null> {
    return safeFetch<DataRecord[]>(`${BASE_URL}/api/backend/records/bulk`, {
      method: 'POST',
      body: JSON.stringify({ dataset_id: datasetId, records }),
    });
  },

  // Reviews
  async getReviews(): Promise<ReviewRequest[] | null> {
    return safeFetch<ReviewRequest[]>(`${BASE_URL}/api/backend/reviews`);
  },

  async submitReview(data: {
    dataset_id: string;
    dataset_name?: string;
    record_ids?: string[];
    description?: string;
    submitted_by?: string;
  }): Promise<ReviewRequest | null> {
    return safeFetch<ReviewRequest>(`${BASE_URL}/api/backend/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async approveReview(id: string, reviewerId?: string): Promise<ReviewRequest | null> {
    return safeFetch<ReviewRequest>(`${BASE_URL}/api/backend/reviews/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewer_id: reviewerId }),
    });
  },

  async rejectReview(id: string, reviewerId?: string, reason?: string): Promise<ReviewRequest | null> {
    return safeFetch<ReviewRequest>(`${BASE_URL}/api/backend/reviews/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reviewer_id: reviewerId, reason }),
    });
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[] | null> {
    return safeFetch<AuditLog[]>(`${BASE_URL}/api/backend/audit-logs`);
  },

  async logAudit(log: Partial<AuditLog>): Promise<AuditLog | null> {
    return safeFetch<AuditLog>(`${BASE_URL}/api/backend/audit-logs`, {
      method: 'POST',
      body: JSON.stringify(log),
    });
  },

  // Users & Categories & Summary
  async getUsers(): Promise<User[] | null> {
    return safeFetch<User[]>(`${BASE_URL}/api/backend/users`);
  },

  async createUser(user: Partial<User>): Promise<User | null> {
    return safeFetch<User>(`${BASE_URL}/api/backend/users`, {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  async updateUser(id: string, user: Partial<User>): Promise<User | null> {
    return safeFetch<User>(`${BASE_URL}/api/backend/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  },

  async deleteUser(id: string): Promise<boolean> {
    const res = await safeFetch<{ success: boolean }>(`${BASE_URL}/api/backend/users/${id}`, {
      method: 'DELETE',
    });
    return !!res?.success;
  },

  async getCategories(): Promise<Category[] | null> {
    return safeFetch<Category[]>(`${BASE_URL}/api/backend/categories`);
  },

  async createCategory(category: Partial<Category>): Promise<Category | null> {
    return safeFetch<Category>(`${BASE_URL}/api/backend/categories`, {
      method: 'POST',
      body: JSON.stringify(category),
    });
  },

  async syncStore(snapshot: {
    datasets?: Dataset[];
    records?: DataRecord[];
    categories?: Category[];
    users?: User[];
    reviews?: ReviewRequest[];
    auditLogs?: AuditLog[];
  }): Promise<{
    datasets: Dataset[];
    records: DataRecord[];
    categories: Category[];
    users: User[];
    reviews: ReviewRequest[];
    auditLogs: AuditLog[];
  } | null> {
    return safeFetch<{
      datasets: Dataset[];
      records: DataRecord[];
      categories: Category[];
      users: User[];
      reviews: ReviewRequest[];
      auditLogs: AuditLog[];
    }>(`${BASE_URL}/api/backend/sync/store`, {
      method: 'POST',
      body: JSON.stringify(snapshot),
    });
  },

  async getDashboardSummary(): Promise<DashboardSummary | null> {
    return safeFetch<DashboardSummary>(`${BASE_URL}/api/backend/dashboard/summary`);
  },

  // Health Check & Diagnostics
  async getHealth(): Promise<{
    status: string;
    service: string;
    port: string;
    timestamp: string;
    uptime: number;
    botState: string;
    phoneNumber: string | null;
  } | null> {
    return safeFetch<{
      status: string;
      service: string;
      port: string;
      timestamp: string;
      uptime: number;
      botState: string;
      phoneNumber: string | null;
    }>(`${BASE_URL}/health?_t=${Date.now()}`, { cache: 'no-store' });
  },

  // Bot Status & Chat Integration
  async getBotStatus(): Promise<{
    state: 'connecting' | 'connected' | 'qr_ready' | 'disconnected';
    qr: string | null;
    phoneNumber?: string;
    connectedAt?: string;
    qrUpdatedAt?: number;
    serverTime?: string;
  } | null> {
    return safeFetch<{
      state: 'connecting' | 'connected' | 'qr_ready' | 'disconnected';
      qr: string | null;
      phoneNumber?: string;
      connectedAt?: string;
      qrUpdatedAt?: number;
      serverTime?: string;
    }>(`${BASE_URL}/api/bot/status?_t=${Date.now()}`, { cache: 'no-store' });
  },

  async resetBotSession(): Promise<{ success: boolean; message: string } | null> {
    return safeFetch<{ success: boolean; message: string }>(`${BASE_URL}/api/bot/reset`, {
      method: 'POST',
    });
  },

  async logoutBot(): Promise<{ success: boolean; message: string } | null> {
    return safeFetch<{ success: boolean; message: string }>(`${BASE_URL}/api/bot/logout`, {
      method: 'POST',
    });
  },

  async requestPairingCode(phone: string): Promise<{ success: boolean; code?: string; message?: string } | null> {
    return safeFetch<{ success: boolean; code?: string; message?: string }>(`${BASE_URL}/api/bot/pairing-code`, {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  async sendChatMessage(message: string): Promise<{ response: string } | null> {
    return safeFetch<{ response: string }>(`${BASE_URL}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async getFaqs(): Promise<Array<{ pertanyaan: string; jawaban: string }> | null> {
    return safeFetch<Array<{ pertanyaan: string; jawaban: string }>>(`${BASE_URL}/api/faqs`);
  },

  async saveFaq(pertanyaan: string, jawaban: string, old_pertanyaan?: string): Promise<{ status: string; message: string } | null> {
    return safeFetch<{ status: string; message: string }>(`${BASE_URL}/api/faqs/save`, {
      method: 'POST',
      body: JSON.stringify({ pertanyaan, jawaban, old_pertanyaan }),
    });
  },

  async deleteFaq(pertanyaan: string): Promise<{ status: string; message: string } | null> {
    return safeFetch<{ status: string; message: string }>(`${BASE_URL}/api/faqs/delete`, {
      method: 'POST',
      body: JSON.stringify({ pertanyaan }),
    });
  }
};
