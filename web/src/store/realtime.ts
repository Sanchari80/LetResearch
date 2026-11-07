import { create } from 'zustand';
import type { Counts } from '@/lib/types';

interface Presence {
  online: boolean;
  lastSeenAt: string | null;
}

interface RealtimeState {
  connected: boolean;
  counts: Counts;
  /** userId → presence learned from live events (overrides API snapshots). */
  presence: Record<string, Presence>;
  /** conversationId → userId currently typing. */
  typing: Record<string, string | null>;
  /** The chat currently on screen, so its messages don't trigger alerts. */
  activeConversationId: string | null;
  setConnected: (connected: boolean) => void;
  setCounts: (counts: Partial<Counts>) => void;
  setPresence: (userId: string, presence: Presence) => void;
  setTyping: (conversationId: string, userId: string | null) => void;
  setActiveConversation: (id: string | null) => void;
  reset: () => void;
}

const emptyCounts: Counts = { notifications: 0, connectionRequests: 0, messages: 0, messageRequests: 0 };

export const useRealtime = create<RealtimeState>((set) => ({
  connected: false,
  counts: emptyCounts,
  presence: {},
  typing: {},
  activeConversationId: null,
  setConnected: (connected) => set({ connected }),
  setCounts: (counts) => set((state) => ({ counts: { ...state.counts, ...counts } })),
  setPresence: (userId, presence) => set((state) => ({ presence: { ...state.presence, [userId]: presence } })),
  setTyping: (conversationId, userId) => set((state) => ({ typing: { ...state.typing, [conversationId]: userId } })),
  setActiveConversation: (activeConversationId) => set({ activeConversationId }),
  reset: () => set({ connected: false, counts: emptyCounts, presence: {}, typing: {}, activeConversationId: null }),
}));

/** Live presence for a user, falling back to the API snapshot. */
export function usePresence(userId?: string | null, fallback?: { online?: boolean; lastSeenAt?: string | null }) {
  const live = useRealtime((s) => (userId ? s.presence[userId] : undefined));
  return {
    online: live ? live.online : !!fallback?.online,
    lastSeenAt: live ? live.lastSeenAt : (fallback?.lastSeenAt ?? null),
  };
}
