import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { IconCamera, IconPlus, IconSparkles, IconTrash, IconX } from '@/components/icons';
import { PrivacyPill } from '@/components/privacy/PrivacyControls';
import { Avatar, Button, Card, IconButton, InlineNotice, LoadingRow, PageHeader, TextField, Toggle } from '@/components/ui';
import { useUnsavedChanges } from '@/components/useUnsavedChanges';
import { api, errorMessage, upload } from '@/lib/api';
import { fileUrl, profileLink } from '@/lib/config';
import { feedback } from '@/lib/feedback';
import { usePageTitle } from '@/lib/hooks';
import { CONTACT_METHODS, type ContactMethod } from '@/lib/links';
import { goBack, navigate } from '@/lib/nav';
import { pickMedia } from '@/lib/pickers';
import { keys, useProfile } from '@/lib/queries';
import type { LinkField, Profile, ProfileField, ProfileResponse, Visibility, VisibilityField } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import styles from './EditProfile.module.css';
import page from './Page.module.css';

interface FormState {
  name: string;
  headline: string;
  username: string;
  openToCollaborate: boolean;
  profile: Required<Record<Exclude<ProfileField, 'interests'>, string>> & { interests: string[] };
  links: Record<LinkField, string>;
  visibility: Record<VisibilityField, Visibility>;
}

function fromProfile(user: Profile): FormState {
  return {
    name: user.name,
    headline: user.headline,
    username: user.username,
    openToCollaborate: user.openToCollaborate,
    profile: {
      qualification: user.profile.qualification ?? '',
      institution: user.profile.institution ?? '',
      location: user.profile.location ?? '',
      bio: user.profile.bio ?? '',
      interests: user.profile.interests ?? [],
    },
    links: Object.fromEntries(CONTACT_METHODS.map((m) => [m.field, user.links[m.field] ?? ''])) as Record<LinkField, string>,
    visibility: user.visibility!,
  };
}

const INPUT_TYPE: Record<NonNullable<ContactMethod['keyboard']>, 'text' | 'email' | 'tel' | 'url'> = {
  default: 'text',
  'email-address': 'email',
  'phone-pad': 'tel',
  url: 'url',
};

export default function EditProfilePage() {
  const [params] = useSearchParams();
  const welcome = params.get('welcome') === '1';
  usePageTitle(welcome ? 'Set up your profile' : 'Edit profile');
  const { user: me, setUser, clearNewUser } = useAuth();
  const queryClient = useQueryClient();
  const profile = useProfile(me?.username);
  const [form, setForm] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<string>('');
  const [interest, setInterest] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (welcome) clearNewUser();
  }, [welcome, clearNewUser]);

  useEffect(() => {
    if (profile.data?.user.visibility && !form) {
      const state = fromProfile(profile.data.user);
      setForm(state);
      setInitial(JSON.stringify(state));
    }
  }, [profile.data, form]);

  const dirty = useMemo(() => !!form && JSON.stringify(form) !== initial, [form, initial]);
  const { allowLeave } = useUnsavedChanges(dirty, 'Your profile changes have not been saved.');
  const user = profile.data?.user;

  if (!form || !user) {
    return (
      <>
        <PageHeader title={welcome ? 'Set up your profile' : 'Edit profile'} back={!welcome} backFallback="/profile" width="form" />
        <LoadingRow label="Loading your profile" style={{ marginTop: 40 }} />
      </>
    );
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const setDetail = (key: keyof FormState['profile'], value: string | string[]) =>
    setForm((f) => (f ? { ...f, profile: { ...f.profile, [key]: value } } : f));
  const setLink = (key: LinkField, value: string) => setForm((f) => (f ? { ...f, links: { ...f.links, [key]: value } } : f));
  const setVis = (key: VisibilityField, value: Visibility) => setForm((f) => (f ? { ...f, visibility: { ...f.visibility, [key]: value } } : f));

  const addInterest = () => {
    const value = interest.trim();
    if (!value) return;
    if (form.profile.interests.some((i) => i.toLowerCase() === value.toLowerCase())) {
      setInterest('');
      return;
    }
    if (form.profile.interests.length >= 15) {
      toast.info('You can list up to 15 interests');
      return;
    }
    feedback.select();
    setDetail('interests', [...form.profile.interests, value.slice(0, 50)]);
    setInterest('');
  };

  const changeImage = async (kind: 'avatar' | 'cover', remove = false) => {
    let result: { user: Profile };
    try {
      if (remove) {
        setUploading(kind);
        result = await api(`/api/users/me/${kind}`, { method: 'DELETE' });
      } else {
        const [file] = await pickMedia();
        if (!file) return;
        setUploading(kind);
        result = await upload(`/api/users/me/${kind}`, { files: [{ field: 'file', file }] });
      }
      queryClient.setQueryData<ProfileResponse>(keys.profile(me!.username), (d) =>
        d ? { ...d, user: { ...d.user, avatarUrl: result.user.avatarUrl, coverUrl: result.user.coverUrl } } : d,
      );
      if (me) setUser({ ...me, avatarUrl: result.user.avatarUrl, coverUrl: result.user.coverUrl });
      feedback.success();
    } catch (error) {
      feedback.error();
      toast.error('Upload failed', errorMessage(error));
    } finally {
      setUploading(null);
    }
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (saving) return;
    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) nextErrors.name = 'Enter your full name.';
    if (!/^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/.test(form.username)) {
      nextErrors.username = 'Use 3–30 lowercase letters, numbers, dots, dashes or underscores.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      feedback.error();
      document.getElementById(nextErrors.name ? 'field-name' : 'field-username')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    try {
      const result = await api<{ user: Profile }>('/api/users/me', {
        method: 'PATCH',
        body: {
          name: form.name,
          headline: form.headline,
          username: form.username,
          openToCollaborate: form.openToCollaborate,
          profile: form.profile,
          links: form.links,
          visibility: form.visibility,
        },
      });
      setUser({ ...me!, ...result.user });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      setInitial(JSON.stringify(form));
      feedback.success();
      toast.success('Profile saved');
      allowLeave();
      if (welcome) navigate('/profile', { replace: true });
      else goBack('/profile');
    } catch (error) {
      feedback.error();
      const message = errorMessage(error);
      if (/username/i.test(message)) setErrors({ username: message });
      toast.error('Profile not saved', message);
    } finally {
      setSaving(false);
    }
  };

  const avatarUri = fileUrl(user.avatarUrl);
  const coverUri = fileUrl(user.coverUrl);

  return (
    <>
      <PageHeader
        title={welcome ? 'Set up your profile' : 'Edit profile'}
        back={welcome ? undefined : true}
        backFallback="/profile"
        width="form"
        right={
          welcome ? (
            <Button
              label="Skip"
              variant="ghost"
              size="sm"
              onClick={() => {
                allowLeave();
                navigate('/', { replace: true });
              }}
            />
          ) : undefined
        }
      />
      <form className={`container w-form ${page.body}`} onSubmit={save} noValidate>
        {welcome ? (
          <InlineNotice tone="success" icon={IconSparkles} title="Welcome to LetResearch">
            Add your academic details so researchers can find you. Every detail has its own privacy setting.
          </InlineNotice>
        ) : null}

        <Card padded={false} className={`${styles.imagesCard} enter`}>
          <div className={styles.cover} style={coverUri ? undefined : { background: 'var(--metal-cover)' }}>
            {coverUri ? <img src={coverUri} alt="" className={styles.coverImage} /> : null}
            <div className={styles.coverButtons}>
              {coverUri ? (
                <IconButton
                  icon={IconTrash}
                  label="Remove cover"
                  background="rgba(255,255,255,0.85)"
                  size={34}
                  onClick={() => changeImage('cover', true)}
                />
              ) : null}
              <Button
                label="Change cover"
                icon={IconCamera}
                size="sm"
                variant="secondary"
                loading={uploading === 'cover'}
                onClick={() => changeImage('cover')}
              />
            </div>
          </div>
          <div className={styles.avatarRow}>
            <button type="button" className={`${styles.avatarButton} press`} aria-label="Change profile photo" onClick={() => changeImage('avatar')}>
              <Avatar name={form.name} url={avatarUri} size={84} ring={colors.surface} />
              <span className={styles.camera} aria-hidden>
                <IconCamera size={14} color={colors.white} />
              </span>
            </button>
            <div className={styles.avatarActions}>
              <Button
                label={uploading === 'avatar' ? 'Uploading…' : 'Change photo'}
                size="sm"
                variant="secondary"
                disabled={uploading === 'avatar'}
                onClick={() => changeImage('avatar')}
              />
              {avatarUri ? <Button label="Remove photo" size="sm" variant="ghost" onClick={() => changeImage('avatar', true)} /> : null}
            </div>
          </div>
        </Card>

        <Card as="section" className={styles.section}>
          <h2 className="t-title">Basics</h2>
          <div id="field-name">
            <TextField
              label="Full name"
              value={form.name}
              onChange={(v) => set('name', v)}
              error={errors.name}
              maxLength={80}
              autoComplete="name"
            />
          </div>
          <TextField
            label="Headline"
            value={form.headline}
            onChange={(v) => set('headline', v)}
            placeholder="e.g. PhD Candidate in Computational Biology"
            maxLength={140}
          />
          <div id="field-username">
            <TextField
              label="Username"
              value={form.username}
              onChange={(v) => set('username', v.toLowerCase().replace(/\s+/g, '-'))}
              autoCapitalize="none"
              autoComplete="username"
              error={errors.username}
              hint={`Your profile link: ${profileLink(form.username || 'username')}`}
              maxLength={30}
            />
          </div>
          <Toggle
            value={form.openToCollaborate}
            onChange={(v) => set('openToCollaborate', v)}
            label="Open to collaboration"
            description="Shows a badge on your profile and helps others find you."
          />
        </Card>

        <Card as="section" className={styles.section}>
          <h2 className="t-title">Academic details</h2>
          <p className="t-meta">Choose who can see each detail with the pill beside it.</p>
          <TextField
            label="Qualification"
            value={form.profile.qualification}
            onChange={(v) => setDetail('qualification', v)}
            placeholder="e.g. MSc in Computer Science"
            labelAccessory={<PrivacyPill field="qualification" value={form.visibility.qualification} onChange={(v) => setVis('qualification', v)} />}
          />
          <TextField
            label="Institution"
            value={form.profile.institution}
            onChange={(v) => setDetail('institution', v)}
            placeholder="University, lab or company"
            autoComplete="organization"
            labelAccessory={<PrivacyPill field="institution" value={form.visibility.institution} onChange={(v) => setVis('institution', v)} />}
          />
          <TextField
            label="Location"
            value={form.profile.location}
            onChange={(v) => setDetail('location', v)}
            placeholder="City, Country"
            labelAccessory={<PrivacyPill field="location" value={form.visibility.location} onChange={(v) => setVis('location', v)} />}
          />
          <TextField
            label="About"
            value={form.profile.bio}
            onChange={(v) => setDetail('bio', v)}
            placeholder="Your research focus, methods and current projects"
            multiline
            maxLength={1200}
            counter={1200}
            autoCapitalize="sentences"
            labelAccessory={<PrivacyPill field="bio" value={form.visibility.bio} onChange={(v) => setVis('bio', v)} />}
          />
          <div className="col gap-8">
            <div className="row gap-8">
              <p className="t-label grow">Research interests</p>
              <PrivacyPill field="interests" value={form.visibility.interests} onChange={(v) => setVis('interests', v)} />
            </div>
            {form.profile.interests.length ? (
              <ul className={styles.interests}>
                <AnimatePresence initial={false}>
                  {form.profile.interests.map((item) => (
                    <motion.li
                      key={item}
                      layout
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 420, damping: 20 } }}
                      exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.14 } }}
                    >
                      <button
                        type="button"
                        className={`${styles.interestChip} press`}
                        aria-label={`Remove ${item}`}
                        onClick={() => {
                          feedback.tap();
                          setDetail(
                            'interests',
                            form.profile.interests.filter((i) => i !== item),
                          );
                        }}
                      >
                        <span>{item}</span>
                        <IconX size={13} aria-hidden />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            ) : null}
            <TextField
              value={interest}
              onChange={setInterest}
              placeholder="Add an interest, e.g. Machine Learning"
              ariaLabel="Add a research interest"
              enterKeyHint="done"
              onSubmit={addInterest}
              right={<IconButton icon={IconPlus} label="Add interest" onClick={addInterest} size={34} color={colors.accent} />}
            />
          </div>
        </Card>

        <Card as="section" className={styles.section}>
          <h2 className="t-title">Contact and links</h2>
          <p className="t-meta">Messaging links such as WhatsApp, LinkedIn and Telegram appear beside the Message button on your profile.</p>
          {CONTACT_METHODS.map((method) => (
            <TextField
              key={method.field}
              label={method.label}
              value={form.links[method.field]}
              onChange={(v) => setLink(method.field, v)}
              placeholder={method.placeholder}
              hint={method.hint}
              type={INPUT_TYPE[method.keyboard ?? 'default']}
              autoCapitalize="none"
              labelAccessory={
                <PrivacyPill field={method.field} value={form.visibility[method.field]} onChange={(v) => setVis(method.field, v)} />
              }
            />
          ))}
          <div className="row gap-8" style={{ marginTop: 4 }}>
            <p className="t-label grow">Who can see your connections list</p>
            <PrivacyPill field="connectionsList" value={form.visibility.connectionsList} onChange={(v) => setVis('connectionsList', v)} />
          </div>
        </Card>

        <AnimatePresence>
          {dirty || welcome ? (
            <motion.div
              key="save"
              className={styles.saveBar}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 360, damping: 26 } }}
              exit={{ opacity: 0, y: 24, transition: { duration: 0.16 } }}
            >
              <p className="t-strong grow">{dirty ? 'Unsaved changes' : 'Looks good?'}</p>
              {dirty ? (
                <Button
                  label="Discard"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setForm(JSON.parse(initial) as FormState);
                    setErrors({});
                  }}
                />
              ) : null}
              <Button label="Save profile" type="submit" size="sm" loading={saving} silent />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </form>
    </>
  );
}
