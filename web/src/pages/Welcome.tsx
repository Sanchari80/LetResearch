import { IconLock } from '@/components/icons';
import { InstallLink } from '@/components/InstallApp';
import { AnimatedLogoMark, Button, Wordmark } from '@/components/ui';
import { PUBLISHER } from '@/lib/config';
import { useLayout, usePageTitle } from '@/lib/hooks';
import { colors } from '@/theme';
import styles from './Welcome.module.css';

const SAMPLE = [
  { title: 'Monsoon onset shifts in regional climate downscaling', cite: 'Geophysical Research Letters, 2025' },
  { title: 'A benchmark dataset of rice pathogen genomes', cite: 'Scientific Data, 2024' },
];

/** A miniature of the profile paper index – the heart of LetResearch. */
function IndexPreview() {
  return (
    <div className={styles.preview} aria-hidden>
      <div className={styles.plaque}>
        <span className={styles.numeral}>[3]</span>
        <span className={styles.plaqueLabel}>Research papers</span>
      </div>
      <div className={styles.rows}>
        {SAMPLE.map((row, i) => (
          <div key={row.title} className={styles.row} style={{ animationDelay: `${800 + i * 140}ms` }}>
            <span className={styles.index}>[{i + 1}]</span>
            <span className="col grow">
              <span className={styles.title}>{row.title}</span>
              <span className={styles.cite}>{row.cite}</span>
            </span>
          </div>
        ))}
        <div className={styles.row} style={{ animationDelay: '1080ms' }}>
          <span className={styles.index}>[3]</span>
          <span className="row gap-6 grow">
            <IconLock size={13} color={colors.text3} />
            <span className={styles.restricted}>Restricted – visible to connections</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  usePageTitle('Welcome');
  const { isWide } = useLayout();
  return (
    <div className={styles.root}>
      <main className={styles.body}>
        <section className={styles.intro}>
          <AnimatedLogoMark size={isWide ? 88 : 80} />
          <h1 className={styles.wordmark}>
            <Wordmark size={isWide ? 44 : 36} />
          </h1>
          <p className={`t-lead ${styles.lead}`}>
            Share your research, curate your paper index and talk with researchers who work on what you do.
          </p>
          <div className={styles.buttons}>
            <Button label="Create an account" size="lg" fullWidth to="/register" />
            <Button label="Sign in" size="lg" variant="secondary" fullWidth to="/login" />
            <InstallLink />
          </div>
        </section>
        <div className={styles.previewWrap}>
          <IndexPreview />
        </div>
      </main>
      <p className={`t-caption ${styles.publisher}`}>Published by {PUBLISHER}</p>
    </div>
  );
}
