import { Link } from 'react-router';
import { feedback } from '@/lib/feedback';
import { timeAgo } from '@/lib/format';
import type { Conversation } from '@/lib/types';
import { usePresence, useRealtime } from '@/store/realtime';
import { colors } from '@/theme';
import { IconClock } from '../icons';
import { Avatar, CountBadge } from '../ui';
import styles from './ConversationRow.module.css';
import { TypingDots } from './TypingDots';

export function ConversationRow({ conversation, myId }: { conversation: Conversation; myId: string }) {
  const typing = useRealtime((s) => s.typing[conversation.id]);
  const presence = usePresence(conversation.other.id, conversation.other);
  const last = conversation.lastMessage;
  const unread = conversation.unread > 0;
  const pending = conversation.status === 'request' && conversation.isRequester;
  const preview = last ? `${last.senderId === myId ? 'You: ' : ''}${last.text}` : 'No messages yet';

  return (
    <Link
      to={`/chat/${conversation.id}`}
      className={`${styles.row} ${unread ? styles.unread : ''}`}
      aria-label={`Conversation with ${conversation.other.name}${unread ? `, ${conversation.unread} unread` : ''}`}
      onClick={() => feedback.tap()}
    >
      <Avatar name={conversation.other.name} url={conversation.other.avatarUrl} size={52} online={presence.online} />
      <span className="col grow gap-4">
        <span className={styles.line}>
          <span className={`${styles.name} nowrap`}>{conversation.other.name}</span>
          <span className="t-caption" style={{ color: unread ? colors.accent : colors.text3 }}>
            {timeAgo(last?.createdAt ?? conversation.lastMessageAt)}
          </span>
        </span>
        <span className={styles.line}>
          {typing ? (
            <span className={styles.typing}>
              <span className={styles.typingText}>typing</span>
              <TypingDots color={colors.accent} size={4} />
            </span>
          ) : (
            <span className={`${styles.preview} nowrap`}>{preview}</span>
          )}
          {pending ? (
            <span className={styles.pending}>
              <IconClock size={11} aria-hidden />
              Request sent
            </span>
          ) : unread ? (
            <CountBadge count={conversation.unread} tone="accent" />
          ) : null}
        </span>
      </span>
    </Link>
  );
}
