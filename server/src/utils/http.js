// Small HTTP helpers shared by every route.

export class HttpError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, code = 'BAD_REQUEST', details) => new HttpError(400, message, code, details);
export const unauthorized = (message = 'Please sign in to continue.') => new HttpError(401, message, 'UNAUTHORIZED');
export const forbidden = (message = 'You do not have access to this.', code = 'FORBIDDEN') => new HttpError(403, message, code);
export const notFound = (message = 'Not found.') => new HttpError(404, message, 'NOT_FOUND');
export const conflict = (message, code = 'CONFLICT') => new HttpError(409, message, code);

/** Trims a string field and enforces a maximum length. Returns '' for empty values. */
export function cleanText(value, max = 500) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);
}

/** Accepts arrays or comma separated strings and returns a clean, de-duplicated list. */
export function cleanList(value, { maxItems = 20, maxLength = 60 } = {}) {
  let items = [];
  if (Array.isArray(value)) items = value;
  else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        items = JSON.parse(trimmed);
      } catch {
        items = trimmed.split(',');
      }
    } else items = trimmed.split(',');
  }
  const seen = new Set();
  const out = [];
  for (const raw of items) {
    const item = cleanText(raw, maxLength);
    const key = item.toLowerCase();
    if (item && !seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
    if (out.length >= maxItems) break;
  }
  return out;
}

export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseLimit(value, fallback = 20, max = 50) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export function parseBool(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

export function normalizeUrl(value) {
  const text = cleanText(value, 1000);
  if (!text) return '';
  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (!url.hostname.includes('.')) return '';
    return url.toString();
  } catch {
    return '';
  }
}
