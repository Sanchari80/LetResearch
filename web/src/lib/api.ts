import { API_URL } from './config';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: { reasons?: string[]; [key: string]: unknown };

  constructor(status: number, message: string, code?: string, details?: ApiError['details']) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get reasons(): string[] {
    return Array.isArray(this.details?.reasons) ? this.details!.reasons! : [];
  }
}

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

/** Called when the server rejects the saved session (expired or revoked token). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: Query) {
  let url = `${API_URL}${path}`;
  if (query) {
    const parts = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    if (parts.length) url += `${url.includes('?') ? '&' : '?'}${parts.join('&')}`;
  }
  return url;
}

function errorFrom(status: number, data: any) {
  const err = data?.error;
  if (status === 401 && authToken) unauthorizedHandler?.();
  return new ApiError(status, err?.message || `Request failed (${status}).`, err?.code, err?.details);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  timeoutMs?: number;
}

export async function api<T = any>(
  path: string,
  { method = 'GET', body, query, timeoutMs = 45000 }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  let payload: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), { method, headers, body: payload, signal: controller.signal });
  } catch {
    throw new ApiError(0, 'Cannot reach the LetResearch server. Check your internet connection and try again.', 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
  const raw = await response.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!response.ok) throw errorFrom(response.status, data);
  return data as T;
}

/** A file chosen in the browser, ready to upload. */
export interface UploadFile {
  /** Object URL for previews. */
  uri: string;
  name: string;
  type: string;
  size?: number;
  blob: Blob;
  /** Video duration in seconds, when known. */
  duration?: number;
}

interface UploadOptions {
  method?: 'POST' | 'PATCH' | 'PUT';
  fields?: Record<string, unknown>;
  files?: { field: string; file: UploadFile }[];
  onProgress?: (fraction: number) => void;
}

/** Multipart upload with progress (XMLHttpRequest reports upload progress; fetch does not). */
export function upload<T = any>(
  path: string,
  { method = 'POST', fields = {}, files = [], onProgress }: UploadOptions,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || value === null) continue;
      form.append(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
    for (const { field, file } of files) form.append(field, file.blob, file.name);
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_URL}${path}`);
    xhr.setRequestHeader('Accept', 'application/json');
    if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    xhr.timeout = 5 * 60 * 1000;
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) onProgress(Math.min(event.loaded / event.total, 1));
      };
    }
    xhr.onload = () => {
      let data: any = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve(data as T);
      } else {
        reject(errorFrom(xhr.status, data));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Upload failed. Check your internet connection and try again.', 'NETWORK'));
    xhr.ontimeout = () => reject(new ApiError(0, 'The upload took too long. Try a smaller file.', 'TIMEOUT'));
    xhr.send(form);
  });
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
