import type { ReactNode } from 'react';
import { Link } from 'react-router';
import styles from './MentionText.module.css';

const MENTION = /(^|[\s([{])@([a-z0-9._-]{3,30})(?=$|[\s.,!?;:)\]}])/gi;

export function MentionText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(MENTION)) {
    const index = match.index ?? 0;
    const prefix = match[1];
    const username = match[2];
    const mentionStart = index + prefix.length;
    if (mentionStart > cursor) parts.push(text.slice(cursor, mentionStart));
    parts.push(
      <Link
        key={`${mentionStart}-${username}`}
        to={`/u/${encodeURIComponent(username)}`}
        className={styles.mention}
        onClick={(event) => event.stopPropagation()}
      >
        {`@${username}`}
      </Link>,
    );
    cursor = mentionStart + username.length + 1;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
