import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/lib/hooks';
import { IconX } from '../icons';
import styles from './Lightbox.module.css';

/** Full-screen image viewer with a zoom-in entrance. Escape or a click outside closes it. */
export function Lightbox({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  useScrollLock(!!uri);
  useEffect(() => {
    if (!uri) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [uri, onClose]);

  return createPortal(
    <AnimatePresence>
      {uri ? (
        <motion.div
          className={styles.backdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.img
            src={uri}
            alt=""
            className={styles.image}
            initial={{ scale: 0.86, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          />
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            <IconX size={22} color="#fff" aria-hidden />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
