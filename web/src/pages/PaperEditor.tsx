import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { IconCircleAlert, IconDownload, IconEye, IconFileText, IconLink, IconTrash, IconUpload, IconX } from '@/components/icons';
import { OptionList, VISIBILITY_ICON } from '@/components/privacy/PrivacyControls';
import {
  Button,
  Card,
  confirm,
  ErrorState,
  IconButton,
  InlineNotice,
  LoadingRow,
  PageHeader,
  ProgressBar,
  Segmented,
  TextField,
  Toggle,
} from '@/components/ui';
import { useUnsavedChanges } from '@/components/useUnsavedChanges';
import { api, errorMessage, upload, type UploadFile } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { fileKindLabel, fileSize } from '@/lib/format';
import { usePageTitle, useShake } from '@/lib/hooks';
import { goBack } from '@/lib/nav';
import { PAPER_TYPES, pickDocument, toUpload } from '@/lib/pickers';
import { DOWNLOAD_ACCESS_OPTIONS, VIEW_ACCESS_OPTIONS } from '@/lib/privacy';
import { keys, usePaper } from '@/lib/queries';
import type { PaperDownloadAccess, PaperViewAccess } from '@/lib/types';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import styles from './PaperEditor.module.css';
import page from './Page.module.css';

const MAX_BYTES = 20 * 1024 * 1024;

export default function PaperEditorPage() {
  const [params] = useSearchParams();
  const id = params.get('id') ?? undefined;
  const editing = !!id;
  usePageTitle(editing ? 'Edit paper' : 'Add a paper');
  const queryClient = useQueryClient();
  const existing = usePaper(id);
  const [kind, setKind] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<UploadFile | null>(null);
  const [link, setLink] = useState('');
  const [doi, setDoi] = useState('');
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [venue, setVenue] = useState('');
  const [year, setYear] = useState('');
  const [abstract, setAbstract] = useState('');
  const [keywords, setKeywords] = useState('');
  const [viewAccess, setViewAccess] = useState<PaperViewAccess>('public');
  const [downloadAccess, setDownloadAccess] = useState<PaperDownloadAccess>('everyone');
  const [showOnProfile, setShowOnProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { shakeRef, shake } = useShake<HTMLFormElement>();

  const snapshot = JSON.stringify([kind, file?.uri, link, doi, title, authors, venue, year, abstract, keywords, viewAccess, downloadAccess, showOnProfile]);
  const [initial, setInitial] = useState<string | null>(editing ? null : snapshot);
  const dirty = useMemo(() => initial !== null && snapshot !== initial, [snapshot, initial]);
  const { allowLeave } = useUnsavedChanges(dirty && !saving, 'This paper has not been saved.');

  const paper = existing.data?.paper;
  useEffect(() => {
    if (!paper || prefilled) return;
    setKind(paper.kind);
    setDoi(paper.doi);
    setTitle(paper.title);
    setAuthors(paper.authors.join(', '));
    setVenue(paper.venue);
    setYear(paper.year ? String(paper.year) : '');
    setAbstract(paper.abstract);
    setKeywords(paper.keywords.join(', '));
    setViewAccess(paper.viewAccess);
    setDownloadAccess(paper.downloadAccess);
    setShowOnProfile(paper.showOnProfile);
    setPrefilled(true);
    setInitial(
      JSON.stringify([
        paper.kind,
        undefined,
        '',
        paper.doi,
        paper.title,
        paper.authors.join(', '),
        paper.venue,
        paper.year ? String(paper.year) : '',
        paper.abstract,
        paper.keywords.join(', '),
        paper.viewAccess,
        paper.downloadAccess,
        paper.showOnProfile,
      ]),
    );
  }, [paper, prefilled]);

  const useFile = (picked: UploadFile | null) => {
    if (!picked) return;
    if (!/\.(pdf|docx?)$/i.test(picked.name) && !PAPER_TYPES.includes(picked.type)) {
      feedback.error();
      toast.error('Unsupported file', 'Choose a PDF or Word (DOC/DOCX) file.');
      return;
    }
    if (picked.size && picked.size > MAX_BYTES) {
      feedback.error();
      toast.error('File is too large', 'Papers can be up to 20 MB.');
      return;
    }
    feedback.success();
    setFile(picked);
    setError(null);
    if (!title) setTitle(picked.name.replace(/\.(pdf|docx?)$/i, '').replace(/[_-]+/g, ' '));
  };

  const chooseFile = async () => useFile(await pickDocument(PAPER_TYPES));

  // Computers can drop a file straight onto the upload area.
  const onDrop = async (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) useFile(await toUpload(dropped));
  };

  const fail = (message: string) => {
    setError(message);
    shake();
    feedback.error();
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (saving) return;
    if (title.trim().length < 3) return fail('Enter the paper title.');
    if (!editing && kind === 'file' && !file) return fail('Attach the paper as a PDF or Word file.');
    if (kind === 'link' && !link.trim() && !doi.trim() && !editing) return fail('Add a DOI, arXiv or journal link.');
    if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900)) return fail('Enter a four-digit year.');
    setError(null);
    setSaving(true);
    setProgress(0);
    const fields: Record<string, unknown> = {
      title: title.trim(),
      authors,
      venue: venue.trim(),
      year: year.trim(),
      abstract: abstract.trim(),
      keywords,
      doi: doi.trim(),
      viewAccess,
      downloadAccess,
      showOnProfile: String(showOnProfile),
    };
    if (kind === 'link' && link.trim()) fields.link = link.trim();
    try {
      if (editing) {
        if (file) await upload(`/api/papers/${id}`, { method: 'PATCH', fields, files: [{ field: 'file', file }], onProgress: setProgress });
        else await api(`/api/papers/${id}`, { method: 'PATCH', body: fields });
      } else if (kind === 'file') {
        await upload('/api/papers', { fields: { ...fields, kind }, files: [{ field: 'file', file: file! }], onProgress: setProgress });
      } else {
        await api('/api/papers', { method: 'POST', body: { ...fields, kind } });
      }
      feedback.success();
      toast.success(
        editing ? 'Paper updated' : 'Paper added',
        showOnProfile ? 'It appears in your profile paper index.' : 'It is hidden from your profile index.',
      );
      void queryClient.invalidateQueries({ queryKey: keys.myPapers });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      if (id) void queryClient.invalidateQueries({ queryKey: keys.paper(id) });
      allowLeave();
      goBack('/papers');
    } catch (e) {
      fail(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this paper?',
      message: 'The file, its download history and its place in your index will be removed. Posts that shared it will show it as removed.',
      confirmLabel: 'Delete paper',
      destructive: true,
    });
    if (!ok || !id) return;
    try {
      await api(`/api/papers/${id}`, { method: 'DELETE' });
      feedback.success();
      toast.success('Paper deleted');
      void queryClient.invalidateQueries({ queryKey: keys.myPapers });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      allowLeave();
      goBack('/papers');
    } catch (e) {
      toast.error('Delete failed', errorMessage(e));
    }
  };

  const header = <PageHeader title={editing ? 'Edit paper' : 'Add a paper'} back backIcon={IconX} backLabel="Close" backFallback="/papers" width="form" />;

  if (editing && existing.isLoading) {
    return (
      <>
        {header}
        <LoadingRow label="Loading paper" style={{ marginTop: 40 }} />
      </>
    );
  }
  if (editing && (existing.error || !paper)) {
    return (
      <>
        {header}
        <ErrorState message={errorMessage(existing.error, 'This paper could not be loaded.')} onRetry={() => existing.refetch()} />
      </>
    );
  }

  return (
    <>
      {header}
      <form ref={shakeRef} className={`container w-form ${page.body} enter`} style={{ gap: 18, paddingBottom: 64 }} onSubmit={save} noValidate>
        {!editing ? (
          <Segmented
            label="Paper source"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'file', label: 'Upload a file' },
              { value: 'link', label: 'Add a link' },
            ]}
          />
        ) : null}

        {kind === 'file' ? (
          <Card as="section" className="col gap-12">
            <h2 className="t-title">Paper file</h2>
            {file ? (
              <div className={`${styles.fileRow} enter-zoom`}>
                <span className={styles.fileIcon}>
                  <IconFileText size={22} color={colors.white} aria-hidden />
                </span>
                <span className="col grow">
                  <span className="t-strong nowrap">{file.name}</span>
                  <span className="t-caption">
                    {fileKindLabel(file.type)} {fileSize(file.size)}
                  </span>
                </span>
                <IconButton icon={IconX} label="Remove file" onClick={() => setFile(null)} color={colors.text2} />
              </div>
            ) : editing && paper?.file ? (
              <div className={styles.fileRow}>
                <span className={styles.fileIcon}>
                  <IconFileText size={22} color={colors.white} aria-hidden />
                </span>
                <span className="col grow">
                  <span className="t-strong nowrap">{paper.file.name}</span>
                  <span className="t-caption">Current file, {fileSize(paper.file.size)}</span>
                </span>
              </div>
            ) : null}
            <button
              type="button"
              className={`${styles.drop} ${dragging ? styles.dropActive : ''} press`}
              onClick={chooseFile}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <IconUpload size={22} color={colors.accent} aria-hidden />
              <span className="t-strong" style={{ color: colors.accent }}>
                {file || (editing && paper?.file) ? 'Replace file' : 'Choose a PDF or Word file'}
              </span>
              <span className="t-caption">{dragging ? 'Drop the file here' : 'Up to 20 MB'}</span>
            </button>
          </Card>
        ) : (
          <Card as="section" className="col gap-12">
            <h2 className="t-title">Where the paper lives</h2>
            <TextField
              label="Link"
              type="url"
              value={link}
              onChange={setLink}
              placeholder={editing ? 'Leave empty to keep the current link' : 'https://arxiv.org/abs/… or a journal page'}
              autoCapitalize="none"
            />
            <TextField
              label="DOI"
              value={doi}
              onChange={setDoi}
              placeholder="10.1234/abcd.5678"
              autoCapitalize="none"
              hint="With only a DOI, the link opens doi.org."
            />
          </Card>
        )}

        <Card as="section" className="col gap-14">
          <h2 className="t-title">Details</h2>
          <TextField label="Title" value={title} onChange={setTitle} placeholder="Full paper title" maxLength={300} />
          <TextField label="Authors" value={authors} onChange={setAuthors} placeholder="Separate names with commas" />
          <div className={styles.pair}>
            <TextField
              label="Journal or conference"
              value={venue}
              onChange={setVenue}
              placeholder="e.g. Nature Communications"
              className={styles.venue}
            />
            <TextField
              label="Year"
              value={year}
              onChange={(v) => setYear(v.replace(/[^\d]/g, ''))}
              placeholder="2025"
              inputMode="numeric"
              maxLength={4}
              className={styles.year}
            />
          </div>
          {kind === 'file' ? (
            <TextField label="DOI (optional)" value={doi} onChange={setDoi} placeholder="10.1234/abcd.5678" autoCapitalize="none" />
          ) : null}
          <TextField
            label="Abstract"
            value={abstract}
            onChange={setAbstract}
            placeholder="A short summary of the paper"
            multiline
            maxLength={6000}
            autoCapitalize="sentences"
          />
          <TextField label="Keywords" value={keywords} onChange={setKeywords} placeholder="Separate keywords with commas" />
        </Card>

        <Card as="section" className="col gap-12">
          <h2 className="row gap-8 t-title">
            <IconEye size={18} color={colors.inkSoft} aria-hidden />
            Who can view it
          </h2>
          <OptionList
            label="Who can view it"
            options={VIEW_ACCESS_OPTIONS}
            value={viewAccess}
            icons={VISIBILITY_ICON}
            onSelect={(v) => {
              feedback.toggle();
              setViewAccess(v);
            }}
          />
        </Card>

        <Card as="section" className="col gap-12">
          <h2 className="row gap-8 t-title">
            <IconDownload size={18} color={colors.inkSoft} aria-hidden />
            Who can {kind === 'link' ? 'open the link' : 'download it'}
          </h2>
          <OptionList
            label={`Who can ${kind === 'link' ? 'open the link' : 'download it'}`}
            options={DOWNLOAD_ACCESS_OPTIONS}
            value={downloadAccess}
            onSelect={(v) => {
              feedback.toggle();
              setDownloadAccess(v);
            }}
          />
          <p className="t-caption">You get a notification every time someone downloads your paper.</p>
        </Card>

        <Card>
          <Toggle
            value={showOnProfile}
            onChange={setShowOnProfile}
            label="Show in my profile paper index"
            description="Visitors see indexed papers in the order you arrange them."
          />
        </Card>

        {error ? (
          <InlineNotice tone="danger" icon={IconCircleAlert} className="enter-fade">
            {error}
          </InlineNotice>
        ) : null}
        {saving && file ? (
          <div className="col gap-6">
            <ProgressBar value={progress} />
            <p className="t-caption">Uploading {Math.round(progress * 100)}%</p>
          </div>
        ) : null}
        <Button
          label={editing ? 'Save changes' : 'Add paper'}
          type="submit"
          icon={kind === 'link' ? IconLink : IconUpload}
          size="lg"
          fullWidth
          loading={saving}
          silent
        />
        {editing ? <Button label="Delete paper" icon={IconTrash} variant="danger" fullWidth onClick={remove} /> : null}
      </form>
    </>
  );
}
