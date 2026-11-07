import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { layout } from '@/theme';

function subscribeResize(callback: () => void) {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

/** Responsive helpers shared by every page. */
export function useLayout() {
  const width = useSyncExternalStore(
    subscribeResize,
    () => window.innerWidth,
    () => 1024,
  );
  return {
    width,
    isWide: width >= layout.wideBreakpoint,
    isTablet: width >= 600,
    isSmall: width < 370,
    columns: width >= 1280 ? 3 : width >= 700 ? 2 : 1,
  };
}

/** Sets the browser tab title. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} – LetResearch` : 'LetResearch';
  }, [title]);
}

const SHAKE: Keyframe[] = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-10px)', offset: 0.18 },
  { transform: 'translateX(9px)', offset: 0.4 },
  { transform: 'translateX(-6px)', offset: 0.62 },
  { transform: 'translateX(4px)', offset: 0.82 },
  { transform: 'translateX(0)' },
];

/**
 * A short horizontal shake for rejected input (wrong password, moderation, etc.).
 * Attach `shakeRef` to the element; `shake()` restarts the motion without re-rendering it,
 * so focus and typed text stay where they are.
 */
export function useShake<T extends HTMLElement = HTMLDivElement>() {
  const shakeRef = useRef<T | null>(null);
  const shake = useCallback(() => {
    const node = shakeRef.current;
    if (!node || typeof node.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    node.animate(SHAKE, { duration: 340, easing: 'ease' });
  }, []);
  return { shakeRef, shake };
}

/** Calls `onReach` when the sentinel element scrolls into view (infinite lists). */
export function useInfiniteScroll(onReach: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const callback = useRef(onReach);
  callback.current = onReach;
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) callback.current();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);
  return ref;
}

/** Runs `fn` when the page becomes visible again (the user switches back to the tab or app). */
export function useOnVisible(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === 'visible') ref.current();
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
}

function subscribeVisibility(callback: () => void) {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}

/** True while the page is on screen (not a background tab or a minimised app). */
export function usePageVisible() {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => true,
  );
}

/** Locks page scrolling while a sheet or viewer is open. */
let locks = 0;
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    locks += 1;
    const html = document.documentElement;
    if (locks === 1) {
      const scrollbar = window.innerWidth - html.clientWidth;
      html.style.overflow = 'hidden';
      if (scrollbar > 0) html.style.paddingRight = `${scrollbar}px`;
    }
    return () => {
      locks -= 1;
      if (locks === 0) {
        html.style.overflow = '';
        html.style.paddingRight = '';
      }
    };
  }, [active]);
}
