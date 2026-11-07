export const APP_NAME = 'LetResearch';
export const PUBLISHER = 'SKT Software Land';
export const APP_VERSION = '1.0.0';

const trimSlash = (value: string) => value.replace(/\/+$/, '');

/**
 * During local development the API runs on port 4000 of the same computer. Using the page's
 * host name means a phone that opens http://<computer-ip>:5173 reaches the API too.
 */
function developmentApiUrl() {
  if (typeof window === 'undefined') return 'http://localhost:4000';
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

export const API_URL = trimSlash((import.meta.env.VITE_API_URL as string | undefined) || developmentApiUrl());

/** The website's own address – shared profile, post and paper links point here. */
export const WEB_URL = typeof window === 'undefined' ? '' : window.location.origin;

/** Optional link to an Android app file (APK). When set, the website offers it as a download. */
export const ANDROID_APK_URL = ((import.meta.env.VITE_ANDROID_APK_URL as string | undefined) || '').trim();

/** Turns a server path such as /api/files/123 into a full URL. */
export function fileUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^(https?:|blob:|data:|file:)/.test(path)) return path;
  return `${API_URL}${path}`;
}

/** Public link to a researcher's profile – opens in any browser. */
export function profileLink(username: string) {
  return `${WEB_URL}/u/${username}`;
}

export function postLink(postId: string) {
  return `${WEB_URL}/post/${postId}`;
}

export function paperLink(paperId: string) {
  return `${WEB_URL}/paper/${paperId}`;
}
