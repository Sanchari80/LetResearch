import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { IconArrowDown, IconArrowUp, IconEye, IconEyeOff, IconFileText, IconGrip, IconPencil, IconPlus } from '@/components/icons';
import { VisibilityGlyph } from '@/components/privacy/PrivacyControls';
import { Button, Card, EmptyState, ErrorState, IconButton, InlineNotice, PageHeader, PullToRefresh, RowSkeleton } from '@/components/ui';
import { useUnsavedChanges } from '@/components/useUnsavedChanges';
import { api, errorMessage } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { citation, plural } from '@/lib/format';
import { usePageTitle } from '@/lib/hooks';
import { downloadLabel, visibilityLabel } from '@/lib/privacy';
import { keys, useMyPapers } from '@/lib/queries';
import type { PaperSummary } from '@/lib/types';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import styles from './Papers.module.css';
import page from './Page.module.css';

interface RowProps {
  paper: PaperSummary;
  number: number | null;
  first: boolean;
  last: boolean;
  onMove: (delta: number) => void;
  onToggle: () => void;
}

/** One paper in the index. Drag the grip to reorder, or use the arrow buttons. */
function PaperRow({ paper, number, first, last, onMove, onToggle }: RowProps) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={paper}
      dragListener={false}
      dragControls={controls}
      className={styles.item}
      whileDrag={{ scale: 1.02, boxShadow: 'var(--shadow-float)', zIndex: 5 }}
      onDragEnd={() => feedback.select()}
    >
      <Card className={`${styles.row} ${paper.showOnProfile ? '' : styles.rowHidden}`}>
        <button
          type="button"
          className={styles.grip}
          aria-label={`Drag to reorder ${paper.title}`}
          onPointerDown={(event) => {
            event.preventDefault();
            controls.start(event);
          }}
        >
          <IconGrip size={18} aria-hidden />
        </button>
        <span className={styles.index} style={number ? undefined : { color: colors.text3 }}>
          {number ? `[${number}]` : '—'}
        </span>
        <Link to={`/paper/${paper.id}`} className={styles.main}>
          <span className={`${styles.title} clamp-2`}>{paper.title}</span>
          <span className={`${styles.venue} nowrap`}>
            {citation(paper.venue, paper.year) || (paper.kind === 'link' ? paper.linkHost : 'Uploaded file')}
          </span>
          <span className="row gap-6">
            <VisibilityGlyph value={paper.viewAccess} size={13} />
            <span className="t-caption">
              View: {visibilityLabel(paper.viewAccess)}. Download: {downloadLabel(paper.downloadAccess)}.
            </span>
          </span>
          {paper.stats ? (
            <span className="t-caption">
              {plural(paper.stats.views, 'view')}, {plural(paper.stats.downloads, paper.kind === 'link' ? 'open' : 'download')}
            </span>
          ) : null}
        </Link>
        <div className={styles.controls}>
          <IconButton
            icon={paper.showOnProfile ? IconEye : IconEyeOff}
            label={paper.showOnProfile ? 'Hide from profile index' : 'Show on profile index'}
            onClick={onToggle}
            color={paper.showOnProfile ? colors.accent : colors.text3}
            size={36}
            silent
          />
          <div className="row">
            <IconButton icon={IconArrowUp} label="Move up" onClick={() => onMove(-1)} disabled={first} size={34} silent />
            <IconButton icon={IconArrowDown} label="Move down" onClick={() => onMove(1)} disabled={last} size={34} silent />
          </div>
          <IconButton icon={IconPencil} label="Edit paper" to={`/paper-editor?id=${paper.id}`} size={34} color={colors.text2} />
        </div>
      </Card>
    </Reorder.Item>
  );
}

export default function PapersPage() {
  usePageTitle('Your papers');
  const queryClient = useQueryClient();
  const query = useMyPapers();
  const [items, setItems] = useState<PaperSummary[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (query.data) setItems(query.data);
  }, [query.data]);

  const dirty = useMemo(() => {
    const original = query.data ?? [];
    if (original.length !== items.length) return false;
    return items.some((p, i) => p.id !== original[i].id || p.showOnProfile !== original[i].showOnProfile);
  }, [items, query.data]);
  useUnsavedChanges(dirty, 'Your paper order has not been saved.');

  const shownCount = items.filter((p) => p.showOnProfile).length;

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    feedback.select();
    setItems((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const toggleShown = (id: string) => {
    feedback.toggle();
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, showOnProfile: !p.showOnProfile } : p)));
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await api<{ papers: PaperSummary[] }>('/api/papers/order', {
        method: 'PUT',
        body: { ids: items.map((p) => p.id), visibleIds: items.filter((p) => p.showOnProfile).map((p) => p.id) },
      });
      queryClient.setQueryData(keys.myPapers, result.papers);
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      feedback.success();
      toast.success('Paper index saved', 'Visitors now see your papers in this order.');
    } catch (error) {
      feedback.error();
      toast.error('Could not save', errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  let indexCounter = 0;

  return (
    <>
      <PullToRefresh onRefresh={() => query.refetch()} />
      <PageHeader
        title="Your papers"
        subtitle="Arrange your profile paper index"
        back
        backFallback="/profile"
        width="form"
        right={<Button label="Add" icon={IconPlus} size="sm" to="/paper-editor" />}
      />
      <main className={`container w-form ${page.body}`} style={{ gap: 14 }}>
        {query.isLoading ? (
          <RowSkeleton count={4} />
        ) : query.error ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={IconFileText}
            title="Build your paper index"
            message="Upload PDFs or Word files, or add DOI and arXiv links. Then choose which papers appear on your profile and in what order."
            action={<Button label="Add your first paper" icon={IconPlus} to="/paper-editor" />}
          />
        ) : (
          <>
            <InlineNotice tone="info" title={`${shownCount} of ${items.length} papers shown on your profile`}>
              Visitors see the paper count on your profile and open the index in this order. Drag the grip or use the arrows to reorder,
              and the eye to show or hide a paper.
            </InlineNotice>
            <Reorder.Group axis="y" values={items} onReorder={setItems} className={styles.list}>
              {items.map((paper, i) => {
                const number = paper.showOnProfile ? ++indexCounter : null;
                return (
                  <PaperRow
                    key={paper.id}
                    paper={paper}
                    number={number}
                    first={i === 0}
                    last={i === items.length - 1}
                    onMove={(delta) => move(i, delta)}
                    onToggle={() => toggleShown(paper.id)}
                  />
                );
              })}
            </Reorder.Group>
          </>
        )}
        <AnimatePresence>
          {dirty ? (
            <motion.div
              key="save"
              className={styles.saveBar}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 360, damping: 26 } }}
              exit={{ opacity: 0, y: 24, transition: { duration: 0.18 } }}
            >
              <p className="t-strong grow">Unsaved changes</p>
              <Button label="Discard" variant="ghost" size="sm" onClick={() => setItems(query.data ?? [])} />
              <Button label="Save order" size="sm" loading={saving} onClick={save} silent />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    </>
  );
}
