import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { IconMessageCircle, IconSearch, IconUserCheck, IconUserPlus, IconUsers } from '@/components/icons';
import { ResearcherCard, ResearcherRow } from '@/components/network/ResearcherCard';
import { Button, Card, Chip, EmptyState, ErrorState, IconButton, PullToRefresh, RowSkeleton, Segmented } from '@/components/ui';
import { openChatWith } from '@/lib/actions';
import { api, errorMessage } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { timeAgo } from '@/lib/format';
import { usePageTitle } from '@/lib/hooks';
import { keys, useConnectionRequests, useConnections, useSuggestions } from '@/lib/queries';
import { stagger } from '@/lib/style';
import type { ConnectionRequest } from '@/lib/types';
import { useRealtime } from '@/store/realtime';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import styles from './Network.module.css';
import page from './Page.module.css';

type Tab = 'suggestions' | 'requests' | 'connections';
type Filter = 'all' | 'location' | 'interests' | 'institution';

const TABS: Tab[] = ['suggestions', 'requests', 'connections'];
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Best match' },
  { value: 'location', label: 'Near you' },
  { value: 'interests', label: 'Shared interests' },
  { value: 'institution', label: 'Same institution' },
];

function Suggestions() {
  const [filter, setFilter] = useState<Filter>('all');
  const query = useSuggestions(filter);
  const people = query.data?.results ?? [];
  const missing =
    (filter === 'location' && query.data && !query.data.hasLocation) ||
    (filter === 'interests' && query.data && !query.data.hasInterests) ||
    (filter === 'institution' && query.data && !query.data.hasInstitution);

  return (
    <div className="col gap-14">
      <div className={styles.filters} role="group" aria-label="Suggestion filter">
        {FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={filter === f.value} onClick={() => setFilter(f.value)} />
        ))}
      </div>
      {query.isLoading ? (
        <RowSkeleton count={4} />
      ) : query.error ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : missing ? (
        <EmptyState
          compact
          icon={IconUsers}
          title="Complete your profile first"
          message={`Add your ${filter === 'location' ? 'location' : filter === 'interests' ? 'research interests' : 'institution'} to find researchers like you.`}
          action={<Button label="Edit profile" to="/edit-profile" />}
        />
      ) : people.length === 0 ? (
        <EmptyState compact icon={IconUsers} title="No suggestions right now" message="Check back as more researchers join LetResearch." />
      ) : (
        <div className={styles.grid}>
          {people.map((person, i) => (
            <div key={person.id} className="enter" style={stagger(i)}>
              <ResearcherCard person={person} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RequestRow({ request, kind }: { request: ConnectionRequest; kind: 'received' | 'sent' }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (action: 'accept' | 'decline' | 'withdraw') => {
    setBusy(action);
    try {
      if (action === 'withdraw') await api(`/api/connections/${request.id}`, { method: 'DELETE' });
      else await api(`/api/connections/${request.id}/${action}`, { method: 'POST' });
      if (action === 'accept') {
        feedback.success();
        toast.success(`You and ${request.user.name} are now connected`);
      } else feedback.tap();
      queryClient.setQueryData<{ received: ConnectionRequest[]; sent: ConnectionRequest[] }>(keys.connectionRequests, (d) =>
        d ? { received: d.received.filter((r) => r.id !== request.id), sent: d.sent.filter((r) => r.id !== request.id) } : d,
      );
      queryClient.invalidateQueries({ queryKey: keys.connections });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (error) {
      feedback.error();
      toast.error('Something went wrong', errorMessage(error));
      setBusy(null);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
      style={{ overflow: 'hidden' }}
    >
      <ResearcherRow
        person={request.user}
        right={
          kind === 'received' ? (
            <div className="row gap-6">
              <Button label="Decline" size="sm" variant="ghost" loading={busy === 'decline'} onClick={() => act('decline')} />
              <Button label="Accept" size="sm" variant="accent" loading={busy === 'accept'} onClick={() => act('accept')} silent />
            </div>
          ) : (
            <Button label="Withdraw" size="sm" variant="secondary" loading={busy === 'withdraw'} onClick={() => act('withdraw')} />
          )
        }
      />
      <p className={`t-caption ${styles.requestTime}`}>
        {kind === 'received' ? 'Sent you a request' : 'Request sent'} {timeAgo(request.createdAt)}
      </p>
    </motion.div>
  );
}

function Requests() {
  const query = useConnectionRequests();
  if (query.isLoading) return <RowSkeleton count={3} />;
  if (query.error) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  const { received = [], sent = [] } = query.data ?? {};
  if (!received.length && !sent.length) {
    return (
      <EmptyState
        compact
        icon={IconUserPlus}
        title="No pending requests"
        message="When researchers ask to connect with you, their requests appear here."
      />
    );
  }
  return (
    <div className="col gap-14">
      {received.length ? (
        <Card as="section" className={styles.listCard}>
          <h2 className={`t-title ${styles.listTitle}`}>Received</h2>
          <AnimatePresence initial={false}>
            {received.map((r) => (
              <RequestRow key={r.id} request={r} kind="received" />
            ))}
          </AnimatePresence>
        </Card>
      ) : null}
      {sent.length ? (
        <Card as="section" className={styles.listCard}>
          <h2 className={`t-title ${styles.listTitle}`}>Sent</h2>
          <AnimatePresence initial={false}>
            {sent.map((r) => (
              <RequestRow key={r.id} request={r} kind="sent" />
            ))}
          </AnimatePresence>
        </Card>
      ) : null}
    </div>
  );
}

function Connections() {
  const query = useConnections();
  if (query.isLoading) return <RowSkeleton count={5} />;
  if (query.error) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  const rows = query.data ?? [];
  if (!rows.length) {
    return (
      <EmptyState
        compact
        icon={IconUserCheck}
        title="No connections yet"
        message="Connect with researchers to share connection-only papers and details."
      />
    );
  }
  return (
    <Card className={styles.listCard}>
      {rows.map((row, i) => (
        <div key={row.connectionId} className="enter" style={stagger(i, 10)}>
          <ResearcherRow
            person={row.user}
            right={
              <IconButton
                icon={IconMessageCircle}
                label={`Message ${row.user.name}`}
                bordered
                background={colors.surfaceRaised}
                size={36}
                onClick={() => openChatWith(row.user.id, { signedIn: true })}
              />
            }
          />
        </div>
      ))}
    </Card>
  );
}

export default function NetworkPage() {
  usePageTitle('Network');
  const [params, setParams] = useSearchParams();
  const counts = useRealtime((s) => s.counts);
  const queryClient = useQueryClient();
  const requested = params.get('tab') as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) ? requested : 'suggestions';

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['suggestions'] }),
      queryClient.invalidateQueries({ queryKey: keys.connectionRequests }),
      queryClient.invalidateQueries({ queryKey: keys.connections }),
    ]);

  return (
    <main className={`container w-page ${page.body} ${styles.body}`}>
      <PullToRefresh onRefresh={refresh} />
      <h1 className="t-heading">Network</h1>
      <Link to="/search" className={`${styles.search} press`} aria-label="Search researchers" onClick={() => feedback.tap()}>
        <IconSearch size={18} color={colors.text2} aria-hidden />
        <span>Search by name, institution or interest</span>
      </Link>
      <Segmented
        label="Network"
        value={tab}
        onChange={(next) => setParams(next === 'suggestions' ? {} : { tab: next }, { replace: true })}
        options={[
          { value: 'suggestions', label: 'Suggestions' },
          { value: 'requests', label: 'Requests', badge: counts.connectionRequests },
          { value: 'connections', label: 'Connections' },
        ]}
      />
      <div key={tab} className="enter">
        {tab === 'suggestions' ? <Suggestions /> : tab === 'requests' ? <Requests /> : <Connections />}
      </div>
    </main>
  );
}
