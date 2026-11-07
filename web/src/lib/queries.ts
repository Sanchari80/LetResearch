// Data hooks built on TanStack Query. Query keys are centralised so live socket events
// can update or refresh the right screens.
import { QueryClient, useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';
import { api } from './api';
import type {
  AppNotification,
  Comment,
  ConnectionRequest,
  Conversation,
  Message,
  Page,
  PaperDetail,
  PaperSummary,
  Post,
  ProfileResponse,
  Suggestion,
  UserSummary,
} from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      // Kept for a few days so the installed app can show it offline (see lib/persist.ts).
      gcTime: 3 * 24 * 60 * 60 * 1000,
      retry: (count, error: any) => (error?.status && error.status < 500 && error.status !== 0 ? false : count < 2),
      refetchOnWindowFocus: false,
    },
  },
});

export const keys = {
  feed: (scope: string, category: string) => ['feed', scope, category] as const,
  profile: (handle: string) => ['profile', handle] as const,
  userPosts: (userId: string) => ['userPosts', userId] as const,
  post: (id: string) => ['post', id] as const,
  comments: (postId: string) => ['comments', postId] as const,
  myPapers: ['papers', 'mine'] as const,
  paper: (id: string) => ['paper', id] as const,
  paperDownloads: (id: string) => ['paperDownloads', id] as const,
  connections: ['connections'] as const,
  connectionRequests: ['connectionRequests'] as const,
  suggestions: (filter: string) => ['suggestions', filter] as const,
  search: (q: string) => ['search', q] as const,
  userConnections: (handle: string) => ['userConnections', handle] as const,
  conversations: (box: 'inbox' | 'requests') => ['conversations', box] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (id: string) => ['messages', id] as const,
  notifications: (category: string) => ['notifications', category] as const,
  moderation: ['moderation'] as const,
  postMeta: ['postMeta'] as const,
};

type FeedPage = Page<Post>;

export function useFeed(scope: 'all' | 'network', category: string) {
  return useInfiniteQuery({
    queryKey: keys.feed(scope, category),
    queryFn: ({ pageParam }) =>
      api<FeedPage>('/api/posts/feed', {
        query: { scope, category: category === 'All' ? undefined : category, cursor: pageParam },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useProfile(handle?: string) {
  return useQuery({
    queryKey: keys.profile(handle ?? ''),
    queryFn: () => api<ProfileResponse>(`/api/users/${encodeURIComponent(handle!)}`),
    enabled: !!handle,
  });
}

export function useUserPosts(userId?: string) {
  return useInfiniteQuery({
    queryKey: keys.userPosts(userId ?? ''),
    queryFn: ({ pageParam }) => api<FeedPage>(`/api/posts/user/${userId}`, { query: { cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!userId,
  });
}

export function usePost(id?: string) {
  return useQuery({
    queryKey: keys.post(id ?? ''),
    queryFn: () => api<{ post: Post }>(`/api/posts/${id}`).then((r) => r.post),
    enabled: !!id,
  });
}

export function useComments(postId?: string) {
  return useQuery({
    queryKey: keys.comments(postId ?? ''),
    queryFn: () => api<{ results: Comment[] }>(`/api/posts/${postId}/comments`).then((r) => r.results),
    enabled: !!postId,
  });
}

export function useMyPapers(enabled = true) {
  return useQuery({
    queryKey: keys.myPapers,
    queryFn: () => api<{ papers: PaperSummary[] }>('/api/papers/mine').then((r) => r.papers),
    enabled,
  });
}

export function usePaper(id?: string) {
  return useQuery({
    queryKey: keys.paper(id ?? ''),
    queryFn: () => api<{ paper: PaperDetail; relation: string; downloadNote: string }>(`/api/papers/${id}`),
    enabled: !!id,
  });
}

export function usePaperDownloads(id?: string, enabled = true) {
  return useQuery({
    queryKey: keys.paperDownloads(id ?? ''),
    queryFn: () =>
      api<{ total: number; results: { id: string; user: UserSummary; kind: string; at: string }[] }>(
        `/api/papers/${id}/downloads`,
      ),
    enabled: !!id && enabled,
  });
}

export function useConnections() {
  return useQuery({
    queryKey: keys.connections,
    queryFn: () =>
      api<{ results: { connectionId: string; since: string; user: UserSummary }[] }>('/api/connections').then((r) => r.results),
  });
}

export function useConnectionRequests() {
  return useQuery({
    queryKey: keys.connectionRequests,
    queryFn: () => api<{ received: ConnectionRequest[]; sent: ConnectionRequest[] }>('/api/connections/requests'),
  });
}

export function useSuggestions(filter: string) {
  return useQuery({
    queryKey: keys.suggestions(filter),
    queryFn: () =>
      api<{ results: Suggestion[]; hasLocation: boolean; hasInterests: boolean; hasInstitution: boolean }>(
        '/api/users/suggestions',
        {
          query: { filter },
        },
      ),
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: keys.search(q),
    queryFn: () => api<{ results: UserSummary[] }>('/api/users/search', { query: { q } }).then((r) => r.results),
    enabled: q.trim().length >= 2,
  });
}

export function useUserConnections(handle?: string) {
  return useQuery({
    queryKey: keys.userConnections(handle ?? ''),
    queryFn: () => api<{ hidden: boolean; results: UserSummary[] }>(`/api/users/${encodeURIComponent(handle!)}/connections`),
    enabled: !!handle,
  });
}

export function useConversations(box: 'inbox' | 'requests') {
  return useQuery({
    queryKey: keys.conversations(box),
    queryFn: () => api<{ results: Conversation[] }>('/api/conversations', { query: { box } }).then((r) => r.results),
  });
}

export function useConversation(id?: string) {
  return useQuery({
    queryKey: keys.conversation(id ?? ''),
    queryFn: () => api<{ conversation: Conversation }>(`/api/conversations/${id}`).then((r) => r.conversation),
    enabled: !!id,
  });
}

export type MessagePage = { results: Message[]; hasMore: boolean };

export function useMessages(id?: string) {
  return useInfiniteQuery({
    queryKey: keys.messages(id ?? ''),
    queryFn: ({ pageParam }) => api<MessagePage>(`/api/conversations/${id}/messages`, { query: { before: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore && last.results.length ? last.results[0].createdAt : undefined),
    enabled: !!id,
    staleTime: 5 * 1000,
  });
}

export function useNotifications(category: string) {
  return useInfiniteQuery({
    queryKey: keys.notifications(category),
    queryFn: ({ pageParam }) =>
      api<Page<AppNotification> & { unreadByCategory: Record<string, number> }>('/api/notifications', {
        query: { category, cursor: pageParam },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useModerationQueue(enabled: boolean) {
  return useQuery({
    queryKey: keys.moderation,
    queryFn: () => api<{ results: Post[] }>('/api/moderation/queue').then((r) => r.results),
    enabled,
  });
}

// ---------------------------------------------------------------------------
// Cache helpers used by optimistic updates and live socket events
// ---------------------------------------------------------------------------

/** Applies `update` to a post wherever it appears (feeds, profile posts, detail). */
export function updatePostEverywhere(postId: string, update: (post: Post) => Post) {
  const patchPages = (data?: InfiniteData<FeedPage>) =>
    data
      ? { ...data, pages: data.pages.map((p) => ({ ...p, results: p.results.map((x) => (x.id === postId ? update(x) : x)) })) }
      : data;
  queryClient.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] }, patchPages);
  queryClient.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ['userPosts'] }, patchPages);
  queryClient.setQueryData<Post>(keys.post(postId), (p) => (p ? update(p) : p));
}

export function removePostEverywhere(postId: string) {
  const strip = (data?: InfiniteData<FeedPage>) =>
    data ? { ...data, pages: data.pages.map((p) => ({ ...p, results: p.results.filter((x) => x.id !== postId) })) } : data;
  queryClient.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] }, strip);
  queryClient.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ['userPosts'] }, strip);
}

/** Adds or replaces a message in a conversation's cache (matching optimistic copies by clientId). */
export function upsertMessage(conversationId: string, message: Message) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(keys.messages(conversationId), (data) => {
    if (!data) return data;
    let replaced = false;
    const pages = data.pages.map((page) => ({
      ...page,
      results: page.results.map((m) => {
        if (m.id === message.id || (message.clientId && m.clientId === message.clientId)) {
          replaced = true;
          return { ...message, localUri: m.localUri };
        }
        return m;
      }),
    }));
    if (!replaced && pages.length) {
      pages[0] = { ...pages[0], results: [...pages[0].results, message] };
    }
    return { ...data, pages };
  });
}

export function patchMessages(conversationId: string, patch: (m: Message) => Message) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(keys.messages(conversationId), (data) =>
    data ? { ...data, pages: data.pages.map((p) => ({ ...p, results: p.results.map(patch) })) } : data,
  );
}
