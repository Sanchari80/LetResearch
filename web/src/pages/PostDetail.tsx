import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { PostCard } from '@/components/feed/PostCard';
import { IconCircleAlert, IconMessageSquare, IconSend, IconTrash } from '@/components/icons';
import { Avatar, Button, confirm, EmptyState, ErrorState, IconButton, InlineNotice, PostSkeleton } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { timeAgo } from '@/lib/format';
import { usePageTitle, useShake } from '@/lib/hooks';
import { isTouchDevice } from '@/lib/pickers';
import { keys, updatePostEverywhere, useComments, usePost } from '@/lib/queries';
import type { Comment } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import styles from './PostDetail.module.css';
import { PublicBar } from './PublicBar';

export default function PostDetailPage() {
  const { id = '' } = useParams();
  const { status, user } = useAuth();
  const queryClient = useQueryClient();
  const post = usePost(id);
  const comments = useComments(id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { shakeRef, shake } = useShake<HTMLFormElement>();
  const signedIn = status === 'signedIn';
  usePageTitle(post.data ? `${post.data.author.name}'s post` : 'Post');

  useLayoutEffect(() => {
    const area = inputRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(120, area.scrollHeight)}px`;
  }, [text]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = text.trim();
    if (!value || !id || sending) return;
    setSending(true);
    setReasons([]);
    try {
      const result = await api<{ comment: Comment }>(`/api/posts/${id}/comments`, { method: 'POST', body: { text: value } });
      queryClient.setQueryData<Comment[]>(keys.comments(id), (list) => [...(list ?? []), result.comment]);
      updatePostEverywhere(id, (p) => ({ ...p, commentCount: p.commentCount + 1 }));
      setText('');
      feedback.send();
    } catch (error) {
      feedback.error();
      shake();
      if (error instanceof ApiError && error.reasons.length) setReasons(error.reasons);
      else toast.error('Comment not posted', errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const remove = async (comment: Comment) => {
    const ok = await confirm({ title: 'Delete this comment?', confirmLabel: 'Delete', destructive: true });
    if (!ok || !id) return;
    try {
      await api(`/api/posts/${id}/comments/${comment.id}`, { method: 'DELETE' });
      queryClient.setQueryData<Comment[]>(keys.comments(id), (list) => list?.filter((c) => c.id !== comment.id));
      updatePostEverywhere(id, (p) => ({ ...p, commentCount: Math.max(0, p.commentCount - 1) }));
      feedback.tap();
    } catch (error) {
      toast.error('Delete failed', errorMessage(error));
    }
  };

  const list = comments.data ?? [];

  return (
    <div className={styles.page}>
      <PublicBar title="Post" width="feed" />
      <main className={`container w-feed ${styles.body}`}>
        {post.isLoading ? (
          <PostSkeleton />
        ) : post.error || !post.data ? (
          <ErrorState message={errorMessage(post.error, 'This post is not available.')} onRetry={() => post.refetch()} />
        ) : (
          <div className="enter">
            <PostCard post={post.data} signedIn={signedIn} detail onCommentClick={() => inputRef.current?.focus()} />
          </div>
        )}

        <h2 className="t-title" style={{ marginTop: 22, marginBottom: 6 }}>
          Comments
        </h2>
        {comments.isLoading ? null : list.length === 0 ? (
          <EmptyState compact icon={IconMessageSquare} title="No comments yet" message="Start the discussion with a question or a thought." />
        ) : (
          <ul className={styles.comments}>
            <AnimatePresence initial={false}>
              {list.map((comment, i) => (
                <motion.li
                  key={comment.id}
                  layout="position"
                  className={styles.comment}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.04, duration: 0.26 } }}
                  exit={{ opacity: 0, transition: { duration: 0.18 } }}
                >
                  <Link to={`/u/${comment.author.username}`} className="press" aria-label={`${comment.author.name}'s profile`}>
                    <Avatar name={comment.author.name} url={comment.author.avatarUrl} size={36} />
                  </Link>
                  <div className={styles.bubble}>
                    <div className={styles.commentHead}>
                      <Link to={`/u/${comment.author.username}`} className={`${styles.commentName} nowrap`}>
                        {comment.author.name}
                      </Link>
                      <span className="t-caption grow">{timeAgo(comment.createdAt)}</span>
                      {comment.isOwner || post.data?.isOwner ? (
                        <IconButton icon={IconTrash} label="Delete comment" size={28} color={colors.text3} onClick={() => remove(comment)} />
                      ) : null}
                    </div>
                    <p className="t-body pre-wrap" style={{ color: colors.inkSoft }}>
                      {comment.text}
                    </p>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </main>

      <div className={styles.composer}>
        {signedIn ? (
          <form ref={shakeRef} className={styles.composerInner} onSubmit={submit}>
            {reasons.length ? (
              <InlineNotice tone="danger" icon={IconCircleAlert} style={{ marginBottom: 8 }}>
                {reasons.join(' ')}
              </InlineNotice>
            ) : null}
            <div className={styles.composerRow}>
              <Avatar name={user?.name} url={user?.avatarUrl} size={34} />
              <textarea
                ref={inputRef}
                rows={1}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (reasons.length) setReasons([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isTouchDevice()) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder="Add a comment…"
                aria-label="Add a comment"
                maxLength={1500}
                className={styles.input}
              />
              <IconButton
                icon={IconSend}
                label="Post comment"
                onClick={() => submit()}
                disabled={!text.trim() || sending}
                background={text.trim() ? colors.accent : '#C9CED5'}
                color={colors.white}
                size={40}
                silent
              />
            </div>
          </form>
        ) : (
          <div className={`${styles.composerInner} ${styles.signedOut}`}>
            <p className="t-meta">Sign in to like and comment.</p>
            <Button label="Sign in" to="/login" />
          </div>
        )}
      </div>
    </div>
  );
}
