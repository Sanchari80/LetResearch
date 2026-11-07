import { useEffect, useRef, useState } from 'react';
import { feedback } from '@/lib/feedback';
import { useInstall } from '@/lib/install';
import { isTouchDevice } from '@/lib/pickers';
import { IconRefresh } from '../icons';
import styles from './PullToRefresh.module.css';

const TRIGGER = 64;
const MAX = 110;

/**
 * Pull down at the top of a page to refresh it. Browsers in a normal tab already do this
 * by reloading, so it only runs in the installed app on touch screens, where they don't.
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> | unknown }) {
  const standalone = useInstall((s) => s.standalone);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const busy = useRef(false);

  useEffect(() => {
    if (!standalone || !isTouchDevice()) return;
    let startY: number | null = null;
    let distance = 0;

    const onStart = (event: TouchEvent) => {
      startY = window.scrollY <= 0 && !busy.current && event.touches.length === 1 ? event.touches[0].clientY : null;
      distance = 0;
    };
    const onMove = (event: TouchEvent) => {
      if (startY === null) return;
      const dy = event.touches[0].clientY - startY;
      if (dy <= 0 || window.scrollY > 0) {
        distance = 0;
        setPull(0);
        return;
      }
      distance = Math.min(MAX, dy * 0.5);
      setPull(distance);
    };
    const onEnd = async () => {
      if (startY === null) return;
      startY = null;
      if (distance < TRIGGER) {
        setPull(0);
        return;
      }
      busy.current = true;
      setRefreshing(true);
      setPull(TRIGGER);
      feedback.tap();
      try {
        await refreshRef.current();
      } finally {
        busy.current = false;
        setRefreshing(false);
        setPull(0);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [standalone]);

  if (!pull && !refreshing) return null;
  const ready = pull >= TRIGGER;
  return (
    <div
      className={`${styles.indicator} ${refreshing ? styles.refreshing : ''}`}
      style={{ transform: `translate(-50%, ${pull}px)`, opacity: Math.min(1, pull / TRIGGER) }}
      role={refreshing ? 'status' : undefined}
      aria-label={refreshing ? 'Refreshing' : undefined}
    >
      <span className={styles.icon} style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}>
        <IconRefresh size={20} color={ready || refreshing ? 'var(--accent)' : 'var(--text2)'} aria-hidden />
      </span>
    </div>
  );
}
