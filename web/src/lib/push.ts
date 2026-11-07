// Web push: notifications that arrive while LetResearch is closed (Android, desktop browsers,
// and iPhone/iPad once the app is added to the Home Screen).
import { api } from './api';
import { isStandalone, useInstall } from './install';

export type PushStatus = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function base64ToBytes(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array) {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

async function registration(timeoutMs = 8000) {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('The app is still installing. Try again in a moment.')), timeoutMs),
    ),
  ]);
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) {
    return useInstall.getState().device === 'ios' && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

async function serverKey() {
  const result = await api<{ publicKey: string; enabled: boolean }>('/api/push/key');
  if (!result.enabled || !result.publicKey) throw new Error('Notifications are not set up on the server yet.');
  return base64ToBytes(result.publicKey);
}

/** Asks for permission (must run from a tap) and subscribes this browser for the signed-in user. */
export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser does not support notifications.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked. Allow them for this site in your browser settings.'
        : 'Notifications were not turned on.',
    );
  }
  const reg = await registration();
  const key = await serverKey();
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api('/api/push/subscribe', { method: 'POST', body: sub.toJSON() });
}

/** Stops notifications on this browser. */
export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api('/api/push/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** After signing in: if this browser already allows notifications, attach it to the new account. */
export async function syncPushSubscription() {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    let sub = await reg?.pushManager.getSubscription();
    if (!reg || !sub) return;
    const key = await serverKey();
    if (!sameKey(sub.options.applicationServerKey, key)) {
      await sub.unsubscribe().catch(() => {});
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }
    await api('/api/push/subscribe', { method: 'POST', body: sub.toJSON() });
  } catch {
    // Best effort – live in-app alerts still work.
  }
}

/** Before signing out: stop sending this account's notifications to this browser. */
export async function detachPushSubscription() {
  try {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await api('/api/push/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint }, timeoutMs: 4000 });
  } catch {
    // Ignore – the server also drops subscriptions that stop working.
  }
}

/** Shows the unread total on the installed app's icon, where the system supports it. */
export function setAppBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (count > 0) nav.setAppBadge?.(count)?.catch(() => {});
    else nav.clearAppBadge?.()?.catch(() => {});
  } catch {
    // Not supported – ignore.
  }
}
