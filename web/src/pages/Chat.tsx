import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { dividerFor, MessageBubble } from '@/components/chat/MessageBubble';
import { TypingBubble } from '@/components/chat/TypingDots';
import { IconArrowDown, IconArrowLeft, IconInfo, IconMessageCircle } from '@/components/icons';
import { Avatar, Button, EmptyState, ErrorState, IconButton, InlineNotice, Lightbox, RowSkeleton, Spinner } from '@/components/ui';
import { api, errorMessage, upload, type UploadFile } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { firstName, lastSeenText } from '@/lib/format';
import { usePageTitle, usePageVisible } from '@/lib/hooks';
import { goBack } from '@/lib/nav';
import { keys, patchMessages, upsertMessage, useConversation, useMessages } from '@/lib/queries';
import { signalTyping, stopTyping } from '@/lib/socket';
import type { Conversation, Message } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { usePresence, useRealtime } from '@/store/realtime';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import styles from './Chat.module.css';

const GROUP_GAP_MS = 5 * 60 * 1000;

/**
 * On phones the chat fills the visible part of the screen, so the composer stays above the
 * on-screen keyboard (iOS shrinks only the "visual viewport" when the keyboard opens).
 */
function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--chat-h', `${Math.round(vv.height)}px`);
      root.style.setProperty('--chat-top', `${Math.round(vv.offsetTop)}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--chat-h');
      root.style.removeProperty('--chat-top');
    };
  }, []);
}

export default function ChatPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const myId = user!.id;
  const queryClient = useQueryClient();
  const conversationQuery = useConversation(id);
  const messagesQuery = useMessages(id);
  const conversation = conversationQuery.data;
  const other = conversation?.other;
  const presence = usePresence(other?.id, other);
  const typingUser = useRealtime((s) => (id ? s.typing[id] : null));
  const visible = usePageVisible();
  const [viewing, setViewing] = useState<string | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const [away, setAway] = useState(false);
  const mountedAt = useRef(Date.now());
  const scrollerRef = useRef<HTMLDivElement>(null);
  const olderRef = useRef<HTMLDivElement>(null);
  usePageTitle(other ? `Chat with ${other.name}` : 'Chat');
  useVisualViewportHeight();

  // Messages newest first: the list is drawn bottom-up (column-reverse), like a phone chat.
  const messages = useMemo(() => messagesQuery.data?.pages.flatMap((page) => [...page.results].reverse()) ?? [], [messagesQuery.data]);

  useEffect(() => {
    useRealtime.getState().setActiveConversation(id || null);
    return () => {
      useRealtime.getState().setActiveConversation(null);
      if (id) stopTyping(id);
    };
  }, [id]);

  // Mark the other person's messages as read while this chat is on screen.
  const hasUnread = messages.some((m) => m.senderId !== myId && !m.readAt);
  useEffect(() => {
    if (!id || !hasUnread || !visible) return;
    const timer = setTimeout(async () => {
      try {
        const result = await api<{ readAt: string }>(`/api/conversations/${id}/read`, { method: 'POST' });
        patchMessages(id, (m) => (m.senderId !== myId && !m.readAt ? { ...m, readAt: result.readAt } : m));
        queryClient.setQueryData<Conversation>(keys.conversation(id), (c) => (c ? { ...c, unread: 0 } : c));
        queryClient.setQueriesData<Conversation[]>({ queryKey: ['conversations'] }, (list) =>
          list?.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
        );
      } catch {
        // Try again on the next change.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [id, hasUnread, visible, myId, queryClient]);

  // Load older messages when the top of the list comes near. The observer is renewed after
  // each page, so it keeps loading while the top is still in reach.
  const loadOlder = useRef(() => {});
  loadOlder.current = () => {
    if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) void messagesQuery.fetchNextPage();
  };
  const canLoadOlder = !!messagesQuery.hasNextPage;
  const loaded = !messagesQuery.isLoading;
  useEffect(() => {
    const node = olderRef.current;
    const root = scrollerRef.current;
    if (!node || !root || !canLoadOlder) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadOlder.current(), {
      root,
      rootMargin: '400px 0px',
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [canLoadOlder, loaded, messages.length]);

  // In a column-reverse list, scrollTop is 0 at the newest message and negative above it.
  const onScroll = () => {
    const node = scrollerRef.current;
    if (node) setAway(node.scrollTop < -320);
  };
  const toNewest = (smooth = true) => scrollerRef.current?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });

  const afterSend = (result: { message: Message; conversation: Conversation }) => {
    upsertMessage(id, result.message);
    queryClient.setQueryData(keys.conversation(id), result.conversation);
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  const sendText = async (text: string, retryOf?: Message) => {
    if (!id) return;
    const clientId = retryOf?.clientId ?? `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    upsertMessage(id, {
      id: clientId,
      clientId,
      conversationId: id,
      senderId: myId,
      text,
      kind: 'text',
      attachment: null,
      readAt: null,
      createdAt: new Date().toISOString(),
      pending: 'sending',
    });
    feedback.send();
    stopTyping(id);
    toNewest(false);
    try {
      afterSend(await api(`/api/conversations/${id}/messages`, { method: 'POST', body: { text, clientId } }));
    } catch (error) {
      patchMessages(id, (m) => (m.clientId === clientId ? { ...m, pending: 'failed' } : m));
      feedback.error();
      toast.error('Message not sent', errorMessage(error));
    }
  };

  const sendFile = async (file: UploadFile, caption: string) => {
    if (!id) return;
    const clientId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const isImage = file.type.startsWith('image/');
    upsertMessage(id, {
      id: clientId,
      clientId,
      conversationId: id,
      senderId: myId,
      text: caption,
      kind: isImage ? 'image' : 'file',
      attachment: { url: file.uri, downloadUrl: file.uri, name: file.name, mime: file.type, size: file.size ?? 0 },
      localUri: isImage ? file.uri : undefined,
      readAt: null,
      createdAt: new Date().toISOString(),
      pending: 'sending',
    });
    feedback.send();
    toNewest(false);
    try {
      afterSend(
        await upload(`/api/conversations/${id}/messages`, {
          fields: { text: caption, clientId },
          files: [{ field: 'file', file }],
        }),
      );
    } catch (error) {
      patchMessages(id, (m) => (m.clientId === clientId ? { ...m, pending: 'failed' } : m));
      feedback.error();
      toast.error('File not sent', errorMessage(error));
    }
  };

  const retry = (message: Message) => {
    if (message.kind !== 'text') {
      toast.info('Attach the file again to resend it.');
      return;
    }
    void sendText(message.text, message);
  };

  const answerRequest = async (action: 'accept' | 'decline') => {
    if (!id) return;
    setAnswering(action);
    try {
      if (action === 'accept') {
        const result = await api<{ conversation: Conversation }>(`/api/conversations/${id}/accept`, { method: 'POST' });
        queryClient.setQueryData(keys.conversation(id), result.conversation);
        feedback.success();
        toast.success('Request accepted', `You can now chat with ${firstName(other?.name)}.`);
      } else {
        await api(`/api/conversations/${id}/decline`, { method: 'POST' });
        feedback.tap();
        toast.info('Request declined', `${firstName(other?.name)} won't be told.`);
        goBack('/messages');
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error) {
      toast.error('Something went wrong', errorMessage(error));
    } finally {
      setAnswering(null);
    }
  };

  // Which of my messages carries the read receipt: the newest one.
  const newestMine = messages.find((m) => m.senderId === myId);
  const isRequestForMe = conversation?.status === 'request' && !conversation.isRequester;
  const isPendingMine = conversation?.status === 'request' && conversation.isRequester;
  const statusLine = typingUser ? 'typing…' : presence.online ? 'Online' : lastSeenText(presence.lastSeenAt);

  let body;
  if (conversationQuery.error) {
    body = (
      <div className={styles.center}>
        <ErrorState message={errorMessage(conversationQuery.error)} onRetry={() => conversationQuery.refetch()} />
      </div>
    );
  } else if (messagesQuery.isLoading) {
    body = (
      <div className={styles.center}>
        <RowSkeleton count={4} />
      </div>
    );
  } else {
    body = (
      <div ref={scrollerRef} className={styles.scroller} onScroll={onScroll} role="log" aria-live="polite" aria-label="Messages">
        <AnimatePresence>
          {typingUser && conversation?.status === 'active' ? (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              <TypingBubble />
            </motion.div>
          ) : null}
        </AnimatePresence>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState
              compact
              icon={IconMessageCircle}
              title={other ? `Say hello to ${firstName(other.name)}` : 'Start the conversation'}
              message={
                conversation?.status === 'request'
                  ? 'Your first message becomes a request. It moves to their inbox once they accept.'
                  : 'Messages are delivered instantly. Share papers, data or a quick question.'
              }
            />
          </div>
        ) : (
          messages.map((item, index) => {
            const older = messages[index + 1];
            const newer = messages[index - 1];
            const mine = item.senderId === myId;
            const time = new Date(item.createdAt).getTime();
            const groupStart =
              !older ||
              older.senderId !== item.senderId ||
              time - new Date(older.createdAt).getTime() > GROUP_GAP_MS ||
              !!dividerFor(item, older);
            const groupEnd = !newer || newer.senderId !== item.senderId || new Date(newer.createdAt).getTime() - time > GROUP_GAP_MS;
            let receipt: 'sending' | 'failed' | 'sent' | 'seen' | null = null;
            if (mine && item.pending) receipt = item.pending;
            else if (mine && newestMine?.id === item.id) receipt = item.readAt && conversation?.status === 'active' ? 'seen' : 'sent';
            return (
              <MessageBubble
                key={item.clientId ?? item.id}
                message={item}
                mine={mine}
                groupStart={groupStart}
                groupEnd={groupEnd}
                dayDivider={dividerFor(item, older)}
                receipt={receipt}
                animate={time > mountedAt.current}
                onImageClick={setViewing}
                onRetry={retry}
              />
            );
          })
        )}
        <div ref={olderRef} className={styles.older}>
          {messagesQuery.isFetchingNextPage ? <Spinner size={18} /> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <IconButton icon={IconArrowLeft} label="Back" onClick={() => goBack('/messages')} style={{ marginLeft: -8 }} />
          {other ? (
            <Link to={`/u/${other.username}`} className={`${styles.who} press`} aria-label={`${other.name}'s profile`}>
              <Avatar name={other.name} url={other.avatarUrl} size={40} online={presence.online} />
              <span className="col grow">
                <span className={`${styles.name} nowrap`}>{other.name}</span>
                <span
                  key={statusLine}
                  className={`${styles.status} nowrap`}
                  style={typingUser || presence.online ? { color: colors.accent } : undefined}
                >
                  {statusLine}
                </span>
              </span>
            </Link>
          ) : (
            <span className="grow" />
          )}
          {other ? <IconButton icon={IconInfo} label="View profile" to={`/u/${other.username}`} color={colors.text2} /> : null}
        </div>
      </header>

      <div className={styles.body}>
        {isPendingMine ? (
          <InlineNotice tone="info" className={styles.notice}>
            {`Message request sent. ${firstName(other?.name)} will see your messages after accepting your request.`}
          </InlineNotice>
        ) : null}
        {body}
        <AnimatePresence>
          {away ? (
            <motion.div
              key="to-newest"
              className={styles.toNewest}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
            >
              <IconButton
                icon={IconArrowDown}
                label="Go to newest messages"
                bordered
                background={colors.surfaceRaised}
                onClick={() => toNewest()}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {isRequestForMe ? (
        <div className={styles.requestBar}>
          <div className={styles.requestInner}>
            <p className="t-strong">{other?.name} wants to message you</p>
            <p className="t-meta">
              You're not connected. Accept to reply and move this chat to your inbox. They won't know you've read it until you accept.
            </p>
            <div className="row gap-10" style={{ marginTop: 6 }}>
              <Button
                label="Decline"
                variant="secondary"
                loading={answering === 'decline'}
                onClick={() => answerRequest('decline')}
                className="grow"
              />
              <Button
                label="Accept"
                variant="accent"
                loading={answering === 'accept'}
                onClick={() => answerRequest('accept')}
                className="grow"
                silent
              />
            </div>
          </div>
        </div>
      ) : conversation ? (
        <ChatComposer
          onSend={(text) => void sendText(text)}
          onAttach={(file, caption) => void sendFile(file, caption)}
          onTyping={() => {
            if (id && conversation.status === 'active') signalTyping(id);
          }}
        />
      ) : null}
      <Lightbox uri={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
