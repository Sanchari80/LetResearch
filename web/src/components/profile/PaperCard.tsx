import { Link } from 'react-router';
import { downloadPaper } from '@/lib/actions';
import { feedback } from '@/lib/feedback';
import { citation, fileKindLabel } from '@/lib/format';
import { downloadLabel, visibilityLabel } from '@/lib/privacy';
import type { PaperSummary } from '@/lib/types';
import { colors } from '@/theme';
import { IconDownload, IconExternalLink, IconEye, IconFileText, IconLink, IconLock } from '../icons';
import { AccessBadge } from '../privacy/PrivacyControls';
import { Button, Card } from '../ui';
import styles from './PaperCard.module.css';

/** Portfolio card: citation, abstract preview, access badges and the download action. */
export function PaperCard({ paper, index, signedIn }: { paper: PaperSummary; index?: number; signedIn: boolean }) {
  const KindIcon = paper.kind === 'link' ? IconLink : IconFileText;
  const kindLabel = paper.kind === 'link' ? paper.linkHost || 'External link' : fileKindLabel(paper.file?.mime);
  const blocked = !paper.canDownload;
  return (
    <Card as="article" className={styles.card}>
      <Link to={`/paper/${paper.id}`} className={styles.main} aria-label={`Open paper: ${paper.title}`} onClick={() => feedback.tap()}>
        <span className={styles.top}>
          <span className={styles.kind}>
            <KindIcon size={13} color={colors.inkSoft} aria-hidden />
            <span className="nowrap">{kindLabel}</span>
          </span>
          {index ? <span className={styles.index}>[{index}]</span> : null}
        </span>
        <span className={`${styles.title} clamp-3`}>{paper.title}</span>
        {paper.authors.length ? <span className="t-meta nowrap">{paper.authors.join(', ')}</span> : null}
        {citation(paper.venue, paper.year) ? <span className={styles.venue}>{citation(paper.venue, paper.year)}</span> : null}
        {paper.abstractPreview ? (
          <span className="t-meta clamp-3" style={{ color: colors.inkSoft }}>
            {paper.abstractPreview}
          </span>
        ) : null}
      </Link>
      <div className={styles.badges}>
        <AccessBadge label={`View: ${visibilityLabel(paper.viewAccess)}`} value={paper.viewAccess} icon={IconEye} />
        <AccessBadge label={`Download: ${downloadLabel(paper.downloadAccess)}`} value={paper.downloadAccess} icon={IconDownload} />
      </div>
      <div className={styles.actions}>
        {blocked ? (
          <span className={styles.blocked}>
            <IconLock size={14} color={colors.text2} aria-hidden />
            <span className="t-caption grow">
              {!signedIn
                ? 'Sign in to download'
                : paper.downloadAccess === 'none'
                  ? 'Downloads are off for this paper'
                  : 'Only connections can download'}
            </span>
          </span>
        ) : (
          <Button
            label={paper.kind === 'link' ? 'Open paper' : 'Download'}
            icon={paper.kind === 'link' ? IconExternalLink : IconDownload}
            size="sm"
            onClick={() => downloadPaper(paper.id, { signedIn, kind: paper.kind })}
          />
        )}
        <Button label="Details" size="sm" variant="ghost" to={`/paper/${paper.id}`} />
      </div>
    </Card>
  );
}
