import { IconCompass } from '@/components/icons';
import { Button, EmptyState } from '@/components/ui';
import { usePageTitle } from '@/lib/hooks';
import page from './Page.module.css';

export default function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <main className={page.centerScreen} style={{ minHeight: '100dvh' }}>
      <EmptyState
        icon={IconCompass}
        title="This page doesn't exist"
        message="The link may be broken, or the page may have been removed."
        action={<Button label="Go to LetResearch" to="/" />}
      />
    </main>
  );
}
