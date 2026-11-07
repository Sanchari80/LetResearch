import styles from './TypingDots.module.css';

/** Three bouncing dots – "typing…" */
export function TypingDots({ color = 'var(--text2)', size = 6 }: { color?: string; size?: number }) {
  return (
    <span className={styles.row} aria-label="Typing" style={{ height: size * 2 }}>
      {[0, 140, 280].map((delay) => (
        <span
          key={delay}
          className={styles.dot}
          style={{ width: size, height: size, background: color, animationDelay: `${delay}ms`, ['--lift' as string]: `${-size * 0.7}px` }}
        />
      ))}
    </span>
  );
}

export function TypingBubble() {
  return (
    <div className={styles.bubble}>
      <TypingDots />
    </div>
  );
}
