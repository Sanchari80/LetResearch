import type { ComponentType, ReactNode } from 'react';
import { goBack } from '@/lib/nav';
import { IconArrowLeft, type IconProps } from '../icons';
import { IconButton } from './Button';
import styles from './PageHeader.module.css';

type Width = 'feed' | 'page' | 'form' | 'wide';

interface Props {
  title?: string;
  subtitle?: string;
  back?: boolean | (() => void);
  backFallback?: string;
  backIcon?: ComponentType<IconProps>;
  backLabel?: string;
  right?: ReactNode;
  left?: ReactNode;
  width?: Width;
  large?: boolean;
  children?: ReactNode;
  /** Full-width row under the title row (e.g. a step bar). */
  below?: ReactNode;
}

/** Sticky page header: serif title, optional back button and actions. */
export function PageHeader({
  title,
  subtitle,
  back,
  backFallback,
  backIcon,
  backLabel = 'Go back',
  right,
  left,
  width = 'page',
  large,
  children,
  below,
}: Props) {
  return (
    <header className={styles.header}>
      <div className={`${styles.inner} container ${styles[width]}`}>
        {back ? (
          <IconButton
            icon={backIcon ?? IconArrowLeft}
            label={backLabel}
            onClick={() => (typeof back === 'function' ? back() : goBack(backFallback))}
            style={{ marginLeft: -8 }}
          />
        ) : null}
        {left}
        <div className={styles.titles}>
          {title ? <h1 className={`${large ? 't-heading' : 't-title'} nowrap`}>{title}</h1> : null}
          {subtitle ? <p className="t-caption nowrap">{subtitle}</p> : null}
          {children}
        </div>
        {right ? <div className={styles.right}>{right}</div> : null}
      </div>
      {below ? <div className={`container ${styles[width]}`}>{below}</div> : null}
    </header>
  );
}
