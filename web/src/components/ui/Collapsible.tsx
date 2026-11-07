import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';

/** Animates its height between closed and the natural height of its content. */
export function Collapsible({ open, children, id }: { open: boolean; children: ReactNode; id?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          id={id}
          key="content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transition: { height: { duration: 0.34, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } } }}
          exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.24, ease: [0.4, 0, 1, 1] }, opacity: { duration: 0.16 } } }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
