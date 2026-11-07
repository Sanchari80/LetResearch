import { useState, type CSSProperties } from 'react';
import { fileUrl } from '@/lib/config';
import { initials } from '@/lib/format';
import styles from './Avatar.module.css';

interface Props {
  name?: string | null;
  url?: string | null;
  size?: number;
  online?: boolean;
  /** Border colour drawn around the photo (e.g. the page background on a cover). */
  ring?: string;
  className?: string;
  style?: CSSProperties;
}

function Photo({ uri, onFail }: { uri: string; onFail: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={uri}
      alt=""
      className={styles.image}
      data-loaded={loaded ? '' : undefined}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={onFail}
    />
  );
}

export function Avatar({ name, url, size = 44, online, ring, className, style }: Props) {
  const uri = fileUrl(url);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showPhoto = !!uri && failedUri !== uri;
  const dot = Math.min(18, Math.max(10, Math.round(size * 0.22)));
  return (
    <span
      className={[styles.avatar, className].filter(Boolean).join(' ')}
      style={{
        width: size,
        height: size,
        boxShadow: ring ? `0 0 0 ${Math.max(2, Math.round(size * 0.045))}px ${ring}` : undefined,
        ...style,
      }}
      role="img"
      aria-label={name ? `${name}'s photo` : 'Profile photo'}
    >
      {showPhoto ? (
        <Photo key={uri} uri={uri!} onFail={() => setFailedUri(uri)} />
      ) : (
        <span className={styles.initials} style={{ fontSize: size * 0.38 }} aria-hidden>
          {initials(name)}
        </span>
      )}
      {online ? (
        <span className={styles.dotWrap} style={{ width: dot, height: dot, right: size * 0.02, bottom: size * 0.02 }} aria-hidden>
          <span className={styles.halo} />
          <span className={styles.dot} style={{ borderWidth: Math.max(2, Math.round(dot * 0.2)) }} />
        </span>
      ) : null}
    </span>
  );
}
