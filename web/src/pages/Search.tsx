import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { IconSearch, IconUsers, IconX } from '@/components/icons';
import { ResearcherRow } from '@/components/network/ResearcherCard';
import { EmptyState, IconButton, RowSkeleton } from '@/components/ui';
import { usePageTitle } from '@/lib/hooks';
import { goBack } from '@/lib/nav';
import { useSearch } from '@/lib/queries';
import { stagger } from '@/lib/style';
import { colors } from '@/theme';
import styles from './Search.module.css';

export default function SearchPage() {
  usePageTitle('Search');
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const [text, setText] = useState(params.get('q') ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useSearch(query);

  // Ask the server once the user pauses typing. The query is kept in the address, so the
  // results are still there after opening a profile and coming back.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = text.trim();
      if (next !== query) setParams(next ? { q: next } : {}, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [text, query, setParams]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, []);

  const items = results.data ?? [];

  return (
    <>
      <header className={styles.header}>
        <div className={`container w-feed ${styles.headerInner}`}>
          <form
            role="search"
            className={styles.field}
            onSubmit={(e) => {
              e.preventDefault();
              inputRef.current?.blur();
            }}
          >
            <IconSearch size={18} color={colors.text2} aria-hidden />
            <input
              ref={inputRef}
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Name, institution or research interest"
              autoCapitalize="none"
              autoComplete="off"
              enterKeyHint="search"
              className={styles.input}
              aria-label="Search researchers"
            />
            {text ? (
              <IconButton
                icon={IconX}
                label="Clear search"
                size={30}
                color={colors.text2}
                onClick={() => {
                  setText('');
                  inputRef.current?.focus();
                }}
              />
            ) : null}
          </form>
          <button type="button" className={styles.cancel} onClick={() => goBack('/network')}>
            Cancel
          </button>
        </div>
      </header>
      <main className={`container w-feed ${styles.list}`}>
        {query.length < 2 ? (
          <EmptyState compact icon={IconSearch} title="Find researchers" message="Search by name, username, headline, institution or research interest." />
        ) : results.isLoading ? (
          <RowSkeleton count={4} />
        ) : !items.length ? (
          <EmptyState compact icon={IconUsers} title="No researchers found" message={`Nobody matches “${query}”. Try a broader term.`} />
        ) : (
          items.map((item, index) => (
            <div key={item.id} className="enter" style={stagger(index, 10)}>
              <ResearcherRow person={item} />
            </div>
          ))
        )}
      </main>
    </>
  );
}
