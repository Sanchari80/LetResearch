import { Link } from 'react-router';
import { feedback } from '@/lib/feedback';
import { citation, firstName } from '@/lib/format';
import type { PaperIndexRow, RelationStatus } from '@/lib/types';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import { IconChevronRight, IconListOrdered, IconLock, IconPlus, IconUserPlus } from '../icons';
import { VisibilityGlyph } from '../privacy/PrivacyControls';
import { Button, Collapsible } from '../ui';
import styles from './PaperIndex.module.css';

interface Props {
  id?: string;
  open: boolean;
  rows: PaperIndexRow[];
  ownerName: string;
  relation: RelationStatus;
  onConnect?: () => void;
}

/**
 * The dropdown paper index, styled like a reference list: [1] Title. Venue, Year.
 * Order and selection come from the author; access follows each paper's privacy setting.
 */
export function PaperIndex({ id, open, rows, ownerName, relation, onConnect }: Props) {
  const isOwner = relation === 'self';
  const locked = rows.filter((r) => r.locked).length;

  return (
    <Collapsible open={open} id={id}>
      <div className={styles.wrap}>
        <span className={styles.notch} aria-hidden />
        <section className={styles.panel} aria-label="Paper index">
          <div className={styles.head}>
            <h2 className="t-title grow">Paper index</h2>
            {isOwner ? <Button label="Arrange" icon={IconListOrdered} size="sm" variant="secondary" to="/papers" /> : null}
          </div>
          {rows.length === 0 ? (
            <div className="col gap-10" style={{ padding: '14px 0' }}>
              <p className="t-meta">
                {isOwner
                  ? 'Your index is empty. Add a paper and choose to show it on your profile.'
                  : `${firstName(ownerName)} hasn't listed any papers yet.`}
              </p>
              {isOwner ? (
                <Button label="Add a paper" icon={IconPlus} size="sm" to="/paper-editor" style={{ alignSelf: 'flex-start' }} />
              ) : null}
            </div>
          ) : (
            <ol className={styles.list}>
              {rows.map((row, i) => (
                <li key={`${row.index}-${row.id ?? 'locked'}`} className={styles.item} style={{ animationDelay: `${60 + i * 45}ms` }}>
                  <IndexRow row={row} isOwner={isOwner} ownerName={ownerName} />
                </li>
              ))}
            </ol>
          )}
          {locked > 0 && !isOwner ? (
            <div className={styles.unlock}>
              <IconLock size={16} color={colors.steel} aria-hidden />
              <p className="t-meta grow" style={{ color: colors.inkSoft }}>
                {locked === 1 ? '1 paper is' : `${locked} papers are`} visible to {firstName(ownerName)}'s connections only.
              </p>
              {relation === 'none' && onConnect ? <Button label="Connect" icon={IconUserPlus} size="sm" onClick={onConnect} /> : null}
            </div>
          ) : null}
        </section>
      </div>
    </Collapsible>
  );
}

function IndexRow({ row, isOwner, ownerName }: { row: PaperIndexRow; isOwner: boolean; ownerName: string }) {
  if (row.locked) {
    return (
      <button
        type="button"
        className={styles.row}
        aria-label={`Paper ${row.index}, restricted to connections`}
        onClick={() => {
          feedback.tap();
          toast.info('Restricted paper', `Connect with ${firstName(ownerName)} to view this paper.`);
        }}
      >
        <span className={styles.index}>[{row.index}]</span>
        <span className="col grow gap-4">
          <span className={styles.lockedTitle}>
            <IconLock size={14} color={colors.text3} aria-hidden />
            <span className={`${styles.title} ${styles.titleLocked}`}>Restricted paper</span>
          </span>
          <span className="t-caption">Visible to connections only</span>
        </span>
      </button>
    );
  }
  return (
    <Link to={`/paper/${row.id}`} className={styles.row} aria-label={`Paper ${row.index}: ${row.title}`} onClick={() => feedback.tap()}>
      <span className={styles.index}>[{row.index}]</span>
      <span className="col grow gap-4">
        <span className={`${styles.title} clamp-3`}>{row.title}</span>
        <span className={styles.metaRow}>
          <span className={`${styles.venue} nowrap`}>
            {citation(row.venue, row.year) || (row.kind === 'link' ? row.linkHost : 'Uploaded paper')}
          </span>
          {isOwner ? <VisibilityGlyph value={row.viewAccess} size={13} /> : null}
        </span>
      </span>
      <IconChevronRight size={18} color={colors.silver} aria-hidden />
    </Link>
  );
}
