// "Get the app": a feed banner, a link on the welcome screen and a card in Settings.
// They open the browser's install dialog when there is one, or show short step-by-step instructions.
// Nothing here shows when LetResearch already runs as an installed app.
import { AnimatePresence, motion } from 'motion/react';
import { useState, type ComponentType, type CSSProperties } from 'react';
import { openUrl } from '@/lib/actions';
import { ANDROID_APK_URL } from '@/lib/config';
import { feedback } from '@/lib/feedback';
import { promptInstall, useInstall, type InstallDevice } from '@/lib/install';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import {
  IconDownload,
  IconEllipsisVertical,
  IconMonitorDown,
  IconShareSquare,
  IconSmartphone,
  IconSquarePlus,
  IconX,
  type IconProps,
} from './icons';
import styles from './InstallApp.module.css';
import { Button, Card, Divider, IconButton, InlineNotice, LogoMark, Sheet } from './ui';

const DISMISS_KEY = 'letresearch.installBanner.dismissed';

interface Guide {
  title: string;
  intro: string;
  steps: { icon: ComponentType<IconProps>; text: string }[];
}

const GUIDES: Record<InstallDevice, Guide> = {
  ios: {
    title: 'Add LetResearch to your Home Screen',
    intro: 'It opens full screen, like the other apps on your iPhone or iPad.',
    steps: [
      { icon: IconShareSquare, text: 'Tap the Share button in your browser – the square with an arrow pointing up.' },
      { icon: IconSquarePlus, text: 'Scroll down and tap “Add to Home Screen”.' },
      { icon: IconSmartphone, text: 'Tap “Add”. LetResearch is now on your Home Screen.' },
    ],
  },
  android: {
    title: 'Install LetResearch on your phone',
    intro: 'It opens full screen and sits with your other apps.',
    steps: [
      { icon: IconEllipsisVertical, text: 'Open your browser menu – the three dots at the top right in Chrome.' },
      { icon: IconDownload, text: 'Tap “Install app” or “Add to Home screen”.' },
      { icon: IconSmartphone, text: 'Confirm. LetResearch now opens from your app list.' },
    ],
  },
  desktop: {
    title: 'Install LetResearch on this computer',
    intro: 'It opens in its own window, separate from your browser tabs.',
    steps: [
      { icon: IconMonitorDown, text: 'In Chrome or Edge, click the install icon at the right end of the address bar.' },
      {
        icon: IconEllipsisVertical,
        text: 'Or open the browser menu and choose “Install LetResearch”. In Safari on a Mac, choose File > Add to Dock.',
      },
    ],
  },
};

const BANNER_TEXT: Record<InstallDevice, string> = {
  ios: 'Add it to your Home Screen.',
  android: 'Install it on your phone.',
  desktop: 'Install it on this computer.',
};

/** True when LetResearch is not already running as an installed app. */
export function useCanOfferInstall() {
  return !useInstall((s) => s.standalone);
}

function openApk() {
  if (ANDROID_APK_URL) openUrl(ANDROID_APK_URL);
}

function installed() {
  feedback.success();
  toast.success('LetResearch is installed', 'Open it from your home screen or app list.');
}

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function GetAppSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const device = useInstall((s) => s.device);
  const canPrompt = useInstall((s) => s.canPrompt);
  const inAppBrowser = useInstall((s) => s.inAppBrowser);
  const guide = GUIDES[device];
  const showApk = !!ANDROID_APK_URL && device !== 'ios';

  return (
    <Sheet visible={visible} onClose={onClose} title={guide.title} description={guide.intro}>
      {inAppBrowser ? (
        <InlineNotice tone="warning" title="Open this page in your browser first" style={{ marginBottom: 14 }}>
          Apps like Facebook and Messenger open links in their own viewer, which cannot install apps. Use its menu and choose
          “Open in browser” (Chrome or Safari), then install from there.
        </InlineNotice>
      ) : null}
      {canPrompt ? (
        <Button
          label="Install app"
          icon={IconDownload}
          fullWidth
          onClick={async () => {
            const outcome = await promptInstall();
            if (outcome === 'accepted') {
              onClose();
              installed();
            }
          }}
        />
      ) : (
        <ol className={styles.steps}>
          {guide.steps.map((step, index) => (
            <li key={step.text} className={styles.step} style={{ animationDelay: `${80 + index * 70}ms` }}>
              <span className={styles.stepIcon}>
                <step.icon size={18} color={colors.ink} aria-hidden />
              </span>
              <span className={styles.stepText}>{step.text}</span>
            </li>
          ))}
        </ol>
      )}
      {showApk ? (
        <div>
          <Divider style={{ margin: '16px 0' }} />
          <p className="t-strong">Prefer the Android app?</p>
          <p className="t-meta" style={{ margin: '2px 0 12px' }}>
            Download the app file (APK) and open it to install. Your phone may ask you to allow installs from your browser first.
          </p>
          <Button label="Download Android app (APK)" variant="secondary" icon={IconSmartphone} fullWidth onClick={openApk} />
        </div>
      ) : null}
    </Sheet>
  );
}

/** Starts the install: the browser's own dialog when possible, otherwise the instructions sheet. */
function useGetApp() {
  const canPrompt = useInstall((s) => s.canPrompt);
  const device = useInstall((s) => s.device);
  const [open, setOpen] = useState(false);

  const start = async () => {
    // Go straight to the browser's dialog unless there is also an Android app file to choose from.
    const apkChoice = !!ANDROID_APK_URL && device === 'android';
    if (canPrompt && !apkChoice) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') installed();
      if (outcome !== null) return;
    }
    setOpen(true);
  };

  return { start, sheet: <GetAppSheet visible={open} onClose={() => setOpen(false)} /> };
}

/** Dismissible suggestion at the top of the feed. */
export function InstallBanner({ style }: { style?: CSSProperties }) {
  const offer = useCanOfferInstall();
  const device = useInstall((s) => s.device);
  const [hidden, setHidden] = useState(readDismissed);
  const { start, sheet } = useGetApp();
  if (!offer) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore – it stays hidden for this visit.
    }
  };

  return (
    <>
      <AnimatePresence initial={false}>
        {!hidden ? (
          <motion.div
            key="banner"
            style={style}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.22 } }}
          >
            <Card className={styles.banner}>
              <span className={styles.bannerMark}>
                <LogoMark size={24} />
              </span>
              <span className="col grow">
                <span className="t-strong">Get the app</span>
                <span className="t-caption">{BANNER_TEXT[device]}</span>
              </span>
              <Button label="Install" size="sm" onClick={start} />
              <IconButton icon={IconX} label="Hide this suggestion" size={32} color={colors.text3} onClick={dismiss} />
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {sheet}
    </>
  );
}

/** Quiet "Install the app" button for the welcome screen. */
export function InstallLink() {
  const offer = useCanOfferInstall();
  const { start, sheet } = useGetApp();
  if (!offer) return null;
  return (
    <>
      <Button label="Install the app" variant="ghost" icon={IconDownload} onClick={start} />
      {sheet}
    </>
  );
}

/** "Get the app" card in Settings. */
export function InstallSettingsCard() {
  const offer = useCanOfferInstall();
  const device = useInstall((s) => s.device);
  const { start, sheet } = useGetApp();
  if (!offer) return null;
  const showApk = !!ANDROID_APK_URL && device !== 'ios';
  return (
    <Card className={styles.settingsCard}>
      <h2 className="t-title">Get the app</h2>
      <p className="t-meta">
        {device === 'desktop'
          ? 'Install LetResearch on this computer so it opens in its own window.'
          : 'Install LetResearch on your phone so it opens full screen from your home screen, like any other app.'}
      </p>
      <Button label={device === 'ios' ? 'Add to Home Screen' : 'Install app'} icon={IconDownload} fullWidth onClick={start} style={{ marginTop: 4 }} />
      {showApk ? <Button label="Download Android app (APK)" variant="secondary" icon={IconSmartphone} fullWidth onClick={openApk} /> : null}
      {sheet}
    </Card>
  );
}
