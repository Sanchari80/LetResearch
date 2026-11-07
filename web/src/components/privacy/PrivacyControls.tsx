import { useState, type ComponentType } from 'react';
import { feedback } from '@/lib/feedback';
import { FIELD_LABELS, VISIBILITY_OPTIONS, visibilityLabel, visibilityTone } from '@/lib/privacy';
import type { Visibility, VisibilityField } from '@/lib/types';
import { IconGlobe, IconLock, IconUsers, type IconProps } from '../icons';
import { Sheet } from '../ui';
import styles from './PrivacyControls.module.css';

export const VISIBILITY_ICON: Record<Visibility, ComponentType<IconProps>> = {
  public: IconGlobe,
  connections: IconUsers,
  private: IconLock,
};

/** Small glyph that shows who can see something. */
export function VisibilityGlyph({ value, size = 14 }: { value: Visibility; size?: number }) {
  const Icon = VISIBILITY_ICON[value];
  return <Icon size={size} color={visibilityTone(value).fg} strokeWidth={2} aria-label={visibilityLabel(value)} />;
}

interface OptionListProps<T extends string> {
  options: { value: T; label: string; description: string }[];
  value: T;
  onSelect: (value: T) => void;
  icons?: Partial<Record<T, ComponentType<IconProps>>>;
  label?: string;
}

/** Radio list with descriptions, used by every privacy picker. */
export function OptionList<T extends string>({ options, value, onSelect, icons, label }: OptionListProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.list}>
      {options.map((option, index) => {
        const selected = option.value === value;
        const Icon = icons?.[option.value] as ComponentType<IconProps> | undefined;
        const tone = visibilityTone(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
            style={{ animationDelay: `${30 + index * 40}ms` }}
            onClick={() => onSelect(option.value)}
          >
            {Icon ? (
              <span className={styles.optionIcon} style={{ background: tone.bg }}>
                <Icon size={18} color={tone.fg} aria-hidden />
              </span>
            ) : null}
            <span className="col grow">
              <span className="t-strong">{option.label}</span>
              <span className="t-caption">{option.description}</span>
            </span>
            <span className={styles.radio} aria-hidden>
              <span className={styles.radioDot} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface PillProps {
  value: Visibility;
  field: VisibilityField;
  onChange: (value: Visibility) => void;
  compact?: boolean;
}

/** Privacy pill shown beside each profile detail. Tap to choose who can see it. */
export function PrivacyPill({ value, field, onChange, compact }: PillProps) {
  const [open, setOpen] = useState(false);
  const tone = visibilityTone(value);
  const Icon = VISIBILITY_ICON[value];
  return (
    <>
      <button
        type="button"
        className={`${styles.pill} ${compact ? styles.pillCompact : ''}`}
        style={{ background: tone.bg, color: tone.fg }}
        aria-label={`${FIELD_LABELS[field]} visibility: ${visibilityLabel(value)}. Change`}
        aria-haspopup="dialog"
        onClick={() => {
          feedback.tap();
          setOpen(true);
        }}
      >
        <span key={value} className={styles.pillInner}>
          <Icon size={compact ? 12 : 13} strokeWidth={2.2} aria-hidden />
          {!compact ? <span>{visibilityLabel(value)}</span> : null}
        </span>
      </button>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={`Who can see your ${FIELD_LABELS[field].toLowerCase()}?`}
        description="You can change this at any time."
      >
        <OptionList
          label={`Who can see your ${FIELD_LABELS[field].toLowerCase()}`}
          options={VISIBILITY_OPTIONS}
          value={value}
          icons={VISIBILITY_ICON}
          onSelect={(next) => {
            setOpen(false);
            if (next !== value) {
              feedback.toggle();
              onChange(next);
            }
          }}
        />
      </Sheet>
    </>
  );
}

/** Read-only access badge for papers (view / download). */
export function AccessBadge({ label, value, icon: Icon }: { label: string; value: string; icon: ComponentType<IconProps> }) {
  const tone = visibilityTone(value);
  return (
    <span className={styles.badge} style={{ background: tone.bg, color: tone.fg }}>
      <Icon size={12} strokeWidth={2.2} aria-hidden />
      {label}
    </span>
  );
}
