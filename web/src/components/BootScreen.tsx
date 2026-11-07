import { API_URL, PUBLISHER } from '@/lib/config';
import { colors } from '@/theme';
import { IconRefresh, IconWifiOff } from './icons';
import styles from './BootScreen.module.css';
import { AnimatedLogoMark, Button, Wordmark } from './ui';

/** Shown while the saved session is restored (and while a sleeping server wakes up). */
export function BootScreen({ slow }: { slow?: boolean }) {
  return (
    <div className={styles.root} aria-busy="true">
      <AnimatedLogoMark size={84} />
      <span className={styles.word}>
        <Wordmark size={26} />
      </span>
      {slow ? (
        <div className={styles.slow}>
          <p className="t-meta">Waking up the server…</p>
          <p className="t-caption" style={{ maxWidth: 280 }}>
            The first visit after a quiet period can take up to a minute.
          </p>
        </div>
      ) : null}
      <p className={`t-caption ${styles.footer}`}>Published by {PUBLISHER}</p>
    </div>
  );
}

/** Shown when the app has a saved session but cannot reach the server. */
export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.root}>
      <span className={styles.icon}>
        <IconWifiOff size={28} color={colors.text2} aria-hidden />
      </span>
      <h1 className="t-heading" style={{ textAlign: 'center' }}>
        Can't reach LetResearch
      </h1>
      <p className="t-meta" style={{ textAlign: 'center', maxWidth: 340 }}>
        Check your internet connection. If you run your own server, make sure it is online at {API_URL}.
      </p>
      <Button label="Try again" icon={IconRefresh} onClick={onRetry} style={{ marginTop: 12 }} />
    </div>
  );
}
