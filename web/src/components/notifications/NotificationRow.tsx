import type { InfiniteData } from '@tanstack/react-query';
import { useState, type ComponentType } from 'react';
import { api, errorMessage } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { timeAgo } from '@/lib/format';
import { navigate } from '@/lib/nav';
import { notificationHref } from '@/lib/navigation';
import { keys, queryClient } from '@/lib/queries';
import type { AppNotification, Page } from '@/lib/types';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import {
  IconDownload,
  IconAtSign,
  IconFlag,
  IconHeart,
  IconMessageCircle,
  IconMessageSquare,
  IconShieldCheck,
  IconUserCheck,
  IconUserPlus,
  type IconProps,
} from '../icons';
import { Avatar, Button, LogoMark } from '../ui';
import styles from './NotificationRow.module.css';

const TYPE_STYLE: Record<AppNotification['type'], { icon: ComponentType<IconProps>; color: string }> = {
  connection_request: { icon: IconUserPlus, color: colors.steel },
  connection_accepted: { icon: IconUserCheck, color: colors.accent },
  message_request: { icon: IconMessageCircle, color: colors.steel },
  message_request_accepted: { icon: IconMessageCircle, color: colors.accent },
  post_like: { icon: IconHeart, color: colors.like },
  post_comment: { icon: IconMessageSquare, color: colors.steel },
  post_mention: { icon: IconAtSign, color: colors.accent },
  comment_mention: { icon: IconAtSign, color: colors.accent },
  paper_download: { icon: IconDownload, color: colors.accent },
  post_flagged: { icon: IconFlag, color: colors.warning },
  post_removed: { icon: IconFlag, color: colors.danger },
  post_restored: { icon: IconShieldCheck, color: colors.success },
};

type NotificationPages = InfiniteData<Page<AppNotification> & { unreadByCategory: Record<string, number> }>;

function patchAll(update: (n: AppNotification) => AppNotification | null) {
  queryClient.setQueriesData<NotificationPages>({ queryKey: ['notifications'] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            results: p.results.map(update).filter(Boolean) as AppNotification[],
          })),
        }
      : data,
  );
}

export function markRead(id: string) {
  patchAll((n) => (n.id === id ? { ...n, read: true } : n));
  api(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
}

export function NotificationRow({ notification: n }: { notification: AppNotification }) {
  const [busy, setBusy] = useState<string | null>(null);
  const type = TYPE_STYLE[n.type];
  const TypeIcon = type.icon;
  const href = notificationHref(n);

  const answer = async (action: 'accept' | 'decline') => {
    if (!n.connectionId) return;
    setBusy(action);
    try {
      await api(`/api/connections/${n.connectionId}/${action}`, { method: 'POST' });
      if (action === 'accept') {
        feedback.success();
        toast.success(`You and ${n.actor?.name ?? 'this researcher'} are now connected`);
      } else feedback.tap();
      patchAll((x) => (x.id === n.id ? null : x));
      queryClient.invalidateQueries({ queryKey: keys.connectionRequests });
      queryClient.invalidateQueries({ queryKey: keys.connections });
    } catch (error) {
      toast.error('Something went wrong', errorMessage(error));
      setBusy(null);
    }
  };

  const open = () => {
    feedback.tap();
    if (!n.read) markRead(n.id);
    if (href) navigate(href);
  };

  return (
    <div className={`${styles.row} ${!n.read ? styles.unread : ''}`}>
      <button type="button" className={styles.hit} aria-label={`${n.actor?.name ?? ''} ${n.text}`.trim()} onClick={open} />
      <span className={styles.avatar}>
        {n.actor ? (
          <Avatar name={n.actor.name} url={n.actor.avatarUrl} size={48} />
        ) : (
          <span className={styles.system}>
            <LogoMark size={26} />
          </span>
        )}
        <span className={styles.typeBadge} style={{ background: type.color }}>
          <TypeIcon size={11} color={colors.white} strokeWidth={2.5} fill={n.type === 'post_like' ? colors.white : 'transparent'} aria-hidden />
        </span>
      </span>
      <div className="col grow gap-4">
        <p className="t-body" style={{ color: colors.inkSoft }}>
          {n.actor ? <strong className={styles.actor}>{n.actor.name} </strong> : null}
          {n.text}
        </p>
        <time className="t-caption" style={{ color: n.read ? colors.text3 : colors.accent }} dateTime={n.createdAt}>
          {timeAgo(n.createdAt)}
        </time>
        {n.type === 'connection_request' && n.connectionId ? (
          <div className={styles.actions}>
            <Button label="Accept" size="sm" variant="accent" loading={busy === 'accept'} onClick={() => answer('accept')} silent />
            <Button label="Decline" size="sm" variant="secondary" loading={busy === 'decline'} onClick={() => answer('decline')} />
          </div>
        ) : null}
        {n.type === 'message_request' && n.conversationId ? (
          <div className={styles.actions}>
            <Button label="View request" size="sm" variant="secondary" to={`/chat/${n.conversationId}`} />
          </div>
        ) : null}
      </div>
      {!n.read ? <span className={styles.dot} aria-label="Unread" /> : null}
    </div>
  );
}
