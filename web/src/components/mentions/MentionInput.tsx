import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { Avatar } from '@/components/ui';
import { useSearch } from '@/lib/queries';
import type { UserSummary } from '@/lib/types';
import styles from './MentionInput.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  mode: 'post' | 'comment';
  placeholder: string;
  maxLength: number;
  label?: string;
  hint?: string;
  counter?: number;
  minRows?: number;
  ariaLabel?: string;
  autoCapitalize?: 'off' | 'none' | 'sentences' | 'words';
  textareaRef?: Ref<HTMLTextAreaElement>;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

interface Trigger {
  start: number;
  end: number;
  query: string;
}

function findTrigger(value: string, cursor: number): Trigger | null {
  const before = value.slice(0, cursor);
  const match = /(?:^|[\s([{])@([a-zA-Z0-9._-]*)$/.exec(before);
  if (!match) return null;
  const query = match[1];
  return { start: cursor - query.length - 1, end: cursor, query };
}

export function MentionInput({
  value,
  onChange,
  mode,
  placeholder,
  maxLength,
  label,
  hint,
  counter,
  minRows = 4,
  ariaLabel,
  autoCapitalize,
  textareaRef,
  onKeyDown,
}: Props) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [searchText, setSearchText] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const search = useSearch(searchText);
  const results = search.data ?? [];
  const showResults = !!trigger && trigger.query.length >= 2 && searchText === trigger.query;

  useEffect(() => {
    if (!trigger || trigger.query.length < 2) {
      setSearchText('');
      return;
    }
    const timer = setTimeout(() => setSearchText(trigger.query), 180);
    return () => clearTimeout(timer);
  }, [trigger?.query]);

  useEffect(() => setActiveIndex(0), [searchText]);

  const setRefs = (node: HTMLTextAreaElement | null) => {
    internalRef.current = node;
    if (typeof textareaRef === 'function') textareaRef(node);
    else if (textareaRef && typeof textareaRef === 'object') textareaRef.current = node;
  };

  const refreshTrigger = (text: string, cursor: number) => {
    setTrigger(findTrigger(text, cursor));
  };

  const choose = (person: UserSummary) => {
    const area = internalRef.current;
    if (!area || !trigger) return;
    const after = value.slice(trigger.end);
    const insertion = `@${person.username}${/^\s/.test(after) ? '' : ' '}`;
    const next = `${value.slice(0, trigger.start)}${insertion}${after}`;
    const cursor = trigger.start + insertion.length;
    onChange(next);
    setTrigger(null);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(cursor, cursor);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showResults && results.length) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % results.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + results.length) % results.length);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && results[activeIndex]) {
        event.preventDefault();
        choose(results[activeIndex]);
        return;
      }
    }
    if (event.key === 'Escape' && showResults) {
      setTrigger(null);
      return;
    }
    onKeyDown?.(event);
  };

  return (
    <div className={`${styles.root} ${mode === 'comment' ? styles.commentRoot : ''}`}>
      {label ? (
        <label htmlFor={id} className={`${styles.label} t-label`}>
          {label}
        </label>
      ) : null}
      <textarea
        id={id}
        ref={setRefs}
        rows={mode === 'post' ? minRows : 1}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          refreshTrigger(event.target.value, event.target.selectionStart);
        }}
        onClick={(event) => refreshTrigger(value, event.currentTarget.selectionStart)}
        onKeyUp={(event) => {
          if (event.key !== 'Escape') refreshTrigger(value, event.currentTarget.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        aria-label={ariaLabel ?? label}
        aria-autocomplete="list"
        aria-expanded={showResults}
        aria-controls={showResults ? `${id}-suggestions` : undefined}
        aria-activedescendant={showResults && results[activeIndex] ? `${id}-option-${results[activeIndex].id}` : undefined}
        maxLength={maxLength}
        className={`${styles.input} ${mode === 'comment' ? styles.commentInput : styles.postInput}`}
      />
      {showResults ? (
        <div id={`${id}-suggestions`} className={`${styles.suggestions} ${mode === 'comment' ? styles.above : ''}`} role="listbox" aria-label="Mention a researcher">
          {search.isError ? (
            <p className={styles.empty}>Could not load researchers. Try again.</p>
          ) : search.isFetching ? (
            <p className={styles.empty}>Searching researchers…</p>
          ) : results.length ? (
            results.slice(0, 8).map((person, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                id={`${id}-option-${person.id}`}
                key={person.id}
                className={`${styles.option} ${index === activeIndex ? styles.selected : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(person)}
              >
                <Avatar name={person.name} url={person.avatarUrl} size={34} />
                <span className={styles.person}>
                  <span className="t-strong nowrap">{person.name}</span>
                  <span className="t-caption nowrap">@{person.username}</span>
                </span>
              </button>
            ))
          ) : (
            <p className={styles.empty}>No researchers found.</p>
          )}
        </div>
      ) : null}
      {hint || counter ? (
        <div className={styles.hintRow}>
          {hint ? <span className="t-caption">{hint}</span> : <span />}
          {counter ? <span className="t-caption">{value.length}/{counter}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
