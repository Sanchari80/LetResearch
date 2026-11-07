// Navigation that works outside React components (actions, socket events, toasts).
// The router registers its navigate function at start-up.

type NavigateOptions = { replace?: boolean };
type NavigateFn = (to: string | number, options?: NavigateOptions) => void;

let navigateImpl: NavigateFn = (to, options) => {
  if (typeof to === 'number') window.history.go(to);
  else if (options?.replace) window.location.replace(to);
  else window.location.assign(to);
};

export function setNavigate(fn: NavigateFn) {
  navigateImpl = fn;
}

export function navigate(to: string, options?: NavigateOptions) {
  navigateImpl(to, options);
}

/** Moves through the browser history (-1 is the previous page). */
export function go(delta: number) {
  navigateImpl(delta);
}

/** Position of the current page in this tab's history (0 for the first page opened). */
export function historyIndex() {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === 'number' ? idx : 0;
}

/** True when there is an earlier page of this app to go back to. */
export function canGoBack() {
  return historyIndex() > 0;
}

/** Goes back when there is history, otherwise to a sensible page (e.g. after opening a shared link). */
export function goBack(fallback: string = '/') {
  if (canGoBack()) navigateImpl(-1);
  else navigateImpl(fallback, { replace: true });
}

const NEXT_KEY = 'letresearch.next';

/** Remembers the page a signed-out visitor tried to open, so sign-in can return there. */
export function rememberNext(path: string) {
  try {
    if (path && path !== '/' && path.startsWith('/')) sessionStorage.setItem(NEXT_KEY, path);
  } catch {
    // Ignore.
  }
}
export function peekNext() {
  try {
    const value = sessionStorage.getItem(NEXT_KEY);
    return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
  } catch {
    return null;
  }
}
export function clearNext() {
  try {
    sessionStorage.removeItem(NEXT_KEY);
  } catch {
    // Ignore.
  }
}
