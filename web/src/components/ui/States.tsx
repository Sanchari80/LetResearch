import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { colors } from '@/theme';
import { IconCircleAlert, IconRefresh, type IconProps } from '../icons';
import { Button, Spinner as SpinnerRing } from './Button';
import styles from './States.module.css';

/** Pulsing placeholder block shown while content loads. */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 6,
  style,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: CSSProperties;
}) {
  return <span className={styles.skeleton} style={{ width, height, borderRadius: radius, ...style }} aria-hidden />;
}

export function PostSkeleton() {
  return (
    <div className={styles.skeletonCard} aria-label="Loading posts">
      <div className="row gap-12">
        <Skeleton width={44} height={44} radius={22} />
        <div className="col grow gap-8">
          <Skeleton width="45%" height={13} />
          <Skeleton width="70%" height={11} />
        </div>
      </div>
      <Skeleton width="92%" height={12} style={{ marginTop: 16 }} />
      <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
      <Skeleton width="60%" height={12} style={{ marginTop: 8 }} />
    </div>
  );
}

export function RowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className={styles.rows} aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="row gap-12">
          <Skeleton width={46} height={46} radius={23} />
          <div className="col grow gap-8">
            <Skeleton width={`${50 + ((i * 13) % 30)}%`} height={13} />
            <Skeleton width={`${70 - ((i * 7) % 25)}%`} height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface EmptyProps {
  icon: ComponentType<IconProps>;
  title: string;
  message?: string;
  action?: ReactNode;
  compact?: boolean;
}

/** Empty screens invite the next action. */
export function EmptyState({ icon: Icon, title, message, action, compact }: EmptyProps) {
  return (
    <div className={`${styles.empty} ${compact ? styles.compact : ''}`}>
      <span className={styles.emptyIcon}>
        <Icon size={26} color={colors.text2} strokeWidth={1.7} aria-hidden />
      </span>
      <h2 className="t-title" style={{ textAlign: 'center' }}>
        {title}
      </h2>
      {message ? (
        <p className="t-meta" style={{ textAlign: 'center', maxWidth: 340 }}>
          {message}
        </p>
      ) : null}
      {action ? <div style={{ marginTop: 10 }}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={IconCircleAlert}
      title="This didn't load"
      message={message}
      action={onRetry ? <Button label="Try again" icon={IconRefresh} variant="secondary" onClick={onRetry} /> : null}
    />
  );
}

export function LoadingRow({ label, style }: { label?: string; style?: CSSProperties }) {
  return (
    <div className={styles.loading} style={style}>
      <SpinnerRing />
      {label ? <span className="t-meta">{label}</span> : null}
    </div>
  );
}

/** Thin progress bar that eases to the current fraction. */
export function ProgressBar({ value, style }: { value: number; style?: CSSProperties }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={styles.track} style={style} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className={styles.fill} style={{ width: `${pct}%` }} />
    </div>
  );
}

const TONES = {
  info: { bg: colors.steelSoft, fg: colors.steel },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  success: { bg: colors.successSoft, fg: colors.success },
};

export function InlineNotice({
  tone = 'info',
  title,
  children,
  icon: Icon,
  style,
  className,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  children?: ReactNode;
  icon?: ComponentType<IconProps>;
  style?: CSSProperties;
  className?: string;
}) {
  const palette = TONES[tone];
  return (
    <div
      className={[styles.notice, className].filter(Boolean).join(' ')}
      style={{ background: palette.bg, ...style }}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      {Icon ? <Icon size={18} color={palette.fg} style={{ marginTop: 2, flexShrink: 0 }} aria-hidden /> : null}
      <div className="col grow gap-4">
        {title ? (
          <p className="t-strong" style={{ color: palette.fg }}>
            {title}
          </p>
        ) : null}
        {typeof children === 'string' ? (
          <p className="t-meta" style={{ color: colors.inkSoft }}>
            {children}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
