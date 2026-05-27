/**
 * api/client.ts — typed API client for the FastAPI backend.
 * All requests go to the same origin (/auth, /upload, /jobs, /reports, /generate).
 * In development, Vite proxies these to http://localhost:8000.
 */

const TOKEN_KEY = 'ra_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('ra:logout'));
  }
  return res;
}

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers as object) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<string> {
  const data = await apiJson<{ access_token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.access_token);
  return data.access_token;
}

export async function register(username: string, password: string): Promise<string> {
  const data = await apiJson<{ access_token: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.access_token);
  return data.access_token;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch('/health');
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface UploadResponse {
  upload_id: string;
  job_id: string;
  files: string[];
}

export async function uploadFiles(files: File[], clientName: string): Promise<UploadResponse> {
  const form = new FormData();
  for (const f of files) {
    form.append('files', f, (f as any).webkitRelativePath || f.name);
  }
  form.append('client_name', clientName);
  const res = await apiFetch('/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload failed (HTTP ${res.status})`);
  }
  return res.json() as Promise<UploadResponse>;
}

// ─── Job polling ──────────────────────────────────────────────────────────────

export interface JobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress: number;
  error: string | null;
  extraction_id: string | null;
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return apiJson<JobStatus>(`/jobs/${jobId}`);
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface ReportSummary {
  id: string;
  job_id: string;
  folder_name: string;
  client_name: string | null;
  database_name: string | null;
  instance_name: string | null;
  report_date: string | null;
  total_files: number;
  extracted_at: string;
  flags: Flag[];
}

export interface ReportDetail extends ReportSummary {
  server_info: Record<string, string | null>;
  database_info: Record<string, string | null>;
  sections: Record<string, { tableColumns: string[]; tableRows: string[][] }>;
  cpu_utils: { columns: string[]; rows: string[][] };
}

export interface Flag {
  section: string;
  severity: 'critical' | 'warning';
  item: string;
  metric: string;
  value: string | number;
  threshold: string | number;
  message: string;
}

export interface ListReportsParams {
  client?: string;
  database?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export async function listReports(params: ListReportsParams = {}): Promise<ReportSummary[]> {
  const q = new URLSearchParams();
  if (params.client) q.set('client', params.client);
  if (params.database) q.set('database', params.database);
  if (params.from_date) q.set('from_date', params.from_date);
  if (params.to_date) q.set('to_date', params.to_date);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  return apiJson<ReportSummary[]>(`/reports?${q}`);
}

export async function getReport(id: string): Promise<ReportDetail> {
  return apiJson<ReportDetail>(`/reports/${id}`);
}

export async function deleteReport(id: string): Promise<void> {
  const res = await apiFetch(`/reports/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete failed (HTTP ${res.status})`);
  }
}

// ─── Generate ─────────────────────────────────────────────────────────────────

export interface GenerateSection {
  id: string;
  name: string;
  tableColumns: string[];
  tableRows: string[][];
  contentType?: string;
  recommendation?: string;
  screenshots?: string[];
  cpuData?: { columns: string[]; rows: string[][] };
  chartImageDataList?: string[];
}

export interface GenerateOptions {
  extraction_id: string;
  clientName?: string;
  period?: string;
  authorName?: string;
  docDate?: string;
  docVersion?: string;
  dataCollectionDate?: string;
  sections?: GenerateSection[];
  serverInfo?: Record<string, string | null>;
  databaseInfo?: Record<string, string | null>;
  logoData?: string | null;
  clientLogoData?: string | null;
  dbsSections?: (GenerateSection[] | null)[];
  cpu_chart_images?: string[];
  cpu_chart_images_per_db?: (string[] | null)[];
}

export async function generateReport(opts: GenerateOptions): Promise<void> {
  const res = await apiFetch('/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      extraction_id: opts.extraction_id,
      meta: {
        clientName: opts.clientName || '',
        period: opts.period || '',
      },
      reportData: {
        authorName: opts.authorName || '',
        docDate: opts.docDate || '',
        docVersion: opts.docVersion || '',
        dataCollectionDate: opts.dataCollectionDate || '',
        ...(opts.sections ? { sections: opts.sections } : {}),
      },
      ...(opts.serverInfo ? { serverInfo: opts.serverInfo } : {}),
      ...(opts.databaseInfo ? { databaseInfo: opts.databaseInfo } : {}),
      logoData: opts.logoData || null,
      clientLogoData: opts.clientLogoData || null,
      ...(opts.cpu_chart_images?.length ? { cpu_chart_images: opts.cpu_chart_images } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Generate failed (HTTP ${res.status})`);
  }
  // Trigger file download
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : 'report.docx';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function generateCombined(extractionIds: string[], opts: GenerateOptions): Promise<void> {
  const res = await apiFetch('/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      extraction_ids: extractionIds,
      mode: 'combined',
      ...(opts.dbsSections ? { dbs_sections: opts.dbsSections } : {}),
      meta: {
        clientName: opts.clientName || '',
        period: opts.period || '',
      },
      reportData: {
        authorName: opts.authorName || '',
        docDate: opts.docDate || '',
        docVersion: opts.docVersion || '',
        dataCollectionDate: opts.dataCollectionDate || '',
      },
      ...(opts.serverInfo ? { serverInfo: opts.serverInfo } : {}),
      ...(opts.databaseInfo ? { databaseInfo: opts.databaseInfo } : {}),
      logoData: opts.logoData || null,
      clientLogoData: opts.clientLogoData || null,
      ...(opts.cpu_chart_images_per_db?.some(Boolean) ? { cpu_chart_images_per_db: opts.cpu_chart_images_per_db } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Generate failed (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : 'combined_report.docx';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
