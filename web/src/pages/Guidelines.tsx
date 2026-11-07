import { IconCheck, IconFlag, IconShieldCheck, IconX } from '@/components/icons';
import { Card, PageHeader } from '@/components/ui';
import { ALLOWED, GUIDELINES, NOT_ALLOWED } from '@/lib/constants';
import { usePageTitle } from '@/lib/hooks';
import { stagger } from '@/lib/style';
import { colors } from '@/theme';
import styles from './Guidelines.module.css';
import page from './Page.module.css';

export default function GuidelinesPage() {
  usePageTitle('Community guidelines');
  return (
    <>
      <PageHeader title="Community guidelines" back backFallback="/" width="form" />
      <main className={`container w-form ${page.body}`}>
        <section className="col gap-8 enter">
          <span className={styles.hero}>
            <IconShieldCheck size={26} color={colors.success} aria-hidden />
          </span>
          <h2 className="t-heading">An academic network, kept academic</h2>
          <p className="t-body" style={{ color: colors.inkSoft }}>
            LetResearch exists for sharing research. Every post is checked before it is published, and the community can report
            anything that slips through.
          </p>
        </section>

        <Card as="section" className="col gap-10 enter" style={stagger(1)}>
          <h2 className="t-title">Welcome here</h2>
          <ul className={styles.list}>
            {ALLOWED.map((item) => (
              <li key={item} className={styles.item}>
                <IconCheck size={17} color={colors.success} aria-hidden />
                <span className="t-body grow">{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card as="section" className="col gap-10 enter" style={stagger(2)}>
          <h2 className="t-title">Not published</h2>
          <ul className={styles.list}>
            {NOT_ALLOWED.map((item) => (
              <li key={item} className={styles.item}>
                <IconX size={17} color={colors.danger} aria-hidden />
                <span className="t-body grow">{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card as="section" className="col gap-10 enter" style={stagger(3)}>
          <h2 className="t-title">How moderation works</h2>
          <ol className={styles.list}>
            {GUIDELINES.map((item, i) => (
              <li key={item} className={styles.item}>
                <span className="t-strong" style={{ color: colors.accent }}>
                  {i + 1}.
                </span>
                <span className="t-body grow">{item}</span>
              </li>
            ))}
          </ol>
          <div className={styles.item} style={{ marginTop: 4 }}>
            <IconFlag size={17} color={colors.warning} aria-hidden />
            <p className="t-meta grow">
              Posts reported by several researchers are hidden until a moderator reviews them. The author is notified, and the post
              returns if it follows these guidelines.
            </p>
          </div>
        </Card>
      </main>
    </>
  );
}
