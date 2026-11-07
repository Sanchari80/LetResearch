// Turning device notifications (web push) on and off: a card in Settings and a gentle prompt
// at the top of the Notifications page.
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { disablePush, enablePush, getPushStatus, type PushStatus } from '@/lib/push';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import { IconBellRing, IconX } from './icons';
import styles from './PushNotifications.module.css';
import { Button, Card, IconButton, Toggle } from './ui';

const PROMPT_KEY = 'letresearch.pushPrompt.dismissed';

function usePushStatus() {
  const [status, setStatus] = useState<PushStatus | 'loading'>('loading');
  const refresh = useCallback(() => {
    getPushStatus()
      .then(setStatus)
      .catch(() => setStatus('unsupported'));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { status, setStatus, refresh };
}

async function turnOn(onDone: (status: PushStatus) => void) {
  try {
    await enablePush();
    feedback.success();
    toast.success('Notifications are on', 'You will be alerted even when LetResearch is closed.');
    onDone('on');
  } catch (error) {
    feedback.error();
    toast.error('Notifications not turned on', errorMessage(error));
    onDone(await getPushStatus().catch(() => 'unsupported' as const));
  }
}

const NOTES: Partial<Record<PushStatus, string>> = {
  denied: "Notifications are blocked for this site. Allow them in your browser's site settings, then come back here.",
  'needs-install':
    'On iPhone and iPad, add LetResearch to your Home Screen first (see Get the app), then turn on notifications from the installed app.',
  unsupported: "This browser can't show notifications while LetResearch is closed. You still get live alerts while it's open.",
};

/** Settings card: one switch for alerts while the app is closed. */
export function PushSettingsCard() {
  const { status, setStatus } = usePushStatus();
  const [busy, setBusy] = useState(false);
  if (status === 'loading') return null;
  const supported = status === 'on' || status === 'off';
  return (
    <Card className="col gap-4" style={{ paddingTop: 12, paddingBottom: 12 }}>
      <h2 className="t-title">Notifications</h2>
      <Toggle
        value={status === 'on'}
        disabled={!supported || busy}
        label="Alerts on this device"
        description="Messages, requests, likes, comments and paper downloads – even when LetResearch is closed."
        onChange={async (next) => {
          setBusy(true);
          if (next) await turnOn(setStatus);
          else {
            await disablePush();
            setStatus('off');
            toast.info('Notifications are off on this device');
          }
          setBusy(false);
        }}
      />
      {NOTES[status] ? (
        <p className="t-caption" style={{ color: colors.text2 }}>
          {NOTES[status]}
        </p>
      ) : null}
    </Card>
  );
}

/** Gentle, dismissible suggestion on the Notifications page. */
export function PushPrompt() {
  const { status, setStatus } = usePushStatus();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(PROMPT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const show = status === 'off' && !dismissed;
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(PROMPT_KEY, '1');
    } catch {
      // Ignore.
    }
  };
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          key="push-prompt"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
        >
          <Card className={styles.prompt}>
            <span className={styles.icon}>
              <IconBellRing size={20} color={colors.accent} aria-hidden />
            </span>
            <div className="col grow gap-4">
              <p className="t-strong">Get notified when you're away</p>
              <p className="t-meta">Hear about messages, requests and paper downloads even when LetResearch is closed.</p>
              <div className="row gap-8" style={{ marginTop: 6 }}>
                <Button
                  label="Turn on"
                  size="sm"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    await turnOn(setStatus);
                    setBusy(false);
                  }}
                  silent
                />
                <Button label="Not now" size="sm" variant="ghost" onClick={dismiss} />
              </div>
            </div>
            <IconButton icon={IconX} label="Hide this suggestion" size={32} color={colors.text3} onClick={dismiss} />
          </Card>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
