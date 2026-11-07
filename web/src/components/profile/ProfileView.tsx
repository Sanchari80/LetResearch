import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState, type ComponentType, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { copyToClipboard, openChatWith } from '@/lib/actions';
import { api, errorMessage, upload } from '@/lib/api';
import { fileUrl, profileLink } from '@/lib/config';
import { feedback } from '@/lib/feedback';
import { firstName, plural } from '@/lib/format';
import { useInfiniteScroll, useLayout } from '@/lib/hooks';
import { navigate } from '@/lib/nav';
import { pickMedia } from '@/lib/pickers';
import { audienceSentence } from '@/lib/privacy';
import { stagger } from '@/lib/style';
import { keys, useProfile, useUserPosts } from '@/lib/queries';
import type { PaperSummary, Profile, ProfileResponse, RelationStatus, Visibility, VisibilityField } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import { PostCard } from '../feed/PostCard';
import {
  IconBuilding,
  IconCamera,
  IconClock,
  IconCopy,
  IconFileText,
  IconGraduationCap,
  IconListOrdered,
  IconMapPin,
  IconMessageCircle,
  IconPencil,
  IconPlus,
  IconSparkles,
  IconUserCheck,
  IconUserPlus,
  IconUserX,
  type IconProps,
} from '../icons';
import { PrivacyPill } from '../privacy/PrivacyControls';
import {
  ActionSheet,
  Avatar,
  Button,
  Card,
  Chip,
  confirm,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingRow,
  PostSkeleton,
  Segmented,
  Skeleton,
} from '../ui';
import { ContactChips, ContactList } from './ContactLinks';
import { PaperCard } from './PaperCard';
import { PaperIndex } from './PaperIndex';
import { PaperPlaque } from './PaperPlaque';
import styles from './ProfileView.module.css';

type Tab = 'about' | 'papers' | 'posts';
type ConnectionAction = 'connect' | 'withdraw' | 'accept' | 'decline' | 'remove';

interface Props {
  handle: string;
  /** Extra buttons shown on the cover (e.g. Settings on your own profile on phones). */
  headerRight?: ReactNode;
}

export function ProfileView({ handle, headerRight }: Props) {
  const { user: me, setUser } = useAuth();
  const queryClient = useQueryClient();
  const { isWide } = useLayout();
  const profile = useProfile(handle);
  const indexId = useId();
  const [indexOpen, setIndexOpen] = useState(false);
  // The open section lives in the address, so it is still open after visiting a post and coming back.
  const [params, setParams] = useSearchParams();
  const section = params.get('section');
  const tab: Tab = section === 'papers' || section === 'posts' ? section : 'about';
  const setTab = (next: Tab) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === 'about') updated.delete('section');
        else updated.set('section', next);
        return updated;
      },
      { replace: true },
    );
  const [connectionMenu, setConnectionMenu] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const data = profile.data;
  const user = data?.user;
  const status: RelationStatus = data?.relation.status ?? 'anonymous';
  const isOwner = status === 'self';
  const signedIn = !!me;

  // Keep the signed-in user's cached profile (sidebar avatar etc.) in sync.
  useEffect(() => {
    if (isOwner && user && me && (me.avatarUrl !== user.avatarUrl || me.name !== user.name || me.username !== user.username)) {
      setUser({ ...me, ...user });
    }
  }, [isOwner, user, me, setUser]);

  const patchProfile = (update: (d: ProfileResponse) => ProfileResponse) => {
    queryClient.setQueryData<ProfileResponse>(keys.profile(handle), (d) => (d ? update(d) : d));
  };

  const changeVisibility = async (field: VisibilityField, value: Visibility) => {
    if (!user?.visibility) return;
    const previous = user.visibility[field];
    patchProfile((d) => ({ ...d, user: { ...d.user, visibility: { ...d.user.visibility!, [field]: value } } }));
    try {
      await api('/api/users/me/visibility', { method: 'PATCH', body: { field, visibility: value } });
      toast.success('Privacy updated', audienceSentence(field, value));
    } catch (error) {
      patchProfile((d) => ({ ...d, user: { ...d.user, visibility: { ...d.user.visibility!, [field]: previous } } }));
      feedback.error();
      toast.error('Could not update privacy', errorMessage(error));
    }
  };

  const refreshRelated = () => {
    queryClient.invalidateQueries({ queryKey: keys.profile(handle) });
    queryClient.invalidateQueries({ queryKey: keys.connectionRequests });
    queryClient.invalidateQueries({ queryKey: keys.connections });
    queryClient.invalidateQueries({ queryKey: ['suggestions'] });
  };

  const runConnection = async (kind: ConnectionAction) => {
    if (!data || !user) return;
    if (!signedIn) {
      navigate('/login');
      return;
    }
    if (kind === 'withdraw' || kind === 'remove') {
      const ok = await confirm({
        title: kind === 'withdraw' ? 'Withdraw your request?' : `Remove ${firstName(user.name)} from your connections?`,
        message: kind === 'remove' ? 'Details shared with connections will be hidden again.' : undefined,
        confirmLabel: kind === 'withdraw' ? 'Withdraw' : 'Remove',
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy(kind);
    try {
      const id = data.relation.connectionId;
      if (kind === 'connect') {
        const r = await api<{ status: string; connectionId: string }>('/api/connections/request', {
          method: 'POST',
          body: { userId: user.id },
        });
        const connected = r.status === 'connected';
        patchProfile((d) => ({ ...d, relation: { status: connected ? 'connected' : 'pending_sent', connectionId: r.connectionId } }));
        feedback.success();
        toast.success(connected ? `You and ${firstName(user.name)} are connected` : 'Connection request sent');
      } else if (kind === 'accept') {
        await api(`/api/connections/${id}/accept`, { method: 'POST' });
        feedback.success();
        toast.success(`You and ${firstName(user.name)} are now connected`);
      } else if (kind === 'decline') {
        await api(`/api/connections/${id}/decline`, { method: 'POST' });
        feedback.tap();
      } else {
        await api(`/api/connections/${id}`, { method: 'DELETE' });
        feedback.tap();
        toast.info(kind === 'withdraw' ? 'Request withdrawn' : 'Connection removed');
      }
      refreshRelated();
    } catch (error) {
      feedback.error();
      toast.error('Something went wrong', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const changeImage = async (kind: 'avatar' | 'cover') => {
    const [file] = await pickMedia();
    if (!file) return;
    setBusy(kind);
    try {
      const result = await upload<{ user: Profile }>(`/api/users/me/${kind}`, { files: [{ field: 'file', file }] });
      patchProfile((d) => ({ ...d, user: { ...d.user, avatarUrl: result.user.avatarUrl, coverUrl: result.user.coverUrl } }));
      if (me) setUser({ ...me, avatarUrl: result.user.avatarUrl, coverUrl: result.user.coverUrl });
      feedback.success();
      toast.success(kind === 'avatar' ? 'Profile photo updated' : 'Cover updated');
    } catch (error) {
      feedback.error();
      toast.error('Upload failed', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  if (profile.isLoading) return <ProfileSkeleton />;
  if (profile.error || !data || !user) {
    return <ErrorState message={errorMessage(profile.error, 'This profile could not be loaded.')} onRetry={() => profile.refetch()} />;
  }

  const unlockedPapers = data.paperIndex.filter((r) => !r.locked) as (PaperSummary & { index: number })[];
  const coverUri = fileUrl(user.coverUrl);
  const avatarSize = isWide ? 116 : 92;

  const details: { field: VisibilityField; icon: ComponentType<IconProps>; value?: string; empty: string }[] = [
    { field: 'qualification', icon: IconGraduationCap, value: user.profile.qualification, empty: 'Add your qualification' },
    { field: 'institution', icon: IconBuilding, value: user.profile.institution, empty: 'Add your institution' },
    { field: 'location', icon: IconMapPin, value: user.profile.location, empty: 'Add your location' },
  ];

  const avatar = (
    <>
      <Avatar name={user.name} url={user.avatarUrl} size={avatarSize} ring={colors.bg} online={!isOwner && user.online} />
      {isOwner ? (
        <span className={styles.avatarBadge} aria-hidden>
          <IconCamera size={14} color={colors.white} />
        </span>
      ) : null}
    </>
  );

  return (
    <div className={styles.page}>
      {/* Cover */}
      <div className={styles.cover} style={coverUri ? undefined : { background: 'var(--metal-cover)' }}>
        {coverUri ? <img src={coverUri} alt="" className={styles.coverImage} /> : null}
        <div className={styles.coverActions}>
          {headerRight}
          {isOwner ? (
            <IconButton
              icon={IconCamera}
              label="Change cover"
              background="rgba(255,255,255,0.82)"
              onClick={() => changeImage('cover')}
              disabled={busy === 'cover'}
              size={36}
            />
          ) : null}
        </div>
      </div>

      <div className={styles.inner}>
        {/* Avatar + paper plaque */}
        <div className={styles.heroRow} style={{ marginTop: -avatarSize * 0.42 }}>
          {isOwner ? (
            <button type="button" className={styles.avatarButton} aria-label="Change profile photo" onClick={() => changeImage('avatar')}>
              {avatar}
            </button>
          ) : (
            <span className={styles.avatarStatic}>{avatar}</span>
          )}
          <span className="grow" />
          <div className={styles.plaqueWrap}>
            <PaperPlaque
              count={data.stats.papers}
              open={indexOpen}
              onToggle={() => setIndexOpen((o) => !o)}
              compact={!isWide}
              controls={indexId}
            />
          </div>
        </div>

        <PaperIndex
          id={indexId}
          open={indexOpen}
          rows={data.paperIndex}
          ownerName={user.name}
          relation={status}
          onConnect={() => runConnection('connect')}
        />

        {/* Identity */}
        <div className={styles.identity}>
          <h1 className={styles.name}>{user.name}</h1>
          {user.headline ? (
            <p className="t-lead" style={{ color: colors.inkSoft }}>
              {user.headline}
            </p>
          ) : null}
          {user.openToCollaborate ? (
            <span className={styles.collab}>
              <IconSparkles size={13} aria-hidden />
              Open to collaboration
            </span>
          ) : null}
        </div>

        <ul className={styles.details}>
          {details.map(({ field, icon: Icon, value, empty }) => {
            if (!value && !isOwner) return null;
            return (
              <li key={field} className={styles.detailRow}>
                <Icon size={16} color={colors.text2} aria-hidden />
                {value ? (
                  <span className="t-body grow clamp-2" style={{ color: colors.inkSoft }}>
                    {value}
                  </span>
                ) : (
                  <Link to="/edit-profile" className={`t-meta grow ${styles.emptyDetail}`}>
                    {empty}
                  </Link>
                )}
                {isOwner && user.visibility ? (
                  <PrivacyPill field={field} value={user.visibility[field]} onChange={(v) => changeVisibility(field, v)} />
                ) : null}
              </li>
            );
          })}
        </ul>

        {/* Actions */}
        <div className={styles.actions}>
          {isOwner ? (
            <>
              <Button label="Edit profile" icon={IconPencil} variant="secondary" to="/edit-profile" />
              <Button label="Papers" icon={IconListOrdered} variant="secondary" to="/papers" />
            </>
          ) : (
            <>
              <ConnectButton status={status} busy={busy} onAction={runConnection} onConnectedClick={() => setConnectionMenu(true)} />
              <Button
                label="Message"
                icon={IconMessageCircle}
                variant="secondary"
                onClick={() => {
                  if (!signedIn) return navigate('/login');
                  if (data.conversationId) return navigate(`/chat/${data.conversationId}`);
                  if (!data.canMessage) {
                    toast.info('Messages are limited', data.messageNote);
                    return;
                  }
                  openChatWith(user.id, { signedIn });
                }}
              />
            </>
          )}
          <IconButton
            icon={IconCopy}
            label="Copy profile link"
            bordered
            background={colors.surfaceRaised}
            onClick={() => copyToClipboard(profileLink(user.username), 'Profile link copied')}
            size={44}
          />
        </div>
        {!isOwner && status === 'pending_received' ? (
          <p className="t-meta" style={{ marginTop: 8 }}>
            {firstName(user.name)} wants to connect with you.{' '}
            <button type="button" className={styles.declineLink} onClick={() => runConnection('decline')}>
              Decline
            </button>
          </p>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <ContactChips links={user.links} />
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          {user.canSeeConnections ? (
            <Link to={`/connections/${user.username}`} className={styles.stat}>
              <strong>{data.stats.connections}</strong> {data.stats.connections === 1 ? 'connection' : 'connections'}
            </Link>
          ) : (
            <button type="button" className={styles.stat} onClick={() => toast.info('Connections are private')}>
              <strong>{data.stats.connections}</strong> {data.stats.connections === 1 ? 'connection' : 'connections'}
            </button>
          )}
          <span className={styles.stat}>
            <strong>{data.stats.posts}</strong> {data.stats.posts === 1 ? 'post' : 'posts'}
          </span>
          <span className={styles.stat}>
            <strong>{unlockedPapers.length}</strong> open {unlockedPapers.length === 1 ? 'paper' : 'papers'}
          </span>
        </div>

        <Segmented
          variant="underline"
          value={tab}
          onChange={setTab}
          label="Profile sections"
          options={[
            { value: 'about', label: 'About' },
            { value: 'papers', label: `Papers (${unlockedPapers.length})` },
            { value: 'posts', label: 'Posts' },
          ]}
          style={{ marginTop: 18 }}
        />

        <div key={tab} className={styles.tabBody}>
          {tab === 'about' ? (
            <AboutTab user={user} isOwner={isOwner} onVisibility={changeVisibility} />
          ) : tab === 'papers' ? (
            <PapersTab
              papers={unlockedPapers}
              lockedCount={data.paperIndex.length - unlockedPapers.length}
              isOwner={isOwner}
              signedIn={signedIn}
              name={user.name}
            />
          ) : (
            <PostsTab userId={user.id} signedIn={signedIn} isOwner={isOwner} name={user.name} />
          )}
        </div>
      </div>

      <ActionSheet
        visible={connectionMenu}
        onClose={() => setConnectionMenu(false)}
        title={`Connected with ${firstName(user.name)}`}
        actions={[
          { label: 'Send a message', icon: IconMessageCircle, onClick: () => openChatWith(user.id, { signedIn }) },
          { label: 'Remove connection', icon: IconUserX, destructive: true, onClick: () => runConnection('remove') },
        ]}
      />
    </div>
  );
}

function ConnectButton({
  status,
  busy,
  onAction,
  onConnectedClick,
}: {
  status: RelationStatus;
  busy: string | null;
  onAction: (kind: ConnectionAction) => void;
  onConnectedClick: () => void;
}) {
  if (status === 'anonymous') return <Button label="Sign in to connect" icon={IconUserPlus} to="/login" />;
  if (status === 'connected') return <Button label="Connected" icon={IconUserCheck} variant="soft" onClick={onConnectedClick} />;
  if (status === 'pending_sent')
    return <Button label="Pending" icon={IconClock} variant="secondary" loading={busy === 'withdraw'} onClick={() => onAction('withdraw')} />;
  if (status === 'pending_received')
    return (
      <Button label="Accept" icon={IconUserCheck} variant="accent" loading={busy === 'accept'} onClick={() => onAction('accept')} silent />
    );
  return <Button label="Connect" icon={IconUserPlus} loading={busy === 'connect'} onClick={() => onAction('connect')} silent />;
}

function AboutTab({
  user,
  isOwner,
  onVisibility,
}: {
  user: Profile;
  isOwner: boolean;
  onVisibility: (field: VisibilityField, value: Visibility) => void;
}) {
  const hasLinks = Object.values(user.links).some(Boolean);
  const interests = user.profile.interests ?? [];
  return (
    <>
      <Card className="col gap-10">
        <div className={styles.cardHead}>
          <h2 className="t-title grow">About</h2>
          {isOwner && user.visibility ? (
            <PrivacyPill field="bio" value={user.visibility.bio} onChange={(v) => onVisibility('bio', v)} />
          ) : null}
        </div>
        {user.profile.bio ? (
          <p className="t-body pre-wrap" style={{ color: colors.inkSoft }}>
            {user.profile.bio}
          </p>
        ) : (
          <p className="t-meta" style={{ color: colors.text3 }}>
            {isOwner ? 'Write a short summary of your research focus in Edit profile.' : 'No summary shared.'}
          </p>
        )}
      </Card>

      <Card className="col gap-12">
        <div className={styles.cardHead}>
          <h2 className="t-title grow">Research interests</h2>
          {isOwner && user.visibility ? (
            <PrivacyPill field="interests" value={user.visibility.interests} onChange={(v) => onVisibility('interests', v)} />
          ) : null}
        </div>
        {interests.length ? (
          <div className="row wrap gap-8">
            {interests.map((interest) => (
              <Chip key={interest} label={interest} tone="steel" />
            ))}
          </div>
        ) : (
          <p className="t-meta" style={{ color: colors.text3 }}>
            {isOwner ? 'Add interests so researchers with similar work can find you.' : 'No interests shared.'}
          </p>
        )}
      </Card>

      <Card className="col gap-8">
        <div className={styles.cardHead}>
          <h2 className="t-title grow">Contact and links</h2>
          {isOwner ? <Button label="Manage" size="sm" variant="ghost" to="/edit-profile" /> : null}
        </div>
        {hasLinks ? (
          <ContactList
            links={user.links}
            visibility={isOwner ? user.visibility : undefined}
            onVisibilityChange={isOwner ? onVisibility : undefined}
          />
        ) : (
          <p className="t-meta" style={{ color: colors.text3 }}>
            {isOwner
              ? 'Add WhatsApp, LinkedIn, email and other links – each with its own privacy setting.'
              : 'No contact details shared with you.'}
          </p>
        )}
        {isOwner && user.visibility ? (
          <div className={styles.detailRow} style={{ marginTop: 6 }}>
            <span className="t-meta grow">Who can see your connections list</span>
            <PrivacyPill field="connectionsList" value={user.visibility.connectionsList} onChange={(v) => onVisibility('connectionsList', v)} />
          </div>
        ) : null}
      </Card>
    </>
  );
}

function PapersTab({
  papers,
  lockedCount,
  isOwner,
  signedIn,
  name,
}: {
  papers: (PaperSummary & { index: number })[];
  lockedCount: number;
  isOwner: boolean;
  signedIn: boolean;
  name: string;
}) {
  return (
    <>
      {isOwner ? (
        <div className="row wrap gap-8">
          <Button label="Add paper" icon={IconPlus} to="/paper-editor" />
          <Button label="Arrange and privacy" icon={IconListOrdered} variant="secondary" to="/papers" />
        </div>
      ) : null}
      {papers.length === 0 ? (
        <EmptyState
          compact
          icon={IconFileText}
          title={isOwner ? 'No papers on your profile yet' : 'No open papers'}
          message={
            isOwner
              ? 'Upload a PDF or Word file, or add a DOI or arXiv link. You choose who can view and download each one.'
              : lockedCount
                ? `${plural(lockedCount, 'paper')} visible to ${firstName(name)}'s connections only.`
                : `${firstName(name)} hasn't shared papers yet.`
          }
        />
      ) : (
        <div className={styles.paperGrid}>
          {papers.map((paper, i) => (
            <div key={paper.id} className="enter" style={stagger(i)}>
              <PaperCard paper={paper} index={paper.index} signedIn={signedIn} />
            </div>
          ))}
        </div>
      )}
      {lockedCount > 0 && papers.length > 0 ? (
        <p className="t-meta" style={{ textAlign: 'center' }}>
          {plural(lockedCount, 'more paper')} visible to {firstName(name)}'s connections only.
        </p>
      ) : null}
    </>
  );
}

function PostsTab({ userId, signedIn, isOwner, name }: { userId: string; signedIn: boolean; isOwner: boolean; name: string }) {
  const posts = useUserPosts(userId);
  const items = posts.data?.pages.flatMap((p) => p.results) ?? [];
  const sentinel = useInfiniteScroll(() => {
    if (posts.hasNextPage && !posts.isFetchingNextPage) posts.fetchNextPage();
  }, !!posts.hasNextPage);
  if (posts.isLoading) return <PostSkeleton />;
  if (!items.length) {
    return (
      <EmptyState
        compact
        icon={IconMessageCircle}
        title={isOwner ? 'Share your first update' : 'No posts yet'}
        message={isOwner ? 'Post a research update, a paper, a link or a figure.' : `${firstName(name)} hasn't posted anything you can see.`}
        action={isOwner ? <Button label="Create post" icon={IconPlus} to="/compose" /> : undefined}
      />
    );
  }
  return (
    <>
      {items.map((post, i) => (
        <div key={post.id} className="enter" style={stagger(i, 5)}>
          <PostCard post={post} signedIn={signedIn} />
        </div>
      ))}
      <div ref={sentinel} />
      {posts.isFetchingNextPage ? <LoadingRow /> : null}
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div className={styles.page} aria-label="Loading profile">
      <Skeleton height={168} radius={0} />
      <div className="col gap-12" style={{ padding: 16 }}>
        <Skeleton width={92} height={92} radius={46} style={{ marginTop: -50 }} />
        <Skeleton width="55%" height={24} />
        <Skeleton width="70%" height={14} />
        <Skeleton width="40%" height={14} />
        <div className="row gap-10" style={{ marginTop: 8 }}>
          <Skeleton width={120} height={44} radius={10} />
          <Skeleton width={120} height={44} radius={10} />
        </div>
      </div>
    </div>
  );
}
