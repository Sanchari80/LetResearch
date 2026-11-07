import { useQueryClient } from '@tanstack/react-query';
import { useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  IconBookOpen,
  IconChevronRight,
  IconCopy,
  IconFlag,
  IconListOrdered,
  IconLock,
  IconLogOut,
  IconPencil,
  IconShieldCheck,
  type IconProps,
} from '@/components/icons';
import { InstallSettingsCard } from '@/components/InstallApp';
import { OptionList } from '@/components/privacy/PrivacyControls';
import { PushSettingsCard } from '@/components/PushNotifications';
import { Button, Card, confirm, InlineNotice, LogoMark, PageHeader, Sheet, TextField, Toggle } from '@/components/ui';
import { copyToClipboard } from '@/lib/actions';
import { api, errorMessage } from '@/lib/api';
import { APP_VERSION, profileLink, PUBLISHER } from '@/lib/config';
import { canVibrate, feedback } from '@/lib/feedback';
import { usePageTitle } from '@/lib/hooks';
import { isTouchDevice } from '@/lib/pickers';
import { keys } from '@/lib/queries';
import { stagger } from '@/lib/style';
import { useAuth } from '@/providers/AuthProvider';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import page from './Page.module.css';
import styles from './Settings.module.css';

interface RowProps {
  icon: ComponentType<IconProps>;
  label: string;
  description?: string;
  to?: string;
  onClick?: () => void;
  right?: ReactNode;
}

function Row({ icon: Icon, label, description, to, onClick, right }: RowProps) {
  const content = (
    <>
      <span className={styles.rowIcon}>
        <Icon size={18} color={colors.inkSoft} aria-hidden />
      </span>
      <span className="col grow">
        <span className={styles.rowLabel}>{label}</span>
        {description ? <span className="t-caption nowrap">{description}</span> : null}
      </span>
      {right ?? <IconChevronRight size={18} color={colors.silver} aria-hidden />}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={`${styles.row} press`} onClick={() => feedback.tap()}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={`${styles.row} press`}
      onClick={() => {
        feedback.tap();
        onClick?.();
      }}
    >
      {content}
    </button>
  );
}

function PasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (saving) return;
    if (next.length < 8) return setError('Use at least 8 characters for the new password.');
    setSaving(true);
    try {
      await api('/api/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      feedback.success();
      toast.success('Password changed');
      setCurrent('');
      setNext('');
      setError(null);
      onClose();
    } catch (e) {
      feedback.error();
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Change password">
      <form className="col gap-12" onSubmit={submit} noValidate>
        <TextField label="Current password" type="password" value={current} onChange={setCurrent} autoComplete="current-password" />
        <TextField
          label="New password"
          type="password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          hint="At least 8 characters."
        />
        {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
        <Button label="Update password" type="submit" loading={saving} fullWidth silent />
      </form>
    </Sheet>
  );
}

export default function SettingsPage() {
  usePageTitle('Settings');
  const { user, isAdmin, signOut, setUser } = useAuth();
  const queryClient = useQueryClient();
  const { sound, haptics, setSound, setHaptics } = useSettings();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const messageRequests = user?.settings?.messageRequests ?? 'everyone';
  const showHaptics = canVibrate() && isTouchDevice();

  const setMessageRequests = async (value: 'everyone' | 'none') => {
    if (!user) return;
    const previous = messageRequests;
    setUser({ ...user, settings: { messageRequests: value } });
    try {
      await api('/api/users/me', { method: 'PATCH', body: { settings: { messageRequests: value } } });
      toast.success('Message settings saved');
      void queryClient.invalidateQueries({ queryKey: keys.profile(user.username) });
    } catch (e) {
      setUser({ ...user, settings: { messageRequests: previous } });
      toast.error('Could not save', errorMessage(e));
    }
  };

  if (!user) return null;

  const sections: ReactNode[] = [
    <Card key="account" as="section" className={styles.card}>
      <h2 className={`t-title ${styles.title}`}>Account</h2>
      <Row icon={IconPencil} label="Edit profile and privacy" description="Details, links and who can see each one" to="/edit-profile" />
      <Row icon={IconListOrdered} label="Manage papers" description="Arrange your profile paper index" to="/papers" />
      <Row
        icon={IconCopy}
        label="Copy profile link"
        description={profileLink(user.username)}
        onClick={() => copyToClipboard(profileLink(user.username), 'Profile link copied')}
      />
      <Row icon={IconLock} label="Change password" onClick={() => setPasswordOpen(true)} />
    </Card>,
    <Card key="messages" as="section" className={styles.card}>
      <h2 className={`t-title ${styles.title}`}>Message requests</h2>
      <p className="t-meta" style={{ marginBottom: 10 }}>
        Who can send you a message without being connected.
      </p>
      <OptionList
        label="Who can send you a message request"
        options={[
          { value: 'everyone', label: 'Everyone', description: 'Messages from non-connections arrive in Message requests.' },
          { value: 'none', label: 'Connections only', description: 'Others must connect with you before messaging.' },
        ]}
        value={messageRequests}
        onSelect={(v) => {
          feedback.toggle();
          void setMessageRequests(v as 'everyone' | 'none');
        }}
      />
    </Card>,
    <PushSettingsCard key="push" />,
    <InstallSettingsCard key="install" />,
    <Card key="experience" as="section" className={styles.card}>
      <h2 className={`t-title ${styles.title}`}>Sound and feel</h2>
      <Toggle value={sound} onChange={setSound} label="Sound effects" description="Subtle clicks for likes, messages, toggles and alerts." />
      {showHaptics ? (
        <Toggle value={haptics} onChange={setHaptics} label="Haptic feedback" description="Gentle vibrations when you interact." />
      ) : null}
    </Card>,
    isAdmin ? (
      <Card key="moderation" as="section" className={styles.card}>
        <h2 className={`t-title ${styles.title}`}>Moderation</h2>
        <Row icon={IconFlag} label="Review reported posts" description="Approve or remove posts hidden by community reports" to="/moderation" />
      </Card>
    ) : null,
    <Card key="about" as="section" className={styles.card}>
      <h2 className={`t-title ${styles.title}`}>About</h2>
      <Row icon={IconShieldCheck} label="Community guidelines" description="What can be shared on LetResearch" to="/guidelines" />
      <div className={styles.about}>
        <LogoMark size={36} />
        <span className="col grow">
          <span className={styles.appName}>LetResearch {APP_VERSION}</span>
          <span className="t-caption">Published by {PUBLISHER}</span>
        </span>
        <IconBookOpen size={18} color={colors.silver} aria-hidden />
      </div>
    </Card>,
  ].filter(Boolean);

  return (
    <>
      <PageHeader title="Settings" back backFallback="/profile" width="form" />
      <main className={`container w-form ${page.body}`} style={{ gap: 14 }}>
        {sections.map((section, i) => (
          <div key={i} className="enter" style={stagger(i)}>
            {section}
          </div>
        ))}
        <Button
          label="Sign out"
          icon={IconLogOut}
          variant="danger"
          fullWidth
          onClick={async () => {
            const ok = await confirm({ title: 'Sign out of LetResearch?', confirmLabel: 'Sign out', destructive: true });
            if (ok) void signOut();
          }}
        />
      </main>
      <PasswordSheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
}
