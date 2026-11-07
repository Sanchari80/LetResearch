// "Install the app" support: the browser's own install dialog, the device type (for
// step-by-step instructions), service worker registration and app updates.
import { registerSW } from 'virtual:pwa-register';
import { create } from 'zustand';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** index.html keeps the browser's install offer here until the app uses it. */
type InstallWindow = Window & { __letresearchInstallPrompt?: InstallPromptEvent };

export type InstallDevice = 'ios' | 'android' | 'desktop';

interface InstallState {
  /** Running as an installed app (from the home screen or the desktop). */
  standalone: boolean;
  /** The browser can show its own install dialog. */
  canPrompt: boolean;
  device: InstallDevice;
  /** Opened inside another app's link viewer (Facebook, Messenger, Instagram…), which cannot install apps. */
  inAppBrowser: boolean;
}

function detectDevice(): InstallDevice {
  const ua = navigator.userAgent || '';
  // iPadOS reports itself as a Mac, but Macs have no touch screen.
  const iPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/i.test(ua) || iPad) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

export function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}

function detectInAppBrowser() {
  return /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Line\/|LinkedInApp/i.test(navigator.userAgent || '');
}

export const useInstall = create<InstallState>(() => ({
  standalone: isStandalone(),
  canPrompt: !!(window as InstallWindow).__letresearchInstallPrompt,
  device: detectDevice(),
  inAppBrowser: detectInAppBrowser(),
}));

window.addEventListener('letresearch:installable', () => useInstall.setState({ canPrompt: true }));
window.addEventListener('appinstalled', () => {
  (window as InstallWindow).__letresearchInstallPrompt = undefined;
  useInstall.setState({ canPrompt: false });
});
window
  .matchMedia?.('(display-mode: standalone)')
  .addEventListener?.('change', (event) => useInstall.setState({ standalone: event.matches }));

/** Opens the browser's install dialog. Resolves to null when the browser has none to offer. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | null> {
  const w = window as InstallWindow;
  const event = w.__letresearchInstallPrompt;
  if (!event) return null;
  // The browser allows each offer to be used once.
  w.__letresearchInstallPrompt = undefined;
  useInstall.setState({ canPrompt: false });
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Service worker and updates
// ---------------------------------------------------------------------------

interface UpdateState {
  /** A new version has been downloaded and is waiting. */
  needRefresh: boolean;
  applyUpdate: () => void;
  dismiss: () => void;
}

export const useAppUpdate = create<UpdateState>((set) => ({
  needRefresh: false,
  applyUpdate: () => window.location.reload(),
  dismiss: () => set({ needRefresh: false }),
}));

/** Registers the service worker that makes LetResearch installable and work offline. */
export function registerServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      useAppUpdate.setState({ needRefresh: true, applyUpdate: () => updateSW(true) });
    },
    onRegisteredSW(_url, registration) {
      // Look for a new version every hour while the app stays open.
      if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
}
