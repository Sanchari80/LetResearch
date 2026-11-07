import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { colors } from '@/theme';
import { IconEye, IconEyeOff } from '../icons';
import styles from './TextField.module.css';

export interface TextFieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Element shown at the right of the label row – e.g. a privacy pill. */
  labelAccessory?: ReactNode;
  /** Element inside the field on the right. */
  right?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  minRows?: number;
  maxLength?: number;
  counter?: number;
  type?: 'text' | 'email' | 'password' | 'url' | 'tel' | 'search';
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  autoCapitalize?: 'off' | 'none' | 'sentences' | 'words';
  autoFocus?: boolean;
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
  /** Called when Enter is pressed in a single-line field. */
  onSubmit?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  style?: CSSProperties;
  inputRef?: Ref<HTMLInputElement | HTMLTextAreaElement>;
  ariaLabel?: string;
  name?: string;
}

/** Text input or auto-growing text area with label, hint, error and character counter. */
export function TextField({
  label,
  hint,
  error,
  labelAccessory,
  right,
  value,
  onChange,
  placeholder,
  multiline,
  minRows = 4,
  maxLength,
  counter,
  type = 'text',
  inputMode,
  autoComplete,
  autoCapitalize,
  autoFocus,
  enterKeyHint,
  onSubmit,
  onFocus,
  onBlur,
  className,
  style,
  inputRef,
  ariaLabel,
  name,
}: TextFieldProps) {
  const id = useId();
  const [hidden, setHidden] = useState(true);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  // Grow the text area with its content.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight + 2}px`;
  }, [value, multiline]);

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => (areaRef.current ?? document.getElementById(id))?.focus(), 60);
    return () => clearTimeout(t);
  }, [autoFocus, id]);

  const setRefs = (node: HTMLInputElement | HTMLTextAreaElement | null) => {
    if (node instanceof HTMLTextAreaElement) areaRef.current = node;
    if (typeof inputRef === 'function') inputRef(node);
    else if (inputRef && typeof inputRef === 'object') (inputRef as { current: unknown }).current = node;
  };

  const common = {
    id,
    name,
    value,
    placeholder,
    maxLength,
    autoComplete,
    autoCapitalize,
    enterKeyHint,
    'aria-label': ariaLabel ?? (label ? undefined : placeholder),
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    onFocus,
    onBlur,
  };

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')} style={style}>
      {label || labelAccessory ? (
        <div className={styles.labelRow}>
          {label ? (
            <label htmlFor={id} className="t-label grow">
              {label}
            </label>
          ) : (
            <span className="grow" />
          )}
          {labelAccessory}
        </div>
      ) : null}
      <div className={`${styles.field} ${multiline ? styles.multiline : ''} ${error ? styles.invalid : ''}`}>
        {multiline ? (
          <textarea
            {...common}
            ref={setRefs}
            rows={minRows}
            className={styles.input}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            {...common}
            ref={setRefs}
            type={type === 'password' && !hidden ? 'text' : type}
            inputMode={inputMode}
            className={styles.input}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter' && onSubmit) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
        )}
        {type === 'password' ? (
          <button
            type="button"
            className={styles.eye}
            aria-label={hidden ? 'Show password' : 'Hide password'}
            onClick={() => setHidden((h) => !h)}
          >
            {hidden ? <IconEye size={18} color={colors.text2} aria-hidden /> : <IconEyeOff size={18} color={colors.text2} aria-hidden />}
          </button>
        ) : null}
        {right}
      </div>
      {error ? (
        <p id={`${id}-error`} className={`t-caption ${styles.error}`}>
          {error}
        </p>
      ) : hint || counter ? (
        <div className={styles.hintRow}>
          {hint ? (
            <p id={`${id}-hint`} className="t-caption grow">
              {hint}
            </p>
          ) : (
            <span className="grow" />
          )}
          {counter ? (
            <span className="t-caption" style={{ color: value.length > counter ? colors.danger : colors.text3 }}>
              {value.length}/{counter}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
