import { useEffect, useRef, useState } from 'react';
import { feedback } from '@/lib/feedback';
import { colors } from '@/theme';
import { IconHeart } from '../icons';
import styles from './LikeButton.module.css';

/** Like with a heart pop, a fading ring burst and a rolling counter. */
export function LikeButton({
  liked,
  count,
  onToggle,
  disabled,
}: {
  liked: boolean;
  count: number;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const first = useRef(true);
  const [burst, setBurst] = useState(0);
  const [pop, setPop] = useState(0);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPop((p) => p + 1);
    if (liked) setBurst((b) => b + 1);
  }, [liked]);

  return (
    <button
      type="button"
      className={`${styles.button} ${liked ? styles.liked : ''}`}
      aria-pressed={liked}
      aria-label={`${liked ? 'Unlike' : 'Like'}, ${count} ${count === 1 ? 'like' : 'likes'}`}
      disabled={disabled}
      onClick={() => {
        if (!liked) feedback.like();
        else feedback.tap();
        onToggle();
      }}
    >
      <span className={styles.iconWrap}>
        {burst ? <span key={`b${burst}`} className={styles.ring} aria-hidden /> : null}
        <span key={`p${pop}`} className={pop ? (liked ? styles.heartPop : styles.heartPress) : undefined}>
          <IconHeart
            size={20}
            color={liked ? colors.like : colors.text2}
            fill={liked ? colors.like : 'transparent'}
            strokeWidth={liked ? 2 : 1.8}
            aria-hidden
          />
        </span>
      </span>
      <span className={styles.countWrap}>
        <span key={count} className={styles.count}>
          {count > 0 ? count : 'Like'}
        </span>
      </span>
    </button>
  );
}
