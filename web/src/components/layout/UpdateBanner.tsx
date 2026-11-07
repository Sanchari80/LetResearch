import { AnimatePresence, motion } from 'motion/react';
import { useAppUpdate } from '@/lib/install';
import { IconRefresh, IconX } from '../icons';
import { Button, IconButton } from '../ui';
import styles from './UpdateBanner.module.css';

/** Offers to reload when a new version of the app has been downloaded in the background. */
export function UpdateBanner() {
  const { needRefresh, applyUpdate, dismiss } = useAppUpdate();
  return (
    <AnimatePresence>
      {needRefresh ? (
        <motion.div
          className={styles.banner}
          role="status"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        >
          <span className="t-strong grow">A new version of LetResearch is ready.</span>
          <Button label="Reload" icon={IconRefresh} size="sm" onClick={applyUpdate} />
          <IconButton icon={IconX} label="Later" size={32} onClick={dismiss} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
