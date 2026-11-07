import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useSearchParams } from 'react-router';
import {
  IconCircleAlert,
  IconFileText,
  IconGlobe,
  IconImage,
  IconImagePlus,
  IconLink,
  IconLock,
  IconPencil,
  IconPlay,
  IconPlus,
  IconShieldCheck,
  IconUsers,
  IconVideo,
  IconX,
  type IconProps,
} from '@/components/icons';
import { OptionList } from '@/components/privacy/PrivacyControls';
import { Button, Card, Chip, confirm, IconButton, InlineNotice, LoadingRow, PageHeader, ProgressBar, TextField } from '@/components/ui';
import { api, ApiError, errorMessage, upload, type UploadFile } from '@/lib/api';
import { MAX_VIDEO_SECONDS, NOT_ALLOWED, POST_CATEGORIES } from '@/lib/constants';
import { feedback } from '@/lib/feedback';
import { citation, hostOf, isLikelyUrl, normalizeUrlInput } from '@/lib/format';
import { usePageTitle, useShake } from '@/lib/hooks';
import { go, historyIndex, navigate } from '@/lib/nav';
import { pickMedia } from '@/lib/pickers';
import { keys, useMyPapers } from '@/lib/queries';
import { stagger } from '@/lib/style';
import type { PostKind } from '@/lib/types';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import styles from './Compose.module.css';
import page from './Page.module.css';

const KINDS: { kind: PostKind; title: string; description: string; icon: ComponentType<IconProps> }[] = [
  { kind: 'update', title: 'Research update', description: 'Progress, findings, a question or an announcement.', icon: IconPencil },
  { kind: 'link', title: 'Research link', description: 'A DOI, arXiv preprint, journal article, dataset or code.', icon: IconLink },
  { kind: 'paper', title: 'Paper from your portfolio', description: 'Share one of your papers with its download settings.', icon: IconFileText },
  {
    kind: 'media',
    title: 'Photo or short video',
    description: 'Figures, lab or field work, posters and talks (video up to 90s).',
    icon: IconImage,
  },
];

const STEPS = ['Type', 'Content', 'Details'];

type Audience = 'public' | 'connections';
interface Draft {
  kind: PostKind;
  text: string;
  link: string;
  paperId: string | null;
  media: UploadFile[];
  category: string | null;
  audience: Audience;
}

// The post being written survives leaving the page (e.g. to upload a paper) until it is
// published or discarded.
let draft: Draft | null = null;

function StepBar({ step }: { step: number }) {
  return (
    <div className={styles.stepBar} aria-hidden>
      {STEPS.map((label, i) => (
        <span key={label} className={styles.segment}>
          <span className={styles.segmentFill} style={{ transform: `scaleX(${i <= step ? 1 : 0})` }} />
        </span>
      ))}
    </div>
  );
}

export default function ComposePage() {
  usePageTitle('New post');
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const urlKind = KINDS.find((k) => k.kind === params.get('kind'))?.kind;
  const urlPaperId = params.get('paperId');
  const entryIndex = useRef(historyIndex());

  const [kind, setKind] = useState<PostKind>(urlPaperId ? 'paper' : (urlKind ?? draft?.kind ?? 'update'));
  const [text, setText] = useState(draft?.text ?? '');
  const [link, setLink] = useState(draft?.link ?? '');
  const [paperId, setPaperId] = useState<string | null>(urlPaperId ?? draft?.paperId ?? null);
  const [media, setMedia] = useState<UploadFile[]>(draft?.media ?? []);
  const [category, setCategory] = useState<string | null>(draft?.category ?? (urlPaperId ? 'Publication' : null));
  const [audience, setAudience] = useState<Audience>(draft?.audience ?? 'public');
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const { shakeRef, shake } = useShake();
  const papers = useMyPapers(kind === 'paper');

  useEffect(() => {
    draft = { kind, text, link, paperId, media, category, audience };
  }, [kind, text, link, paperId, media, category, audience]);

  // Refresh the paper list when coming back from "Upload a new paper".
  useEffect(() => {
    if (kind === 'paper') void queryClient.invalidateQueries({ queryKey: keys.myPapers });
  }, [kind, queryClient]);

  useEffect(() => setReasons([]), [text, link, paperId, media.length, kind]);

  const minText = kind === 'media' ? 20 : 10;
  const linkValid = kind !== 'link' || isLikelyUrl(link);
  const contentReady =
    text.trim().length >= minText && linkValid && (kind !== 'paper' || !!paperId) && (kind !== 'media' || media.length > 0);
  const hasVideo = media.some((m) => m.type.startsWith('video/'));
  const hasContent = !!(text.trim() || link.trim() || media.length);

  // The step lives in the address, so the browser's back button (and the back gesture in the
  // installed app) goes to the previous step.
  const requestedStep = Number(params.get('step')) - 1;
  const defaultStep = urlKind || urlPaperId ? 1 : 0;
  const step = Math.min(Number.isInteger(requestedStep) && requestedStep >= 0 ? requestedStep : defaultStep, contentReady ? 2 : 1);

  const goToStep = (target: number) => {
    if (target === step) return;
    const depth = historyIndex() - entryIndex.current;
    if (target < step && depth >= step - target) {
      go(-(step - target));
      return;
    }
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('step', String(target + 1));
        return next;
      },
      { replace: target < step },
    );
  };

  /** Leaves the page, stepping back over the wizard's own history entries. */
  const leave = () => {
    const depth = Math.max(0, historyIndex() - entryIndex.current);
    if (entryIndex.current > 0) go(-(depth + 1));
    else navigate('/', { replace: true });
  };

  const discard = async () => {
    if (hasContent && !publishing) {
      const ok = await confirm({
        title: 'Discard this post?',
        message: 'What you have written will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep writing',
        destructive: true,
      });
      if (!ok) return;
    }
    draft = null;
    leave();
  };

  const addMedia = async (video: boolean) => {
    const picked = await pickMedia({ allowVideo: video, allowMultiple: !video, limit: video ? 1 : 4 - media.length });
    if (!picked.length) return;
    const chosenVideo = picked.find((f) => f.type.startsWith('video/'));
    if (chosenVideo) {
      if (chosenVideo.duration && chosenVideo.duration > MAX_VIDEO_SECONDS + 1) {
        feedback.error();
        toast.error('Video is too long', `Short videos can be up to ${MAX_VIDEO_SECONDS} seconds.`);
        return;
      }
      setMedia([chosenVideo]);
    } else {
      const gifs = picked.filter((f) => f.type === 'image/gif');
      if (gifs.length) toast.error('GIFs are not allowed', 'Share research figures as JPG or PNG images.');
      setMedia((prev) => [...prev.filter((m) => !m.type.startsWith('video/')), ...picked.filter((f) => f.type !== 'image/gif')].slice(0, 4));
    }
    feedback.tap();
  };

  const publish = async () => {
    if (!category || publishing) return;
    setPublishing(true);
    setProgress(0);
    setReasons([]);
    try {
      const fields = {
        kind,
        text: text.trim(),
        category,
        audience,
        link: kind === 'link' ? normalizeUrlInput(link) : undefined,
        paperId: kind === 'paper' ? paperId : undefined,
      };
      if (kind === 'media') {
        await upload('/api/posts', { fields, files: media.map((file) => ({ field: 'media', file })), onProgress: setProgress });
      } else {
        await api('/api/posts', { method: 'POST', body: fields });
      }
      feedback.success();
      toast.success('Post published', 'It passed the academic content check.');
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      draft = null;
      leave();
    } catch (error) {
      feedback.error();
      shake();
      if (error instanceof ApiError && error.code === 'MODERATION_REJECTED') setReasons(error.reasons);
      else toast.error('Post not published', errorMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  const next = () => {
    if (step === 1 && !contentReady) {
      shake();
      feedback.error();
      return;
    }
    feedback.tap();
    goToStep(Math.min(2, step + 1));
  };

  return (
    <>
      <PageHeader
        title="New post"
        subtitle={`Step ${step + 1} of 3: ${STEPS[step]}`}
        back={() => (step > 0 ? goToStep(step - 1) : discard())}
        backIcon={step > 0 ? undefined : IconX}
        backLabel={step > 0 ? 'Back' : 'Close'}
        width="form"
        below={<StepBar step={step} />}
      />
      <main className={`container w-form ${page.body}`} style={{ paddingBottom: 72 }}>
        <div key={step} ref={shakeRef} className={`col gap-16 ${styles.stepBody}`}>
          {step === 0 ? (
            <>
              <h2 className="t-heading">What are you sharing?</h2>
              <div className="col gap-16" role="group" aria-label="Post type">
                {KINDS.map((option, i) => (
                  <div key={option.kind} className="enter" style={stagger(i)}>
                    <KindTile
                      option={option}
                      selected={kind === option.kind}
                      onClick={() => {
                        setKind(option.kind);
                        feedback.select();
                        setTimeout(() => goToStep(1), 160);
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h2 className="t-heading">{KINDS.find((k) => k.kind === kind)?.title}</h2>
              <TextField
                label={kind === 'media' ? 'Describe the research context' : 'Your post'}
                placeholder={
                  kind === 'media'
                    ? 'What does this figure, photo or video show, and why does it matter?'
                    : kind === 'link'
                      ? 'Why is this worth reading?'
                      : kind === 'paper'
                        ? 'What is the paper about and what did you find?'
                        : 'Share progress, a finding or a question for the community…'
                }
                value={text}
                onChange={setText}
                multiline
                minRows={5}
                maxLength={3000}
                counter={3000}
                autoCapitalize="sentences"
                hint={text.trim().length < minText ? `At least ${minText} characters.` : undefined}
              />
              {kind === 'link' ? (
                <div className="col gap-10">
                  <TextField
                    label="Link"
                    type="url"
                    inputMode="url"
                    placeholder="https://doi.org/10.xxxx/… or arxiv.org/abs/…"
                    value={link}
                    onChange={setLink}
                    autoCapitalize="none"
                    error={link && !isLikelyUrl(link) ? 'Enter a valid link.' : null}
                    onSubmit={next}
                  />
                  {isLikelyUrl(link) ? (
                    <div className={`${styles.linkPreview} enter`}>
                      <IconLink size={16} color={colors.accent} aria-hidden />
                      <span className="t-strong grow nowrap">{hostOf(normalizeUrlInput(link))}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {kind === 'paper' ? <PaperPicker value={paperId} onChange={setPaperId} papers={papers} /> : null}
              {kind === 'media' ? (
                <div className="col gap-12">
                  <div className="row wrap gap-10">
                    <Button
                      label={media.length && !hasVideo ? 'Add more photos' : 'Add photos'}
                      icon={IconImagePlus}
                      variant="secondary"
                      disabled={!hasVideo && media.length >= 4}
                      onClick={() => addMedia(false)}
                    />
                    <Button label="Add a short video" icon={IconVideo} variant="secondary" onClick={() => addMedia(true)} />
                  </div>
                  <p className="t-caption">Up to 4 photos, or one video of up to {MAX_VIDEO_SECONDS} seconds. GIFs are not allowed.</p>
                  {media.length ? (
                    <div className={styles.mediaGrid}>
                      <AnimatePresence initial={false}>
                        {media.map((file, i) => (
                          <motion.div
                            key={file.uri}
                            layout
                            className={styles.mediaTile}
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 380, damping: 18 } }}
                            exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.16 } }}
                          >
                            {file.type.startsWith('video/') ? (
                              <>
                                <video src={file.uri} className={styles.mediaImage} muted playsInline preload="metadata" />
                                <span className={styles.videoBadge}>
                                  <IconPlay size={22} color={colors.white} aria-hidden />
                                  <span>{file.duration ? `${Math.round(file.duration)}s video` : 'Video'}</span>
                                </span>
                              </>
                            ) : (
                              <img src={file.uri} alt={`Photo ${i + 1}`} className={styles.mediaImage} />
                            )}
                            <IconButton
                              icon={IconX}
                              label={file.type.startsWith('video/') ? 'Remove video' : `Remove photo ${i + 1}`}
                              size={28}
                              color={colors.white}
                              background="rgba(20,22,26,0.7)"
                              className={styles.remove}
                              onClick={() => setMedia((prev) => prev.filter((m) => m.uri !== file.uri))}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <Button label="Continue" size="lg" onClick={next} disabled={!contentReady} silent fullWidth />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h2 className="t-heading">Category and audience</h2>
              <div className="col gap-10">
                <p className="t-label">Category</p>
                <div className="row wrap gap-8" role="group" aria-label="Category">
                  {POST_CATEGORIES.map((c) => (
                    <Chip key={c} label={c} selected={category === c} onClick={() => setCategory(c)} />
                  ))}
                </div>
              </div>
              <div className="col gap-10">
                <p className="t-label">Who can see this post</p>
                <OptionList
                  label="Who can see this post"
                  options={[
                    { value: 'public', label: 'Public', description: 'Everyone on LetResearch.' },
                    { value: 'connections', label: 'Connections', description: 'Only researchers you are connected with.' },
                  ]}
                  value={audience}
                  icons={{ public: IconGlobe, connections: IconUsers }}
                  onSelect={(v) => {
                    feedback.toggle();
                    setAudience(v);
                  }}
                />
              </div>
              <Card className="col gap-8">
                <p className="row gap-8 t-strong">
                  <IconShieldCheck size={18} color={colors.success} aria-hidden />
                  Academic content check
                </p>
                <p className="t-meta">Every post is checked before it is published.</p>
                {NOT_ALLOWED.map((rule) => (
                  <p key={rule} className="t-caption">
                    Not allowed: {rule.toLowerCase()}
                  </p>
                ))}
              </Card>
              {reasons.length ? (
                <InlineNotice tone="danger" icon={IconCircleAlert} title="Your post was not published">
                  <span className="col gap-4">
                    {reasons.map((reason) => (
                      <span key={reason} className="t-meta" style={{ color: colors.inkSoft }}>
                        {reason}
                      </span>
                    ))}
                    <button type="button" className={`t-meta text-link ${styles.editLink}`} onClick={() => goToStep(1)}>
                      Edit your post
                    </button>
                  </span>
                </InlineNotice>
              ) : null}
              {publishing && kind === 'media' ? (
                <div className="col gap-6 enter-fade">
                  <ProgressBar value={progress} />
                  <p className="t-caption">{progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : 'Checking your post…'}</p>
                </div>
              ) : null}
              <Button label="Publish" size="lg" fullWidth loading={publishing} disabled={!category} onClick={publish} silent />
              {!category ? (
                <p className="t-caption" style={{ textAlign: 'center' }}>
                  Choose a category to publish.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}

function KindTile({ option, selected, onClick }: { option: (typeof KINDS)[number]; selected: boolean; onClick: () => void }) {
  const Icon = option.icon;
  return (
    <button type="button" aria-pressed={selected} className={`${styles.tile} ${selected ? styles.tileSelected : ''} press`} onClick={onClick}>
      <span className={styles.tileIcon}>
        <Icon size={22} color={colors.accent} aria-hidden />
      </span>
      <span className="col grow gap-4">
        <span className={styles.tileTitle}>{option.title}</span>
        <span className="t-meta">{option.description}</span>
      </span>
    </button>
  );
}

function PaperPicker({
  value,
  onChange,
  papers,
}: {
  value: string | null;
  onChange: (id: string) => void;
  papers: ReturnType<typeof useMyPapers>;
}) {
  if (papers.isLoading) return <LoadingRow label="Loading your papers" />;
  const list = papers.data ?? [];
  return (
    <div className="col gap-10">
      <p className="t-label" id="paper-choice">
        Choose a paper
      </p>
      {list.length === 0 ? (
        <InlineNotice tone="info" title="Your portfolio is empty">
          Upload a paper first, then come back to share it.
        </InlineNotice>
      ) : (
        <div className="col gap-10" role="radiogroup" aria-labelledby="paper-choice">
          {list.map((paper) => {
            const isPrivate = paper.viewAccess === 'private';
            const selected = value === paper.id;
            return (
              <button
                key={paper.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={isPrivate}
                className={`${styles.paperRow} ${selected ? styles.paperSelected : ''} press`}
                onClick={() => {
                  feedback.select();
                  onChange(paper.id);
                }}
              >
                <IconFileText size={20} color={selected ? colors.accent : colors.text2} aria-hidden />
                <span className="col grow">
                  <span className={`${styles.paperTitle} clamp-2`}>{paper.title}</span>
                  <span className="t-caption">
                    {isPrivate ? 'Only you can see this paper – change its visibility to share it' : citation(paper.venue, paper.year) || 'Paper'}
                  </span>
                </span>
                {isPrivate ? <IconLock size={16} color={colors.text3} aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      )}
      <Button label="Upload a new paper" icon={IconPlus} variant="ghost" to="/paper-editor" style={{ alignSelf: 'flex-start' }} />
    </div>
  );
}
