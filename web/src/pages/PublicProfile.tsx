import { useParams } from 'react-router';
import { ProfileView } from '@/components/profile/ProfileView';
import { usePageTitle } from '@/lib/hooks';
import { useProfile } from '@/lib/queries';
import { PublicBar } from './PublicBar';

/**
 * Public profile – the page behind "Copy profile link". Works for signed-in researchers
 * and for visitors who open a shared link in a browser.
 */
export default function PublicProfilePage() {
  const { handle = '' } = useParams();
  const profile = useProfile(handle);
  usePageTitle(profile.data?.user.name ?? 'Researcher');
  return (
    <>
      <PublicBar />
      <main>
        <ProfileView key={handle} handle={handle} />
      </main>
    </>
  );
}
