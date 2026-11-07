import { AnimatePresence, motion } from 'motion/react';
import { useSyncExternalStore } from 'react';
import { IconWifiOff } from '../icons';
import styles from './OfflineBanner.module.css';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/** A slim notice while the device has no internet connection. The app itself still opens offline. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  return (
    <AnimatePresence>
      {!online ? (
        <motion.div
          key="offline"
          className={styles.banner}
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        >
          <IconWifiOff size={15} aria-hidden />
          <span>You're offline. Showing what was already loaded.</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
