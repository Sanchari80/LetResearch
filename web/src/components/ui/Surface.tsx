import type { ComponentType, CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { feedback } from '@/lib/feedback';
import { colors } from '@/theme';
import type { IconProps } from '../icons';
import styles from './Surface.module.css';

export function Card({
  children,
  className,
  padded = true,
  raised,
  as: Tag = 'div',
  ...rest
}: HTMLAttributes<HTMLElement> & { padded?: boolean; raised?: boolean; as?: 'div' | 'section' | 'article' | 'li' }) {
  return (
    <Tag className={[styles.card, padded && styles.padded, raised && styles.raised, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  );
}

export function Divider({ className, style }: { className?: string; style?: CSSProperties }) {
  return <hr className={[styles.divider, className].filter(Boolean).join(' ')} style={style} />;
}

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  icon?: ComponentType<IconProps>;
  tone?: 'default' | 'accent' | 'steel' | 'quiet';
  small?: boolean;
  className?: string;
  ariaLabel?: string;
}

/** Selectable chip. The selection colour fades in, so filters feel responsive. */
export function Chip({ label, selected, onClick, icon: Icon, tone = 'default', small, className, ariaLabel }: ChipProps) {
  const classes = [styles.chip, styles[`tone-${tone}`], small && styles.small, selected && styles.selected, className]
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      {Icon ? <Icon size={small ? 13 : 15} strokeWidth={2} aria-hidden /> : null}
      <span className="nowrap">{label}</span>
    </>
  );
  if (!onClick) return <span className={classes}>{content}</span>;
  return (
    <button
      type="button"
      className={`${classes} ${styles.pressable}`}
      aria-pressed={!!selected}
      aria-label={ariaLabel}
      onClick={() => {
        feedback.select();
        onClick();
      }}
    >
      {content}
    </button>
  );
}

export function CountBadge({ count, tone = 'danger' }: { count: number; tone?: 'danger' | 'accent' | 'quiet' }) {
  if (!count) return null;
  const bg = tone === 'danger' ? colors.danger : tone === 'accent' ? colors.accent : colors.silver;
  return (
    <span key={count} className={styles.count} style={{ background: bg }}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.sectionTitle}>
      <h2 className="t-title grow">{children}</h2>
      {action}
    </div>
  );
}
