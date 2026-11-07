import { motion } from 'motion/react';
import { useId, type CSSProperties } from 'react';
import { feedback } from '@/lib/feedback';
import styles from './Segmented.module.css';
import { CountBadge } from './Surface';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  badge?: number;
  /** Small unread dot – takes less room than a number badge. */
  dot?: boolean;
}

interface Props<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'pill' | 'underline';
  className?: string;
  style?: CSSProperties;
  label?: string;
}

/** Segmented control with an indicator that slides to the selected option. */
export function Segmented<T extends string>({ options, value, onChange, variant = 'pill', className, style, label }: Props<T>) {
  const id = useId();
  const pill = variant === 'pill';
  return (
    <div
      role="tablist"
      aria-label={label}
      className={[pill ? styles.track : styles.underline, className].filter(Boolean).join(' ')}
      style={style}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`${pill ? styles.pillItem : styles.lineItem} ${selected ? styles.selected : ''}`}
            onClick={() => {
              if (selected) return;
              feedback.select();
              onChange(option.value);
            }}
          >
            {selected ? (
              <motion.span
                layoutId={`segment-${id}`}
                className={pill ? styles.pillIndicator : styles.lineIndicator}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className={styles.labelWrap}>
              <span className={styles.label}>{option.label}</span>
              {/* The unread dot hangs off the label's top-right corner so it never squeezes the label. */}
              {option.dot ? <span className={styles.dot} aria-label="Unread" /> : null}
            </span>
            {option.badge ? (
              <span className={styles.badge}>
                <CountBadge count={option.badge} tone={selected ? 'danger' : 'quiet'} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
