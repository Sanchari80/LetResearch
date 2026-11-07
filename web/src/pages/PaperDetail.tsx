import { Link, useParams } from 'react-router';
import {
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconFileText,
  IconLink,
  IconLock,
  IconPencil,
  IconShare,
  IconUser,
} from '@/components/icons';
import { AccessBadge } from '@/components/privacy/PrivacyControls';
import { Avatar, Button, Card, Chip, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { copyToClipboard, downloadPaper } from '@/lib/actions';
import { ApiError, errorMessage } from '@/lib/api';
import { paperLink } from '@/lib/config';
import { citation, fileKindLabel, fileSize, firstName, timeAgo } from '@/lib/format';
import { usePageTitle } from '@/lib/hooks';
import { downloadLabel, visibilityLabel } from '@/lib/privacy';
import { usePaper, usePaperDownloads } from '@/lib/queries';
import { stagger } from '@/lib/style';
import type { UserSummary } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';
import styles from './PaperDetail.module.css';
import { PublicBar } from './PublicBar';

function DownloadLog({ paperId }: { paperId: string }) {
  const query = usePaperDownloads(paperId);
  const rows = query.data?.results ?? [];
  return (
    <Card as="section" className="col gap-10">
      <h2 className="t-title">Downloaded by</h2>
      {query.isLoading ? (
        <Skeleton height={40} />
      ) : rows.length === 0 ? (
        <p className="t-meta">No downloads yet. You'll be notified the moment someone downloads this paper.</p>
      ) : (
        <ul className={styles.downloads}>
          {rows.map((row, i) => (
            <li key={row.id} className="enter" style={stagger(i)}>
              <Link to={`/u/${row.user.username}`} className={`${styles.downloadRow} press`}>
                <Avatar name={row.user.name} url={row.user.avatarUrl} size={36} />
                <span className="col grow">
                  <span className="t-strong nowrap">{row.user.name}</span>
                  <span className="t-caption">
                    {row.kind === 'link' ? 'Opened the link' : 'Downloaded'} {timeAgo(row.at)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LockedPaper({ owner, message }: { owner?: UserSummary; message: string }) {
  return (
    <EmptyState
      icon={IconLock}
      title="This paper is restricted"
      message={message}
      action={owner ? <Button label={`View ${firstName(owner.name)}'s profile`} icon={IconUser} to={`/u/${owner.username}`} /> : undefined}
    />
  );
}

export default function PaperDetailPage() {
  const { id = '' } = useParams();
  const { status } = useAuth();
  const query = usePaper(id);
  const signedIn = status === 'signedIn';
  const paper = query.data?.paper;
  const error = query.error;
  const locked = error instanceof ApiError && error.code === 'PAPER_LOCKED';
  usePageTitle(paper?.title ?? 'Paper');
  const cite = paper ? citation(paper.venue, paper.year) : '';

  return (
    <>
      <PublicBar title="Paper" />
      <main className={`container w-page ${styles.body}`}>
        {query.isLoading ? (
          <div className="col gap-12">
            <Skeleton width="30%" height={22} />
            <Skeleton width="90%" height={28} />
            <Skeleton width="70%" height={28} />
            <Skeleton width="50%" height={14} />
          </div>
        ) : locked ? (
          <LockedPaper owner={(error as ApiError).details?.owner as UserSummary | undefined} message={(error as ApiError).message} />
        ) : error || !paper ? (
          <ErrorState message={errorMessage(error, 'This paper could not be loaded.')} onRetry={() => query.refetch()} />
        ) : (
          <div className={styles.layout}>
            <article className={`${styles.main} enter`}>
              <div className={styles.badges}>
                <span className={styles.kind}>
                  {paper.kind === 'link' ? <IconLink size={13} aria-hidden /> : <IconFileText size={13} aria-hidden />}
                  {paper.kind === 'link' ? paper.linkHost || 'External link' : `${fileKindLabel(paper.file?.mime)} ${fileSize(paper.file?.size)}`}
                </span>
                <AccessBadge label={`View: ${visibilityLabel(paper.viewAccess)}`} value={paper.viewAccess} icon={IconEye} />
                <AccessBadge label={`Download: ${downloadLabel(paper.downloadAccess)}`} value={paper.downloadAccess} icon={IconDownload} />
              </div>
              <h1 className={styles.title}>{paper.title}</h1>
              {paper.authors.length ? (
                <p className="t-lead" style={{ color: colors.inkSoft }}>
                  {paper.authors.join(', ')}
                </p>
              ) : null}
              {cite ? <p className={styles.venue}>{cite}</p> : null}
              {paper.doi ? (
                <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="t-meta text-link" style={{ fontWeight: 500 }}>
                  DOI: {paper.doi}
                </a>
              ) : null}

              <div className={styles.actions}>
                {paper.canDownload ? (
                  <Button
                    label={paper.kind === 'link' ? 'Open paper' : 'Download paper'}
                    icon={paper.kind === 'link' ? IconExternalLink : IconDownload}
                    size="lg"
                    onClick={() => downloadPaper(paper.id, { signedIn, kind: paper.kind })}
                  />
                ) : (
                  <p className={styles.blocked}>
                    <IconLock size={16} color={colors.text2} aria-hidden />
                    <span className="t-meta">{query.data?.downloadNote}</span>
                  </p>
                )}
                {!signedIn && !paper.canDownload ? <Button label="Sign in" variant="secondary" to="/login" /> : null}
                {paper.isOwner ? (
                  <>
                    <Button label="Share to feed" icon={IconShare} variant="secondary" to={`/compose?paperId=${paper.id}`} />
                    <Button label="Edit" icon={IconPencil} variant="secondary" to={`/paper-editor?id=${paper.id}`} />
                  </>
                ) : null}
                <Button
                  label="Copy link"
                  icon={IconCopy}
                  variant="ghost"
                  onClick={() => copyToClipboard(paperLink(paper.id), 'Paper link copied')}
                />
              </div>

              {paper.abstract ? (
                <section className="col gap-6">
                  <h2 className="t-title">Abstract</h2>
                  <p className={`${styles.abstract} pre-wrap`}>{paper.abstract}</p>
                </section>
              ) : null}
              {paper.keywords.length ? (
                <div className="row wrap gap-6" aria-label="Keywords">
                  {paper.keywords.map((k) => (
                    <Chip key={k} label={k} tone="steel" small />
                  ))}
                </div>
              ) : null}
            </article>

            <aside className={`${styles.side} enter`} style={stagger(2)}>
              <Card className="col gap-12">
                <Link to={`/u/${paper.owner.username}`} className={`${styles.author} press`}>
                  <Avatar name={paper.owner.name} url={paper.owner.avatarUrl} size={46} online={paper.owner.online} />
                  <span className="col grow">
                    <span className={styles.authorName}>{paper.owner.name}</span>
                    <span className="t-caption clamp-2">{paper.owner.headline || 'Researcher'}</span>
                  </span>
                </Link>
                <div className={styles.stats}>
                  <div className="grow">
                    <p className={styles.statValue}>{paper.stats?.views ?? 0}</p>
                    <p className="t-caption">Views</p>
                  </div>
                  <div className="grow">
                    <p className={styles.statValue}>{paper.stats?.downloads ?? 0}</p>
                    <p className="t-caption">{paper.kind === 'link' ? 'Opens' : 'Downloads'}</p>
                  </div>
                </div>
              </Card>
              {paper.isOwner ? <DownloadLog paperId={paper.id} /> : null}
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
