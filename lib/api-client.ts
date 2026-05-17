export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiResponse<T> {
  data: T;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(res.status, body.error ?? 'Request failed', body.details);
  }

  const body: ApiResponse<T> = await res.json();
  return body.data;
}

export const apiClient = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'DELETE', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
};

export const get = apiClient.get;
export const post = apiClient.post;
export const patch = apiClient.patch;
export const del = apiClient.delete;

export interface ImportResult {
  inserted: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; sku: string; reason: string }>;
}

export async function importProducts(file: File): Promise<ImportResult> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/products/import', { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new ApiError(res.status, body.error ?? 'Upload failed', body.details);
  }
  const body = await res.json();
  return body.data;
}
