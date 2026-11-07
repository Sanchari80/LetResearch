import { memo } from 'react';
import { openUrl } from '@/lib/actions';
import { fileUrl } from '@/lib/config';
import { feedback } from '@/lib/feedback';
import { clockTime, dayLabel, fileKindLabel, fileSize } from '@/lib/format';
import type { Message } from '@/lib/types';
import { colors } from '@/theme';
import { IconCheck, IconCheckCheck, IconCircleAlert, IconClock, IconFileText } from '../icons';
import styles from './MessageBubble.module.css';

interface Props {
  message: Message;
  mine: boolean;
  /** First message of a run from the same sender (oldest in the group). */
  groupStart: boolean;
  /** Last message of a run (newest) – shows the time and the bubble tail. */
  groupEnd: boolean;
  dayDivider: string | null;
  receipt: 'sending' | 'failed' | 'sent' | 'seen' | null;
  animate: boolean;
  onImageClick: (uri: string) => void;
  onRetry: (message: Message) => void;
}

export function DayDivider({ label }: { label: string }) {
  return (
    <div className={styles.divider} role="separator">
      <span className={styles.dividerLine} />
      <span className="t-caption" style={{ color: colors.text3 }}>
        {label}
      </span>
      <span className={styles.dividerLine} />
    </div>
  );
}

function MessageBubbleBase({ message, mine, groupStart, groupEnd, dayDivider, receipt, animate, onImageClick, onRetry }: Props) {
  const attachment = message.attachment;
  const imageUri = message.kind === 'image' ? message.localUri || fileUrl(attachment?.url) : null;
  // Bubbles in a run share a flatter edge on the sender's side.
  const corner = {
    borderTopRightRadius: mine && !groupStart ? 6 : 18,
    borderBottomRightRadius: mine ? 6 : 18,
    borderTopLeftRadius: !mine && !groupStart ? 6 : 18,
    borderBottomLeftRadius: !mine ? 6 : 18,
  };

  return (
    <div className={styles.wrap} style={{ marginTop: groupStart ? 10 : 2 }}>
      {dayDivider ? <DayDivider label={dayDivider} /> : null}
      <div className={`${styles.row} ${mine ? styles.rowMine : styles.rowTheirs} ${animate ? (mine ? styles.inRight : styles.inLeft) : ''}`}>
        {imageUri ? (
          <button type="button" className={styles.imageWrap} style={corner} aria-label="Open photo" onClick={() => onImageClick(imageUri)}>
            <img src={imageUri} alt="" className={styles.image} loading="lazy" />
          </button>
        ) : null}
        {message.kind === 'file' && attachment ? (
          <button
            type="button"
            className={`${styles.file} ${mine ? styles.bubbleMine : styles.bubbleTheirs}`}
            style={corner}
            aria-label={`Open ${attachment.name}`}
            onClick={() => {
              feedback.tap();
              const target = fileUrl(attachment.downloadUrl);
              if (target && !message.pending) openUrl(target);
            }}
          >
            <span className={`${styles.fileIcon} ${mine ? styles.fileIconMine : ''}`}>
              <IconFileText size={18} color={mine ? colors.white : colors.inkSoft} aria-hidden />
            </span>
            <span className="col" style={{ minWidth: 0 }}>
              <span className={`${styles.fileName} nowrap`}>{attachment.name}</span>
              <span className={styles.fileMeta}>
                {fileKindLabel(attachment.mime)} {fileSize(attachment.size)}
              </span>
            </span>
          </button>
        ) : null}
        {message.text ? (
          <div
            className={`${styles.bubble} ${mine ? styles.bubbleMine : styles.bubbleTheirs}`}
            style={{ ...corner, marginTop: imageUri ? 4 : 0 }}
          >
            <p className={`${styles.text} pre-wrap`}>{message.text}</p>
          </div>
        ) : null}
      </div>
      {groupEnd || receipt ? (
        <div className={`${styles.meta} ${mine ? styles.metaMine : ''}`}>
          {groupEnd ? <time className={styles.time}>{clockTime(message.createdAt)}</time> : null}
          {receipt === 'sending' ? <IconClock size={12} color={colors.text3} aria-label="Sending" /> : null}
          {receipt === 'sent' ? <IconCheck size={13} color={colors.text3} aria-label="Sent" /> : null}
          {receipt === 'seen' ? (
            <span className={styles.seen}>
              <IconCheckCheck size={14} color={colors.accent} aria-hidden />
              <span className={styles.time} style={{ color: colors.accent }}>
                Seen
              </span>
            </span>
          ) : null}
          {receipt === 'failed' ? (
            <button type="button" className={styles.retry} onClick={() => onRetry(message)}>
              <IconCircleAlert size={12} color={colors.danger} aria-hidden /> Not sent. Tap to retry
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleBase);

export function dividerFor(current: Message, older?: Message) {
  if (!older) return dayLabel(current.createdAt);
  const a = new Date(current.createdAt);
  const b = new Date(older.createdAt);
  return a.toDateString() === b.toDateString() ? null : dayLabel(current.createdAt);
}
