import { useParams } from 'react-router';
import { IconLock, IconUsers } from '@/components/icons';
import { ResearcherRow } from '@/components/network/ResearcherCard';
import { EmptyState, ErrorState, PageHeader, RowSkeleton } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { usePageTitle } from '@/lib/hooks';
import { useProfile, useUserConnections } from '@/lib/queries';
import { stagger } from '@/lib/style';
import page from './Page.module.css';

export default function ConnectionsPage() {
  const { handle = '' } = useParams();
  usePageTitle('Connections');
  const profile = useProfile(handle);
  const query = useUserConnections(handle);
  const name = profile.data?.user.name;
  const items = query.data?.results ?? [];

  return (
    <>
      <PageHeader title="Connections" subtitle={name} back backFallback={`/u/${handle}`} width="feed" />
      <main className={`container w-feed ${page.list}`} style={{ gap: 0 }}>
        {query.isLoading ? (
          <RowSkeleton count={5} />
        ) : query.error ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : query.data?.hidden ? (
          <EmptyState icon={IconLock} title="Connections are private" message="This researcher has chosen not to show their connections to you." />
        ) : !items.length ? (
          <EmptyState icon={IconUsers} title="No connections yet" />
        ) : (
          items.map((item, index) => (
            <div key={item.id} className="enter" style={stagger(index, 10)}>
              <ResearcherRow person={item} />
            </div>
          ))
        )}
      </main>
    </>
  );
}
