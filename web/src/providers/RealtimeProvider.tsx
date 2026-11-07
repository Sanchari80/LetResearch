// Connects the WebSocket while signed in and turns live events into cache updates,
// badge counts, typing/presence state, toasts, sounds and vibration.
import type { InfiniteData } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { navigate } from '@/lib/nav';
import { notificationHref } from '@/lib/navigation';
import { setAppBadge } from '@/lib/push';
import { keys, patchMessages, queryClient, upsertMessage } from '@/lib/queries';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import type { AppNotification, Conversation, Counts, Message, Page } from '@/lib/types';
import { useRealtime } from '@/store/realtime';
import { toast } from '@/store/toast';
import { useAuth } from './AuthProvider';

const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function refreshCounts() {
  api<Counts>('/api/users/me/counts')
    .then((counts) => useRealtime.getState().setCounts(counts))
    .catch(() => {});
}

function upsertConversation(conversation: Conversation) {
  queryClient.setQueryData(keys.conversation(conversation.id), conversation);
  const box = conversation.status === 'request' && !conversation.isRequester ? 'requests' : 'inbox';
  const list = queryClient.getQueryData<Conversation[]>(keys.conversations(box));
  if (list) {
    const rest = list.filter((c) => c.id !== conversation.id);
    queryClient.setQueryData(keys.conversations(box), [conversation, ...rest]);
  } else {
    queryClient.invalidateQueries({ queryKey: keys.conversations(box) });
  }
}

function prependNotification(n: AppNotification) {
  for (const category of ['all', n.category]) {
    queryClient.setQueryData<InfiniteData<Page<AppNotification> & { unreadByCategory: Record<string, number> }>>(
      keys.notifications(category),
      (data) => {
        if (!data?.pages.length) return data;
        const [first, ...rest] = data.pages;
        if (first.results.some((x) => x.id === n.id)) return data;
        return { ...data, pages: [{ ...first, results: [n, ...first.results] }, ...rest] };
      },
    );
  }
}

function handleNotificationSideEffects(n: AppNotification) {
  const invalidate = (queryKey: readonly unknown[]) => queryClient.invalidateQueries({ queryKey });
  switch (n.type) {
    case 'connection_request':
    case 'connection_accepted':
      invalidate(keys.connectionRequests);
      invalidate(keys.connections);
      invalidate(['suggestions']);
      invalidate(['profile']);
      break;
    case 'message_request':
    case 'message_request_accepted':
      invalidate(['conversations']);
      if (n.conversationId) invalidate(keys.conversation(n.conversationId));
      break;
    case 'paper_download':
      invalidate(keys.myPapers);
      if (n.paper) {
        invalidate(keys.paper(n.paper.id));
        invalidate(keys.paperDownloads(n.paper.id));
      }
      break;
    case 'post_like':
    case 'post_comment':
      if (n.postId) {
        invalidate(keys.post(n.postId));
        if (n.type === 'post_comment') invalidate(keys.comments(n.postId));
      }
      break;
    default:
      invalidate(['userPosts']);
      invalidate(['feed']);
  }
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status, token, user } = useAuth();
  const myId = user?.id;
  const counts = useRealtime((s) => s.counts);

  // The installed app's icon shows the unread total (where the system supports badges).
  useEffect(() => {
    if (status !== 'signedIn') return;
    setAppBadge(counts.notifications + counts.messages + counts.messageRequests + counts.connectionRequests);
  }, [status, counts]);

  // Tapping a push notification while the app is open navigates inside the app.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'navigate' && typeof event.data.url === 'string') navigate(event.data.url);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (status !== 'signedIn' || !token || !myId) return;
    const store = useRealtime.getState();
    const socket = connectSocket(token);

    socket.on('connect', () => {
      store.setConnected(true);
      refreshCounts();
    });
    socket.on('disconnect', () => store.setConnected(false));
    socket.on('counts', (next: Counts) => store.setCounts(next));

    socket.on('notification:new', (n: AppNotification) => {
      prependNotification(n);
      handleNotificationSideEffects(n);
      feedback.notify();
      const href = notificationHref(n);
      toast.show({
        title: n.actor?.name ?? 'LetResearch',
        message: n.actor ? n.text.charAt(0).toUpperCase() + n.text.slice(1) : n.text,
        tone: 'notify',
        avatarUrl: n.actor?.avatarUrl,
        avatarName: n.actor?.name,
        onPress: href ? () => navigate(href) : undefined,
      });
    });

    socket.on('message:new', ({ message, conversation }: { message: Message; conversation: Conversation }) => {
      upsertMessage(conversation.id, message);
      upsertConversation(conversation);
      if (message.senderId === myId) return;
      useRealtime.getState().setTyping(conversation.id, null);
      const viewing = useRealtime.getState().activeConversationId === conversation.id && document.visibilityState === 'visible';
      if (viewing) return;
      feedback.receive();
      if (conversation.status === 'active') {
        toast.show({
          title: conversation.other.name,
          message: message.text || (message.kind === 'image' ? 'Sent a photo' : 'Sent a file'),
          tone: 'notify',
          avatarUrl: conversation.other.avatarUrl,
          avatarName: conversation.other.name,
          onPress: () => navigate(`/chat/${conversation.id}`),
        });
      }
    });

    socket.on('message:read', ({ conversationId, readAt }: { conversationId: string; readAt: string }) => {
      patchMessages(conversationId, (m) => (m.senderId === myId && !m.readAt ? { ...m, readAt } : m));
    });

    socket.on('typing', ({ conversationId, userId, isTyping }: { conversationId: string; userId: string; isTyping: boolean }) => {
      const s = useRealtime.getState();
      s.setTyping(conversationId, isTyping ? userId : null);
      clearTimeout(typingTimers[conversationId]);
      if (isTyping) typingTimers[conversationId] = setTimeout(() => s.setTyping(conversationId, null), 6000);
    });

    socket.on('presence', ({ userId, online, lastSeenAt }: { userId: string; online: boolean; lastSeenAt: string }) => {
      useRealtime.getState().setPresence(userId, { online, lastSeenAt });
    });

    socket.on('conversation:update', ({ id }: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: keys.conversation(id) });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    socket.on('connection:update', () => {
      queryClient.invalidateQueries({ queryKey: keys.connectionRequests });
      queryClient.invalidateQueries({ queryKey: keys.connections });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    });

    // Catch up when the tab or app comes back to the foreground.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      refreshCounts();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (!getSocket()?.connected) getSocket()?.connect();
    };
    const onOnline = () => {
      if (!getSocket()?.connected) getSocket()?.connect();
      refreshCounts();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      disconnectSocket();
      useRealtime.getState().setConnected(false);
    };
  }, [status, token, myId]);

  return <>{children}</>;
}
