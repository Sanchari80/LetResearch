import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { MotionConfig } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useLocation, useNavigate } from 'react-router';
import { BootScreen, OfflineScreen } from '@/components/BootScreen';
import { AppShell, TAB_PATHS } from '@/components/layout/AppShell';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import { UpdateBanner } from '@/components/layout/UpdateBanner';
import { ConfirmHost, ToastHost } from '@/components/ui';
import { clearNext, peekNext, rememberNext, setNavigate } from '@/lib/nav';
import { persistOptions } from '@/lib/persist';
import { queryClient } from '@/lib/queries';
import ChatPage from '@/pages/Chat';
import ComposePage from '@/pages/Compose';
import ConnectionsPage from '@/pages/Connections';
import EditProfilePage from '@/pages/EditProfile';
import FeedPage from '@/pages/Feed';
import GuidelinesPage from '@/pages/Guidelines';
import LoginPage from '@/pages/Login';
import MessagesPage from '@/pages/Messages';
import ModerationPage from '@/pages/Moderation';
import MyProfilePage from '@/pages/MyProfile';
import NetworkPage from '@/pages/Network';
import NotFoundPage from '@/pages/NotFound';
import NotificationsPage from '@/pages/Notifications';
import PaperDetailPage from '@/pages/PaperDetail';
import PaperEditorPage from '@/pages/PaperEditor';
import PapersPage from '@/pages/Papers';
import PostDetailPage from '@/pages/PostDetail';
import PublicProfilePage from '@/pages/PublicProfile';
import RegisterPage from '@/pages/Register';
import SearchPage from '@/pages/Search';
import SettingsPage from '@/pages/Settings';
import WelcomePage from '@/pages/Welcome';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { RealtimeProvider } from '@/providers/RealtimeProvider';

/** Lets code outside components (socket events, actions) navigate with the router. */
function NavBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigate((to, options) => {
      if (typeof to === 'number') navigate(to);
      else navigate(to, options);
    });
  }, [navigate]);
  return null;
}

/** Gentle entrance for every page: main tabs fade, inner pages slide in. */
function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const tab = TAB_PATHS.includes(pathname);
  return (
    <div key={pathname} className={tab ? 'page-fade' : 'page-slide'}>
      {children}
    </div>
  );
}

function Root() {
  return (
    <>
      <NavBridge />
      <ScrollRestoration />
      <Outlet />
      <OfflineBanner />
      <ToastHost />
      <ConfirmHost />
    </>
  );
}

/** Welcome, sign in and register. Signed-in visitors go to the app. */
function AuthLayout() {
  const { status, slowServer, isNewUser } = useAuth();
  if (status === 'loading') return <BootScreen slow={slowServer} />;
  // New researchers are sent to profile setup by the register page itself.
  if (status === 'signedIn' && !isNewUser) return <Navigate to={peekNext() ?? '/'} replace />;
  return (
    <>
      <PageTransition>
        <Outlet />
      </PageTransition>
      <UpdateBanner />
    </>
  );
}

/** Everything inside requires a signed-in researcher. */
function AppLayout() {
  const { status, slowServer, retry } = useAuth();
  const location = useLocation();
  useEffect(() => {
    if (status === 'signedIn') clearNext();
  }, [status]);
  if (status === 'loading') return <BootScreen slow={slowServer} />;
  if (status === 'offline') return <OfflineScreen onRetry={retry} />;
  if (status === 'signedOut') {
    rememberNext(location.pathname + location.search);
    return <Navigate to="/welcome" replace />;
  }
  return (
    <AppShell>
      <PageTransition>
        <Outlet />
      </PageTransition>
    </AppShell>
  );
}

/** Shared links (profiles, posts, papers) open for everyone, signed in or not. */
function PublicLayout() {
  const { status } = useAuth();
  if (status === 'loading') return <BootScreen />;
  return (
    <AppShell>
      <PageTransition>
        <Outlet />
      </PageTransition>
    </AppShell>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/welcome', element: <WelcomePage /> },
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <FeedPage /> },
          { path: '/network', element: <NetworkPage /> },
          { path: '/messages', element: <MessagesPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/profile', element: <MyProfilePage /> },
          { path: '/chat/:id', element: <ChatPage /> },
          { path: '/compose', element: <ComposePage /> },
          { path: '/connections/:handle', element: <ConnectionsPage /> },
          { path: '/edit-profile', element: <EditProfilePage /> },
          { path: '/moderation', element: <ModerationPage /> },
          { path: '/paper-editor', element: <PaperEditorPage /> },
          { path: '/papers', element: <PapersPage /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
      {
        element: <PublicLayout />,
        children: [
          { path: '/u/:handle', element: <PublicProfilePage /> },
          { path: '/post/:id', element: <PostDetailPage /> },
          { path: '/paper/:id', element: <PaperDetailPage /> },
          { path: '/guidelines', element: <GuidelinesPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <RealtimeProvider>
            <RouterProvider router={router} />
          </RealtimeProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </MotionConfig>
  );
}
