import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { openChatWith } from '@/lib/actions';
import { api, errorMessage } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { keys } from '@/lib/queries';
import type { Suggestion, UserSummary } from '@/lib/types';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import { IconCheck, IconMapPin, IconMessageCircle, IconSparkles, IconUserPlus } from '../icons';
import { Avatar, Button, Card, Chip, IconButton } from '../ui';
import styles from './ResearcherCard.module.css';

/** Suggested researcher card with a Connect button that turns into "Request sent". */
export function ResearcherCard({ person, compact }: { person: Suggestion; compact?: boolean }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<'idle' | 'loading' | 'sent'>('idle');

  const connect = async () => {
    setState('loading');
    try {
      await api('/api/connections/request', { method: 'POST', body: { userId: person.id } });
      setState('sent');
      feedback.success();
      queryClient.invalidateQueries({ queryKey: keys.connectionRequests });
      queryClient.invalidateQueries({ queryKey: keys.profile(person.username) });
    } catch (error) {
      setState('idle');
      feedback.error();
      toast.error('Request not sent', errorMessage(error));
    }
  };

  return (
    <Card className={`${styles.card} ${compact ? styles.compact : ''}`}>
      <Link to={`/u/${person.username}`} className={styles.top} aria-label={`${person.name}'s profile`}>
        <Avatar name={person.name} url={person.avatarUrl} size={compact ? 44 : 54} online={person.online} />
        <span className="col grow gap-4">
          <span className={`${styles.name} nowrap`}>{person.name}</span>
          {person.headline ? <span className="t-meta clamp-2">{person.headline}</span> : null}
          {person.institution ? <span className="t-caption nowrap">{person.institution}</span> : null}
        </span>
      </Link>
      {!compact ? (
        <>
          <p className={styles.reason}>
            <IconSparkles size={13} aria-hidden />
            <span className="clamp-2">{person.reason}</span>
          </p>
          {person.location ? (
            <p className={styles.location}>
              <IconMapPin size={13} color={colors.text3} aria-hidden />
              <span className="t-caption">{person.location}</span>
            </p>
          ) : null}
          {person.interests.length ? (
            <div className="row wrap gap-6">
              {person.interests.slice(0, 4).map((interest) => (
                <Chip key={interest} label={interest} small tone={person.sharedInterests.includes(interest) ? 'accent' : 'quiet'} />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      <div className={styles.actions}>
        {state === 'sent' ? (
          <span className={styles.sent} role="status">
            <IconCheck size={16} aria-hidden />
            Request sent
          </span>
        ) : (
          <Button label="Connect" icon={IconUserPlus} size="sm" loading={state === 'loading'} onClick={connect} className="grow" silent />
        )}
        <IconButton
          icon={IconMessageCircle}
          label={`Message ${person.name}`}
          bordered
          background={colors.surfaceRaised}
          size={34}
          onClick={() => openChatWith(person.id, { signedIn: true })}
        />
      </div>
    </Card>
  );
}

/** Simple researcher row used in search results and connection lists. */
export function ResearcherRow({ person, right }: { person: UserSummary; right?: ReactNode }) {
  return (
    <div className={styles.row}>
      <Link to={`/u/${person.username}`} className={styles.rowMain} aria-label={`${person.name}'s profile`} onClick={() => feedback.tap()}>
        <Avatar name={person.name} url={person.avatarUrl} size={46} online={person.online} />
        <span className="col grow">
          <span className={`${styles.name} nowrap`}>{person.name}</span>
          <span className="t-meta nowrap">{person.headline || person.institution || `@${person.username}`}</span>
        </span>
      </Link>
      {right}
    </div>
  );
}
