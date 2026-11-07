import type { CSSProperties } from 'react';
import { colors } from '@/theme';
import styles from './Logo.module.css';

export function LogoMark({ size = 32 }: { size?: number }) {
  return <img src="/icons/brand-icon.png" width={size} height={size} alt="LetResearch" draggable={false} style={{ flexShrink: 0 }} />;
}

export function Wordmark({ size = 22, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <span className={styles.wordmark} style={{ fontSize: size, lineHeight: `${Math.round(size * 1.2)}px`, color }}>
      LetResearch
    </span>
  );
}

export function Logo({ size = 28, style }: { size?: number; style?: CSSProperties }) {
  return (
    <span className={styles.logo} style={{ gap: size * 0.32, ...style }}>
      <LogoMark size={size} />
      <Wordmark size={size * 0.78} />
    </span>
  );
}

export function AnimatedLogoMark({ size = 96 }: { size?: number }) {
  return <img src="/icons/brand-icon.png" width={size} height={size} alt="LetResearch" draggable={false} className={styles.animated} />;
}
