import { useState } from 'react';
import { fileUrl } from '@/lib/config';
import type { Post } from '@/lib/types';
import { Lightbox } from '../ui';
import styles from './PostMedia.module.css';

function Tile({ uri, className, onOpen }: { uri: string; className: string; onOpen: (uri: string) => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button type="button" className={`${styles.tile} ${className}`} aria-label="Open image" onClick={() => onOpen(uri)}>
      <img
        src={uri}
        alt=""
        loading="lazy"
        decoding="async"
        className={styles.image}
        data-loaded={loaded ? '' : undefined}
        onLoad={() => setLoaded(true)}
      />
    </button>
  );
}

/** Photo grid (1–4 images) or a single short video. Photos open full screen. */
export function PostMedia({ media }: { media: Post['media'] }) {
  const [viewing, setViewing] = useState<string | null>(null);
  if (!media.length) return null;
  const video = media.find((m) => m.kind === 'video');
  if (video) {
    const uri = fileUrl(video.url);
    return uri ? (
      <div className={styles.video}>
        <video src={uri} controls playsInline preload="metadata" className={styles.videoEl} />
      </div>
    ) : null;
  }
  const urls = media
    .filter((m) => m.kind === 'image')
    .slice(0, 4)
    .map((m) => fileUrl(m.url)!);
  const layout = urls.length === 1 ? styles.one : urls.length === 2 ? styles.two : urls.length === 3 ? styles.three : styles.four;
  return (
    <>
      <div className={`${styles.frame} ${layout}`}>
        {urls.map((uri, i) => (
          <Tile key={`${uri}-${i}`} uri={uri} className={i === 0 ? styles.first : ''} onOpen={setViewing} />
        ))}
      </div>
      <Lightbox uri={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
