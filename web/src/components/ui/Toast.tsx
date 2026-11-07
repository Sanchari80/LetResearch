import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { useToasts, type Toast } from '@/store/toast';
import { colors } from '@/theme';
import { IconCircleAlert, IconCircleCheck, IconInfo, IconX } from '../icons';
import { Avatar } from './Avatar';
import styles from './Toast.module.css';

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  const Icon = toast.tone === 'error' ? IconCircleAlert : toast.tone === 'success' ? IconCircleCheck : IconInfo;
  const tint = toast.tone === 'error' ? colors.danger : toast.tone === 'success' ? colors.success : colors.steel;
  const hasAvatar = toast.avatarName !== undefined || !!toast.avatarUrl;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={styles.toast}
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <button
        type="button"
        className={styles.main}
        onClick={() => {
          dismiss(toast.id);
          toast.onPress?.();
        }}
        tabIndex={toast.onPress ? 0 : -1}
      >
        {hasAvatar ? (
          <Avatar name={toast.avatarName} url={toast.avatarUrl} size={36} />
        ) : (
          <span className={styles.icon} style={{ background: `${tint}1A` }}>
            <Icon size={18} color={tint} aria-hidden />
          </span>
        )}
        <span className="col grow">
          <span className={`${styles.title} nowrap`}>{toast.title}</span>
          {toast.message ? <span className={`t-meta clamp-2 ${styles.message}`}>{toast.message}</span> : null}
        </span>
      </button>
      <button type="button" className={styles.close} aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
        <IconX size={16} color={colors.text3} aria-hidden />
      </button>
    </motion.div>
  );
}

/** Live alerts (new messages, downloads, requests) slide in from the top. */
export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className={styles.host} aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
