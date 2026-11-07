import { feedback } from '@/lib/feedback';
import styles from './Toggle.module.css';

interface Props {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

/** Switch with a snap of feedback when it changes. */
export function Toggle({ value, onChange, label, description, disabled }: Props) {
  const toggle = () => {
    if (disabled) return;
    feedback.toggle();
    onChange(!value);
  };
  const control = (
    <span className={`${styles.track} ${value ? styles.on : ''}`} aria-hidden>
      <span className={styles.thumb} />
    </span>
  );
  if (!label) {
    return (
      <button type="button" role="switch" aria-checked={value} disabled={disabled} onClick={toggle} className={styles.bare}>
        {control}
      </button>
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={toggle}
      className={styles.row}
    >
      <span className="col grow gap-4" style={{ textAlign: 'left' }}>
        <span className="t-strong">{label}</span>
        {description ? <span className="t-meta">{description}</span> : null}
      </span>
      {control}
    </button>
  );
}
