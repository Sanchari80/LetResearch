import { Link } from 'react-router';
import { IconArrowLeft } from '@/components/icons';
import { Button, IconButton, Logo, LogoMark } from '@/components/ui';
import { useLayout } from '@/lib/hooks';
import { goBack } from '@/lib/nav';
import { useAuth } from '@/providers/AuthProvider';
import styles from './PublicBar.module.css';

/**
 * Top bar for pages that open from shared links (profiles, posts, papers). Visitors who are
 * not signed in get Sign in and Join buttons; researchers get a back button.
 */
export function PublicBar({ title, width = 'page' }: { title?: string; width?: 'page' | 'feed' | 'form' }) {
  const { status } = useAuth();
  const { width: screen, isWide } = useLayout();
  const signedIn = status === 'signedIn';
  return (
    <header className={styles.bar}>
      <div className={`container ${styles.inner} ${styles[width]}`}>
        {signedIn ? (
          <>
            <IconButton icon={IconArrowLeft} label="Go back" onClick={() => goBack('/')} style={{ marginLeft: -8 }} />
            {title ? (
              <h1 className="t-title nowrap grow">{title}</h1>
            ) : (
              <span className="grow">{!isWide ? <Logo size={24} /> : null}</span>
            )}
          </>
        ) : (
          <>
            <Link to="/welcome" aria-label="LetResearch home" className="row">
              {screen < 420 ? <LogoMark size={28} /> : <Logo size={24} />}
            </Link>
            <span className="grow" />
            <Button label="Sign in" size="sm" variant="ghost" to="/login" />
            <Button label="Join LetResearch" size="sm" to="/register" />
          </>
        )}
      </div>
    </header>
  );
}
