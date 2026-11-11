import { Link } from 'react-router';
import { downloadPaper } from '@/lib/actions';
import { feedback } from '@/lib/feedback';
import { citation } from '@/lib/format';
import type { PostPaper } from '@/lib/types';
import { colors } from '@/theme';
import { IconDownload, IconExternalLink, IconFileText, IconLink, IconLock } from '../icons';
import { Button } from '../ui';
import styles from './PostAttachments.module.css';

/** Research link as a reference card. */
export function LinkCard({ url, domain }: { url: string; domain: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.link}
      aria-label={`Open link on ${domain}`}
      onClick={() => feedback.tap()}
    >
      <span className={styles.linkIcon}>
        <IconLink size={18} color={colors.accent} aria-hidden />
      </span>
      <span className="col grow">
        <span className={`${styles.domain} nowrap`}>{domain}</span>
        <span className="t-caption nowrap">{url.replace(/^https?:\/\//, '')}</span>
      </span>
      <IconExternalLink size={16} color={colors.text2} aria-hidden />
    </a>
  );
}

/** A shared paper, shown as a citation with view/download actions. */
export function PaperAttachment({ paper, signedIn }: { paper: PostPaper; signedIn: boolean }) {
  if (paper.locked || !paper.id) {
    return (
      <div className={`${styles.paper} ${styles.paperLocked}`}>
        <IconLock size={18} color={colors.text2} aria-hidden />
        <p className="t-meta grow">
          {paper.removed ? 'This paper was removed by its author.' : 'This paper is visible to the author’s connections only.'}
        </p>
      </div>
    );
  }
  const id = paper.id;
  return (
    <div className={styles.paper}>
      <Link to={`/paper/${id}`} className={styles.paperMain} aria-label={`Open paper: ${paper.title}`} onClick={() => feedback.tap()}>
        <span className={styles.paperIcon}>
          <IconFileText size={20} color={colors.white} aria-hidden />
        </span>
        <span className="col grow gap-4">
          <span className={`${styles.paperTitle} clamp-3`}>{paper.title}</span>
          {paper.authors?.length ? <span className="t-caption nowrap">{paper.authors.join(', ')}</span> : null}
          {citation(paper.venue, paper.year) ? <span className={styles.venue}>{citation(paper.venue, paper.year)}</span> : null}
        </span>
      </Link>
      <div className={styles.paperActions}>
        <Button label="View paper" size="sm" variant="secondary" to={`/paper/${id}`} />
        {paper.canDownload ? (
          <Button
            label={paper.kind === 'link' ? 'Open' : 'Download'}
            icon={paper.kind === 'link' ? IconExternalLink : IconDownload}
            size="sm"
            onClick={() => downloadPaper(id, { signedIn, kind: paper.kind })}
          />
        ) : (
          <span className={styles.noDownload}>
            <IconLock size={13} color={colors.text3} aria-hidden />
            <span className="t-caption">
              {paper.downloadAccess === 'paid'
                ? `Paid access · ${paper.pricing ? `$${paper.pricing.amount.toFixed(2)} ${paper.pricing.currency}` : 'price unavailable'} · checkout coming soon`
                : 'Download restricted'}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
