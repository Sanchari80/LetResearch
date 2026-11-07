import type { ReactNode } from 'react';
import { goBack } from '@/lib/nav';
import styles from './AuthShell.module.css';
import { IconArrowLeft } from './icons';
import { IconButton, LogoMark } from './ui';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.top}>
        <IconButton icon={IconArrowLeft} label="Back" onClick={() => goBack('/welcome')} />
      </div>
      <main className={styles.card}>
        <LogoMark size={40} />
        <div className={styles.titles}>
          <h1 className="t-heading">{title}</h1>
          <p className="t-meta">{subtitle}</p>
        </div>
        {children}
      </main>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}
