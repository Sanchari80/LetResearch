import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { PostCard } from '@/components/feed/PostCard';
import { IconCheck, IconFlag, IconShieldCheck, IconTrash } from '@/components/icons';
import { Button, Card, EmptyState, ErrorState, PageHeader, PullToRefresh, RowSkeleton, TextField } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { timeAgo } from '@/lib/format';
import { usePageTitle } from '@/lib/hooks';
import { keys, useModerationQueue } from '@/lib/queries';
import type { Post } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import styles from './Moderation.module.css';
import page from './Page.module.css';

function QueueItem({ post, index }: { post: Post; index: number }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const review = async (action: 'approve' | 'remove') => {
    setBusy(action);
    try {
      await api(`/api/moderation/posts/${post.id}/${action}`, { method: 'POST', body: { reason } });
      feedback.success();
      toast.success(action === 'approve' ? 'Post restored' : 'Post removed', 'The author has been notified.');
      queryClient.setQueryData<Post[]>(keys.moderation, (list) => list?.filter((p) => p.id !== post.id));
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch (error) {
      toast.error('Review failed', errorMessage(error));
      setBusy(null);
    }
  };

  return (
    <motion.section
      layout
      className="col gap-10"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 6) * 0.06, duration: 0.28 } }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      aria-label={`Reported post by ${post.author.name}`}
    >
      <Card className={styles.reports}>
        <p className="row gap-8 t-strong" style={{ color: colors.warning }}>
          <IconFlag size={16} aria-hidden />
          {post.reports?.length ?? 0} reports
        </p>
        {(post.reports ?? []).slice(0, 5).map((r, i) => (
          <p key={i} className="t-caption">
            “{r.reason}” {timeAgo(r.at)}
          </p>
        ))}
      </Card>
      <PostCard post={post} signedIn />
      <TextField value={reason} onChange={setReason} placeholder="Reason shown to the author if removed (optional)" />
      <div className="row gap-10">
        <Button
          label="Restore post"
          icon={IconCheck}
          variant="secondary"
          loading={busy === 'approve'}
          onClick={() => review('approve')}
          className="grow"
          silent
        />
        <Button
          label="Remove post"
          icon={IconTrash}
          variant="danger"
          loading={busy === 'remove'}
          onClick={() => review('remove')}
          className="grow"
          silent
        />
      </div>
    </motion.section>
  );
}

export default function ModerationPage() {
  usePageTitle('Moderation');
  const { isAdmin } = useAuth();
  const query = useModerationQueue(isAdmin);
  const items = query.data ?? [];
  return (
    <>
      <PullToRefresh onRefresh={() => query.refetch()} />
      <PageHeader title="Reported posts" back backFallback="/settings" width="feed" />
      <main className={`container w-feed ${page.body}`} style={{ gap: 28 }}>
        {!isAdmin ? (
          <EmptyState icon={IconShieldCheck} title="Moderators only" message="Ask the LetResearch administrator to add your email to ADMIN_EMAILS." />
        ) : query.isLoading ? (
          <RowSkeleton count={3} />
        ) : query.error ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={IconShieldCheck} title="Nothing to review" message="Posts hidden by community reports will appear here." />
        ) : (
          <AnimatePresence initial={false}>
            {items.map((post, i) => (
              <QueueItem key={post.id} post={post} index={i} />
            ))}
          </AnimatePresence>
        )}
      </main>
    </>
  );
}
