import { useSearchParams } from 'react-router';
import { ConversationRow } from '@/components/chat/ConversationRow';
import { IconInbox, IconMessageCircle, IconUsers } from '@/components/icons';
import { Button, EmptyState, ErrorState, InlineNotice, PullToRefresh, RowSkeleton, Segmented } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { usePageTitle } from '@/lib/hooks';
import { useConversations } from '@/lib/queries';
import { stagger } from '@/lib/style';
import { useAuth } from '@/providers/AuthProvider';
import { useRealtime } from '@/store/realtime';
import styles from './Messages.module.css';

type Box = 'inbox' | 'requests';

export default function MessagesPage() {
  usePageTitle('Messages');
  const { user } = useAuth();
  const counts = useRealtime((s) => s.counts);
  const [params, setParams] = useSearchParams();
  const box: Box = params.get('box') === 'requests' ? 'requests' : 'inbox';
  const query = useConversations(box);
  const items = query.data ?? [];

  return (
    <main className={`container w-feed ${styles.body}`}>
      <PullToRefresh onRefresh={() => query.refetch()} />
      <div className="col gap-14">
        <h1 className="t-heading">Messages</h1>
        <Segmented
          label="Messages"
          value={box}
          onChange={(next) => setParams(next === 'inbox' ? {} : { box: next }, { replace: true })}
          options={[
            { value: 'inbox', label: 'Inbox', badge: counts.messages },
            { value: 'requests', label: 'Message requests', badge: counts.messageRequests },
          ]}
        />
        {box === 'requests' && items.length ? (
          <InlineNotice tone="info">
            Requests come from researchers you are not connected with. They won't know you've seen a message until you accept.
          </InlineNotice>
        ) : null}
      </div>

      <div key={box} className={styles.list}>
        {query.isLoading ? (
          <RowSkeleton count={5} />
        ) : query.error && !items.length ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : !items.length ? (
          box === 'inbox' ? (
            <EmptyState
              icon={IconMessageCircle}
              title="No conversations yet"
              message="Open a researcher's profile and tap Message to start a conversation."
              action={<Button label="Find researchers" icon={IconUsers} to="/network" />}
            />
          ) : (
            <EmptyState
              icon={IconInbox}
              title="No message requests"
              message="Messages from people you're not connected with will wait here for your approval."
            />
          )
        ) : (
          items.map((item, index) => (
            <div key={item.id} className="enter" style={stagger(index)}>
              <ConversationRow conversation={item} myId={user!.id} />
            </div>
          ))
        )}
      </div>
    </main>
  );
}
