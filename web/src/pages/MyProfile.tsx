import { useQueryClient } from '@tanstack/react-query';
import { IconSettings } from '@/components/icons';
import { ProfileView } from '@/components/profile/ProfileView';
import { IconButton, PullToRefresh } from '@/components/ui';
import { useLayout, usePageTitle } from '@/lib/hooks';
import { keys } from '@/lib/queries';
import { useAuth } from '@/providers/AuthProvider';

export default function MyProfilePage() {
  usePageTitle('Your profile');
  const { user } = useAuth();
  const { isWide } = useLayout();
  const queryClient = useQueryClient();
  if (!user) return null;
  return (
    <main>
      <PullToRefresh
        onRefresh={() =>
          Promise.all([
            queryClient.invalidateQueries({ queryKey: keys.profile(user.username) }),
            queryClient.invalidateQueries({ queryKey: ['userPosts'] }),
          ])
        }
      />
      <ProfileView
        handle={user.username}
        headerRight={
          !isWide ? <IconButton icon={IconSettings} label="Settings" background="rgba(255,255,255,0.82)" size={36} to="/settings" /> : null
        }
      />
    </main>
  );
}
