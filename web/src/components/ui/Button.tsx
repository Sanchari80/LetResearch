import type { ComponentType, CSSProperties, MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router';
import { feedback } from '@/lib/feedback';
import type { IconProps } from '../icons';
import styles from './Button.module.css';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg';

const ICON_SIZE: Record<Size, number> = { sm: 15, md: 18, lg: 20 };

export interface ButtonProps {
  label: string;
  onClick?: (event: MouseEvent) => void;
  /** Renders a link styled as a button. */
  to?: string;
  variant?: Variant;
  size?: Size;
  icon?: ComponentType<IconProps>;
  iconRight?: ComponentType<IconProps>;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Skip the default tap sound (when the action plays its own). */
  silent?: boolean;
  type?: 'button' | 'submit';
}

export function Button({
  label,
  onClick,
  to,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading,
  disabled,
  fullWidth,
  className,
  style,
  silent,
  type = 'button',
}: ButtonProps) {
  const classes = [styles.btn, styles[variant], styles[size], fullWidth && styles.full, className].filter(Boolean).join(' ');
  const iconSize = ICON_SIZE[size];
  const content = (
    <>
      <span className={`${styles.content} ${loading ? styles.hidden : ''}`}>
        {Icon ? <Icon size={iconSize} strokeWidth={2} aria-hidden /> : null}
        <span className={styles.label}>{label}</span>
        {IconRight ? <IconRight size={iconSize} strokeWidth={2} aria-hidden /> : null}
      </span>
      {loading ? (
        <span className={styles.spinnerWrap} aria-hidden>
          <span className={styles.spinner} />
        </span>
      ) : null}
    </>
  );

  if (to && !disabled) {
    return (
      <Link
        to={to}
        className={classes}
        style={style}
        onClick={(e) => {
          if (!silent) feedback.tap();
          onClick?.(e);
        }}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type={type}
      className={classes}
      style={style}
      disabled={disabled || loading}
      data-loading={loading ? '' : undefined}
      aria-busy={loading || undefined}
      aria-label={label}
      onClick={(e) => {
        if (!silent) feedback.tap();
        onClick?.(e);
      }}
    >
      {content}
    </button>
  );
}

export interface IconButtonProps {
  icon: ComponentType<IconProps>;
  label: string;
  onClick?: (event: MouseEvent) => void;
  to?: string;
  size?: number;
  color?: string;
  background?: string;
  bordered?: boolean;
  badge?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  silent?: boolean;
  children?: ReactNode;
}

/** Round icon-only button. The label is read by screen readers and shown as a tooltip. */
export function IconButton({
  icon: Icon,
  label,
  onClick,
  to,
  size = 40,
  color,
  background,
  bordered,
  badge,
  disabled,
  className,
  style,
  silent,
}: IconButtonProps) {
  const css: CSSProperties = {
    width: size,
    height: size,
    color,
    background,
    ...style,
  };
  const classes = [styles.iconBtn, bordered && styles.bordered, className].filter(Boolean).join(' ');
  const inner = (
    <>
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.9} aria-hidden />
      {badge ? (
        <span key={badge} className={styles.badge}>
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className={classes}
        style={css}
        aria-label={label}
        title={label}
        onClick={(e) => {
          if (!silent) feedback.tap();
          onClick?.(e);
        }}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={classes}
      style={css}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        if (!silent) feedback.tap();
        onClick?.(e);
      }}
    >
      {inner}
    </button>
  );
}

export function Spinner({ size = 20, color }: { size?: number; color?: string }) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size, color: color ?? 'var(--ink)' }}
      role="progressbar"
      aria-label="Loading"
    />
  );
}
