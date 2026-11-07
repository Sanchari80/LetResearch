import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, setAuthToken, setUnauthorizedHandler } from '@/lib/api';
import { clearNext, navigate } from '@/lib/nav';
import { clearSavedContent } from '@/lib/persist';
import { detachPushSubscription, setAppBadge, syncPushSubscription } from '@/lib/push';
import { queryClient } from '@/lib/queries';
import { disconnectSocket } from '@/lib/socket';
import type { Counts, Profile } from '@/lib/types';
import { useRealtime } from '@/store/realtime';

const TOKEN_KEY = 'letresearch.token';
const USER_KEY = 'letresearch.user';

type Status = 'loading' | 'signedOut' | 'signedIn' | 'offline';

interface Session {
  token: string;
  user: Profile;
  isAdmin: boolean;
}

interface AuthContextValue {
  status: Status;
  user: Profile | null;
  token: string | null;
  isAdmin: boolean;
  /** True when the server is slow to answer (e.g. a sleeping free Render instance). */
  slowServer: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: Profile) => void;
  retry: () => void;
  /** True right after registration, so the app can open profile setup first. */
  isNewUser: boolean;
  clearNewUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function read(): { token: string | null; cached: { user: Profile; isAdmin: boolean } | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    return { token, cached: raw ? JSON.parse(raw) : null };
  } catch {
    return { token: null, cached: null };
  }
}

function persist(session: Session | null) {
  try {
    if (session) {
      localStorage.setItem(TOKEN_KEY, session.token);
      localStorage.setItem(USER_KEY, JSON.stringify({ user: session.user, isAdmin: session.isAdmin }));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    // Storage may be unavailable (private browsing) – the session still works for this visit.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [slowServer, setSlowServer] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [isNewUser, setIsNewUser] = useState(false);
  const signingOut = useRef(false);

  const applySession = useCallback((next: Session) => {
    setAuthToken(next.token);
    setSession(next);
    setStatus('signedIn');
    persist(next);
    void syncPushSubscription();
  }, []);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    await detachPushSubscription();
    setAuthToken(null);
    disconnectSocket();
    useRealtime.getState().reset();
    setAppBadge(0);
    queryClient.clear();
    void clearSavedContent();
    setIsNewUser(false);
    setSession(null);
    setStatus('signedOut');
    persist(null);
    signingOut.current = false;
    navigate('/welcome', { replace: true });
    // Signing out is not a reason to come back to the same page after the next sign-in.
    setTimeout(clearNext, 0);
  }, []);

  // Restore the saved session on start-up.
  useEffect(() => {
    let cancelled = false;
    const slowTimer = setTimeout(() => !cancelled && setSlowServer(true), 4500);
    (async () => {
      const { token, cached } = read();
      if (!token) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      setAuthToken(token);
      try {
        const me = await api<{ user: Profile; isAdmin: boolean; counts: Counts }>('/api/auth/me', { timeoutMs: 75000 });
        if (cancelled) return;
        useRealtime.getState().setCounts(me.counts);
        applySession({ token, user: me.user, isAdmin: me.isAdmin });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setAuthToken(null);
          persist(null);
          setStatus('signedOut');
        } else if (cached) {
          // Server unreachable – continue with the saved profile; data refreshes when it's back.
          setSession({ token, user: cached.user, isAdmin: cached.isAdmin });
          setStatus('signedIn');
        } else {
          setStatus('offline');
        }
      } finally {
        clearTimeout(slowTimer);
        if (!cancelled) setSlowServer(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, [applySession, attempt]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const withSlowNotice = useCallback(async <T,>(work: () => Promise<T>) => {
    const timer = setTimeout(() => setSlowServer(true), 4500);
    try {
      return await work();
    } finally {
      clearTimeout(timer);
      setSlowServer(false);
    }
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await withSlowNotice(() =>
        api<{ token: string; user: Profile; isAdmin: boolean }>('/api/auth/login', {
          method: 'POST',
          body: { email: email.trim(), password },
          timeoutMs: 75000,
        }),
      );
      setIsNewUser(false);
      applySession(result);
    },
    [applySession, withSlowNotice],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const result = await withSlowNotice(() =>
        api<{ token: string; user: Profile; isAdmin: boolean }>('/api/auth/register', {
          method: 'POST',
          body: { name: name.trim(), email: email.trim(), password },
          timeoutMs: 75000,
        }),
      );
      setIsNewUser(true);
      applySession(result);
    },
    [applySession, withSlowNotice],
  );

  const refresh = useCallback(async () => {
    if (!session) return;
    const me = await api<{ user: Profile; isAdmin: boolean; counts: Counts }>('/api/auth/me');
    useRealtime.getState().setCounts(me.counts);
    applySession({ token: session.token, user: me.user, isAdmin: me.isAdmin });
  }, [session, applySession]);

  const setUser = useCallback((user: Profile) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, user };
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAdmin: !!session?.isAdmin,
      slowServer,
      signIn,
      signUp,
      signOut,
      refresh,
      setUser,
      retry: () => {
        setStatus('loading');
        setAttempt((a) => a + 1);
      },
      isNewUser,
      clearNewUser: () => setIsNewUser(false),
    }),
    [status, session, slowServer, signIn, signUp, signOut, refresh, setUser, isNewUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
