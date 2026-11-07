// Keeps what was last loaded (feed, profiles, chats, notifications…) on the device, so the
// installed app opens instantly and still shows content without a connection.
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';
import { persistQueryClientSave, type PersistedClient, type PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import type { QueryClient } from '@tanstack/react-query';
import { createStore, del, get, set } from 'idb-keyval';

/** How long saved content stays usable without opening the app. */
export const CACHE_MAX_AGE = 3 * 24 * 60 * 60 * 1000;

const NOT_SAVED = new Set(['search', 'moderation', 'paperDownloads', 'postMeta']);

const store = typeof indexedDB === 'undefined' ? null : createStore('letresearch', 'cache');

const persister = createAsyncStoragePersister({
  key: 'letresearch.queries',
  throttleTime: 1000,
  storage: store
    ? {
        getItem: (key) => get<string>(key, store).catch(() => null),
        setItem: (key, value) => set(key, value, store).catch(() => undefined),
        removeItem: (key) => del(key, store).catch(() => undefined),
      }
    : null,
  // Long lists keep only their first page; the rest loads again when scrolled to.
  serialize: (client: PersistedClient) =>
    JSON.stringify({
      ...client,
      clientState: {
        ...client.clientState,
        queries: client.clientState.queries.map((query) => {
          const data = query.state.data as { pages?: unknown[]; pageParams?: unknown[] } | undefined;
          if (!data || !Array.isArray(data.pages) || data.pages.length <= 1) return query;
          return { ...query, state: { ...query.state, data: { pages: data.pages.slice(0, 1), pageParams: (data.pageParams ?? []).slice(0, 1) } } };
        }),
      },
    }),
});

function savedUserId() {
  try {
    const raw = localStorage.getItem('letresearch.user');
    return raw ? String((JSON.parse(raw) as { user?: { id?: string } }).user?.id ?? '') : '';
  } catch {
    return '';
  }
}

/**
 * Saved content belongs to one researcher and one release of the app: after another account
 * signs in, or after an update, it is thrown away instead of being shown.
 */
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: CACHE_MAX_AGE,
  buster: `${typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'}:${savedUserId()}`,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      defaultShouldDehydrateQuery(query) && !NOT_SAVED.has(String(query.queryKey[0])) && savedUserId() !== '',
  },
};

/** Forgets everything saved on this device (on sign-out). */
export function clearSavedContent() {
  return persister.removeClient();
}

/** Saves right away when the app goes to the background, in case it is closed from there. */
export function saveWhenHidden(queryClient: QueryClient) {
  const onHide = () => {
    if (document.visibilityState === 'hidden') void persistQueryClientSave({ queryClient, ...persistOptions }).catch(() => undefined);
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);
  return () => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);
  };
}
