import type { CSSProperties } from 'react';

/** Sets the stagger index used by the `.enter` animation classes. */
export function stagger(index: number, max = 8): CSSProperties {
  return { '--i': Math.min(index, max) } as CSSProperties;
}
