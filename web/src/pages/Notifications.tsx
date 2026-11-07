import type { InfiniteData } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { IconBell, IconCheckCheck } from '@/components/icons';
import { NotificationRow } from '@/components/notifications/NotificationRow';
import { PushPrompt } from '@/components/PushNotifications';
import { Button, EmptyState, ErrorState, LoadingRow, PullToRefresh, RowSkeleton, Segmented } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { useInfiniteScroll, usePageTitle } from '@/lib/hooks';
import { queryClient, useNotifications } from '@/lib/queries';
import type { AppNotification, Page } from '@/lib/types';
import { useRealtime } from '@/store/realtime';
import styles from './Notifications.module.css';

type Category = 'all' | 'requests' | 'engagement' | 'downloads';
type NotificationPage = Page<AppNotification> & { unreadByCategory: Record<string, number> };

const CATEGORIES: Category[] = ['all', 'requests', 'engagement', 'downloads'];
const EMPTY: Record<Category, string> = {
  all: 'Requests, likes, comments and paper downloads will show up here.',
  requests: 'Connection and message requests will show up here.',
  engagement: 'Likes and comments on your posts will show up here.',
  downloads: 'You will be told here whenever someone downloads one of your papers.',
};

export default function NotificationsPage() {
  usePageTitle('Notifications');
  const [params, setParams] = useSearchParams();
  const requested = params.get('category') as Category | null;
  const category: Category = requested && CATEGORIES.includes(requested) ? requested : 'all';
  const query = useNotifications(category);
  const unreadTotal = useRealtime((s) => s.counts.notifications);
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.results) ?? [], [query.data]);
  const byCategory = query.data?.pages[0]?.unreadByCategory ?? {};
  const sentinel = useInfiniteScroll(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, !!query.hasNextPage);

  const markAll = async () => {
    feedback.success();
    queryClient.setQueriesData<InfiniteData<NotificationPage>>({ queryKey: ['notifications'] }, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((p) => ({ ...p, results: p.results.map((n) => ({ ...n, read: true })), unreadByCategory: {} })),
          }
        : data,
    );
    useRealtime.getState().setCounts({ notifications: 0 });
    await api('/api/notifications/read-all', { method: 'POST', body: { category: 'all' } }).catch(() => {});
  };

  return (
    <main className={`container w-feed ${styles.body}`}>
      <PullToRefresh onRefresh={() => query.refetch()} />
      <div className="col gap-14">
        <div className="row">
          <h1 className="t-heading grow">Notifications</h1>
          <AnimatePresence>
            {unreadTotal > 0 ? (
              <motion.span key="mark" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Button label="Mark all read" icon={IconCheckCheck} size="sm" variant="ghost" onClick={markAll} silent />
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
        <PushPrompt />
        <Segmented
          label="Notification type"
          value={category}
          onChange={(next) => setParams(next === 'all' ? {} : { category: next }, { replace: true })}
          options={[
            { value: 'all', label: 'All' },
            { value: 'requests', label: 'Requests', dot: !!byCategory.requests },
            { value: 'engagement', label: 'Activity', dot: !!byCategory.engagement },
            { value: 'downloads', label: 'Downloads', dot: !!byCategory.downloads },
          ]}
        />
      </div>

      <div key={category} className={styles.list}>
        {query.isLoading ? (
          <RowSkeleton count={6} />
        ) : query.error && !items.length ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : !items.length ? (
          <EmptyState icon={IconBell} title="You're all caught up" message={EMPTY[category]} />
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                layout="position"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.035, duration: 0.26 } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
              >
                <NotificationRow notification={item} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
      <div ref={sentinel} />
      {query.isFetchingNextPage ? <LoadingRow /> : null}
    </main>
  );
}
