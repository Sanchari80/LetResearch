import { feedback } from '@/lib/feedback';
import { IconChevronDown } from '../icons';
import styles from './PaperPlaque.module.css';

/**
 * The research paper count, engraved on a graphite plaque in citation style: [12].
 * Tapping it unfolds the author's indexed paper list.
 */
export function PaperPlaque({
  count,
  open,
  onToggle,
  compact,
  controls,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
  compact?: boolean;
  controls?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.plaque} ${compact ? styles.compact : ''}`}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={`${count} research ${count === 1 ? 'paper' : 'papers'}. ${open ? 'Hide' : 'Show'} the paper index`}
      onClick={() => {
        feedback.toggle();
        onToggle();
      }}
    >
      <span key={count} className={styles.numeral}>
        [{count}]
      </span>
      <span className={styles.labelRow}>
        <span className={styles.label}>{count === 1 ? 'Research paper' : 'Research papers'}</span>
        <IconChevronDown size={14} color="#C9CED6" strokeWidth={2.4} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden />
      </span>
    </button>
  );
}
