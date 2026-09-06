import {
  BatchSummary,
  EvaluationMetricsResponse,
  ExceptionListResponse,
  ReconRecordListResponse,
  RecordDetail,
} from './types';

const PROD_BACKEND_URL = 'https://reconcilex-production.up.railway.app/api';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000/api'
      : PROD_BACKEND_URL
    : process.env.NODE_ENV === 'production'
    ? PROD_BACKEND_URL
    : 'http://localhost:8000/api');

async function fetchJSON<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const err = await res.json();
      errorDetail = err.detail || err.message || errorDetail;
    } catch {
      // fallback
    }
    throw new Error(`API Error [${res.status}]: ${errorDetail}`);
  }

  return res.json();
}

export const api = {
  // Batches
  getBatches: () => fetchJSON<BatchSummary[]>('/batches'),
  listBatches: () => fetchJSON<BatchSummary[]>('/batches'),

  getBatchSummary: (batchId: string) =>
    fetchJSON<BatchSummary>(`/batches/${batchId}/summary`),

  runDemoBatch: async () => {
    const url = `${API_BASE}/batches/demo`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to trigger demo batch');
    }
    return res.json();
  },

  clearAllBatches: async () => {
    const url = `${API_BASE}/batches/clear`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to clear reconciliation batches');
    }
    return res.json();
  },

  uploadBatch: async (formData: FormData) => {
    const url = `${API_BASE}/batches`;
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload batch');
    }
    return res.json();
  },

  // Records
  getRecords: (
    batchId: string,
    params?: {
      recon_level?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ) => {
    const q = new URLSearchParams();
    if (params?.recon_level) q.append('recon_level', params.recon_level);
    if (params?.status) q.append('status', params.status);
    if (params?.page) q.append('page', String(params.page));
    if (params?.limit) q.append('limit', String(params.limit));
    return fetchJSON<ReconRecordListResponse>(`/batches/${batchId}/records?${q.toString()}`);
  },

  getExceptions: (
    batchId: string,
    params?: {
      page?: number;
      limit?: number;
    }
  ) => {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', String(params.page));
    if (params?.limit) q.append('limit', String(params.limit));
    return fetchJSON<ExceptionListResponse>(`/batches/${batchId}/exceptions?${q.toString()}`);
  },

  getRecordDetail: (recordId: string) =>
    fetchJSON<RecordDetail>(`/records/${recordId}`),

  // Export URL
  getExportUrl: (batchId: string, format: 'csv' | 'json' = 'csv', type: 'all' | 'exceptions' = 'all') =>
    `${API_BASE}/batches/${batchId}/export?format=${format}&type=${type}`,

  // Evaluation
  getEvaluationMetrics: () =>
    fetchJSON<EvaluationMetricsResponse>('/evaluation/metrics'),

  // Health
  checkHealth: () => fetchJSON<{ status: string }>('/health'),
};
