import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { useEffect, useId, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { feedback } from '@/lib/feedback';
import { useLayout, useScrollLock } from '@/lib/hooks';
import { colors } from '@/theme';
import type { IconProps } from '../icons';
import { Button } from './Button';
import styles from './Sheet.module.css';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  maxWidth?: number;
}

/** Bottom sheet on phones (drag the handle down to close), centred dialog on wide screens. */
export function Sheet({ visible, onClose, title, description, children, maxWidth = 480 }: SheetProps) {
  const { isWide } = useLayout();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useScrollLock(visible);

  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [visible]);

  return createPortal(
    <AnimatePresence>
      {visible ? (
        <div className={`${styles.root} ${isWide ? styles.rootCenter : styles.rootBottom}`}>
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className={`${styles.panel} ${isWide ? styles.dialog : styles.sheet}`}
            style={{ maxWidth }}
            initial={isWide ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
            animate={isWide ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={isWide ? { opacity: 0, scale: 0.97 } : { y: '100%' }}
            transition={{ type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
            drag={isWide ? false : 'y'}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 650) onClose();
            }}
          >
            {!isWide ? (
              <div className={styles.handle} onPointerDown={(e) => dragControls.start(e)} aria-hidden>
                <span className={styles.grabber} />
              </div>
            ) : null}
            <div className={styles.body}>
              {title ? (
                <h2 id={titleId} className={`t-title ${styles.title}`}>
                  {title}
                </h2>
              ) : null}
              {description ? <p className={`t-meta ${styles.description}`}>{description}</p> : null}
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export interface SheetAction {
  label: string;
  description?: string;
  icon?: ComponentType<IconProps>;
  onClick: () => void;
  destructive?: boolean;
  selected?: boolean;
}

/** A list of actions in a sheet (post menu, attachments, etc.). */
export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <div className={styles.actions}>
        {actions.map((action, index) => {
          const Icon = action.icon;
          const tint = action.destructive ? colors.danger : colors.ink;
          return (
            <button
              key={action.label}
              type="button"
              className={`${styles.action} ${action.selected ? styles.actionSelected : ''}`}
              style={{ '--i': index } as CSSProperties}
              onClick={() => {
                feedback.tap();
                onClose();
                // Run inside the click, so file pickers and new tabs are allowed by the browser.
                action.onClick();
              }}
            >
              {Icon ? (
                <span className={styles.actionIcon} style={action.destructive ? { background: colors.dangerSoft } : undefined}>
                  <Icon size={18} color={tint} aria-hidden />
                </span>
              ) : null}
              <span className="col grow">
                <span className={styles.actionLabel} style={{ color: tint }}>
                  {action.label}
                </span>
                {action.description ? <span className="t-caption">{action.description}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmState {
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  open: (options: ConfirmOptions) => Promise<boolean>;
  close: (value: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  options: null,
  resolve: null,
  open: (options) =>
    new Promise<boolean>((resolve) => {
      get().resolve?.(false);
      set({ options, resolve });
    }),
  close: (value) => {
    get().resolve?.(value);
    set({ options: null, resolve: null });
  },
}));

export const confirm = (options: ConfirmOptions) => useConfirmStore.getState().open(options);

export function ConfirmHost() {
  const { options, close } = useConfirmStore();
  const [last, setLast] = useState<ConfirmOptions | null>(null);
  useEffect(() => {
    if (options) setLast(options);
  }, [options]);
  const shown = options ?? last;
  return (
    <Sheet visible={!!options} onClose={() => close(false)} title={shown?.title} description={shown?.message} maxWidth={420}>
      <div className={styles.confirmRow}>
        <Button label={shown?.cancelLabel ?? 'Cancel'} variant="secondary" onClick={() => close(false)} className="grow" />
        <Button
          label={shown?.confirmLabel ?? 'Confirm'}
          variant={shown?.destructive ? 'danger' : 'primary'}
          onClick={() => close(true)}
          className="grow"
        />
      </div>
    </Sheet>
  );
}
