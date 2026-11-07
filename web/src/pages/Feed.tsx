import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PostCard } from '@/components/feed/PostCard';
import {
  IconFileText,
  IconImage,
  IconLink,
  IconMessageSquare,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShieldCheck,
  type IconProps,
} from '@/components/icons';
import { InstallBanner } from '@/components/InstallApp';
import { ResearcherCard } from '@/components/network/ResearcherCard';
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingRow,
  Logo,
  PageHeader,
  PostSkeleton,
  PullToRefresh,
  Segmented,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { POST_CATEGORIES } from '@/lib/constants';
import { feedback } from '@/lib/feedback';
import { useInfiniteScroll, useLayout, usePageTitle } from '@/lib/hooks';
import { useFeed, useSuggestions } from '@/lib/queries';
import { stagger } from '@/lib/style';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';
import styles from './Feed.module.css';

const QUICK: { kind: string; label: string; icon: ComponentType<IconProps> }[] = [
  { kind: 'update', label: 'Update', icon: IconPencil },
  { kind: 'link', label: 'Link', icon: IconLink },
  { kind: 'paper', label: 'Paper', icon: IconFileText },
  { kind: 'media', label: 'Media', icon: IconImage },
];

function Composer() {
  const { user } = useAuth();
  return (
    <Card className="col gap-12">
      <Link to="/compose" className={`${styles.composerTop} press`} aria-label="Create a post" onClick={() => feedback.tap()}>
        <Avatar name={user?.name} url={user?.avatarUrl} size={42} />
        <span className={styles.composerInput}>Share a research update…</span>
      </Link>
      <div className={styles.quickRow}>
        {QUICK.map(({ kind, label, icon: Icon }) => (
          <Link
            key={kind}
            to={`/compose?kind=${kind}`}
            className={`${styles.quick} press`}
            aria-label={`New ${label.toLowerCase()} post`}
            onClick={() => feedback.tap()}
          >
            <Icon size={18} color={colors.accent} aria-hidden />
            <span className={`${styles.quickText} nowrap`}>{label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function FeedRail() {
  const suggestions = useSuggestions('all');
  const people = suggestions.data?.results.slice(0, 3) ?? [];
  return (
    <aside className={styles.rail} aria-label="Suggestions">
      <InstallBanner style={{ marginBottom: 6 }} />
      <h2 className="t-title">Suggested researchers</h2>
      {people.map((person, i) => (
        <div key={person.id} className="enter" style={stagger(i)}>
          <ResearcherCard person={person} compact />
        </div>
      ))}
      <Button label="See more suggestions" variant="ghost" to="/network" />
      <Card className="col gap-8">
        <p className="row gap-8 t-strong">
          <IconShieldCheck size={18} color={colors.success} aria-hidden />
          An academic-only feed
        </p>
        <p className="t-meta">Posts are checked before they appear. Memes, reels and non-research media are not published.</p>
        <Link to="/guidelines" className="t-meta text-link" style={{ fontWeight: 500 }}>
          Read the community guidelines
        </Link>
      </Card>
    </aside>
  );
}

/** Round "new post" button that appears on phones once the composer has scrolled away. */
function FloatingCompose() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 260);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="fab"
          className={styles.fabWrap}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 380, damping: 16 } }}
          exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.15 } }}
        >
          <Link to="/compose" className={`${styles.fab} press`} aria-label="Create a post" onClick={() => feedback.tap()}>
            <IconPlus size={26} color={colors.white} aria-hidden />
          </Link>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function FeedPage() {
  usePageTitle('Feed');
  const { width, isWide } = useLayout();
  // Scope and category live in the address, so coming back from a post restores the same list and scroll position.
  const [params, setParams] = useSearchParams();
  const scope: 'all' | 'network' = params.get('scope') === 'network' ? 'network' : 'all';
  const requestedCategory = params.get('category');
  const category = requestedCategory && (POST_CATEGORIES as readonly string[]).includes(requestedCategory) ? requestedCategory : 'All';
  const setFilters = (next: { scope?: 'all' | 'network'; category?: string }) => {
    const s = next.scope ?? scope;
    const c = next.category ?? category;
    const updated: Record<string, string> = {};
    if (s !== 'all') updated.scope = s;
    if (c !== 'All') updated.category = c;
    setParams(updated, { replace: true });
  };
  const feed = useFeed(scope, category);
  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.results) ?? [], [feed.data]);
  const showRail = width >= 1240;
  const sentinel = useInfiniteScroll(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, !!feed.hasNextPage);

  return (
    <>
      <PullToRefresh onRefresh={() => feed.refetch()} />
      {!isWide ? (
        <PageHeader
          width="feed"
          left={<Logo size={26} />}
          right={
            <>
              <IconButton icon={IconSearch} label="Search researchers" to="/search" />
              <IconButton icon={IconSettings} label="Settings" to="/settings" />
            </>
          }
        />
      ) : null}
      <div className={styles.layout}>
        <main className={`container w-feed ${styles.main}`}>
          {isWide ? (
            <div className={styles.wideTitle}>
              <h1 className="t-heading grow">Feed</h1>
              <IconButton icon={IconSearch} label="Search researchers" bordered background={colors.surfaceRaised} to="/search" />
            </div>
          ) : null}
          <div className="col gap-14">
            {!showRail ? <InstallBanner /> : null}
            <Composer />
            <Segmented
              label="Feed"
              value={scope}
              onChange={(value) => setFilters({ scope: value })}
              options={[
                { value: 'all', label: 'All research' },
                { value: 'network', label: 'My network' },
              ]}
            />
            <div className={styles.chips} role="group" aria-label="Category">
              {['All', ...POST_CATEGORIES].map((c) => (
                <Chip key={c} label={c} selected={category === c} onClick={() => setFilters({ category: c })} />
              ))}
            </div>
          </div>

          <div className={styles.posts}>
            {feed.isLoading ? (
              <>
                <PostSkeleton />
                <PostSkeleton />
              </>
            ) : feed.error && !posts.length ? (
              <ErrorState message={errorMessage(feed.error)} onRetry={() => feed.refetch()} />
            ) : !posts.length ? (
              <EmptyState
                icon={IconMessageSquare}
                title={scope === 'network' ? 'Your network is quiet' : 'No posts here yet'}
                message={
                  scope === 'network'
                    ? 'Connect with researchers to see their updates here, or switch to All research.'
                    : 'Be the first to share an update in this category.'
                }
                action={<Button label="Create a post" icon={IconPlus} to="/compose" />}
              />
            ) : (
              posts.map((post, index) => (
                <div key={post.id} className="enter" style={stagger(index % 10, 6)}>
                  <PostCard post={post} signedIn />
                </div>
              ))
            )}
          </div>
          <div ref={sentinel} />
          {feed.isFetchingNextPage ? <LoadingRow /> : null}
        </main>
        {showRail ? <FeedRail /> : null}
      </div>
      {!isWide ? <FloatingCompose /> : null}
    </>
  );
}
