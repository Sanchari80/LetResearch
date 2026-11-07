import { motion } from 'motion/react';
import type { ComponentType, ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { PUBLISHER } from '@/lib/config';
import { feedback } from '@/lib/feedback';
import { useLayout } from '@/lib/hooks';
import { useAuth } from '@/providers/AuthProvider';
import { useRealtime } from '@/store/realtime';
import { IconBell, IconHouse, IconLogOut, IconMessageCircle, IconPlus, IconSettings, IconUsers, type IconProps } from '../icons';
import { Avatar, Button, confirm, CountBadge, Logo } from '../ui';
import { UpdateBanner } from './UpdateBanner';
import styles from './AppShell.module.css';

interface TabDef {
  to: string;
  label: string;
  wideLabel?: string;
  icon?: ComponentType<IconProps>;
  badge: 'network' | 'messages' | 'notifications' | null;
}

const TABS: TabDef[] = [
  { to: '/', label: 'Feed', icon: IconHouse, badge: null },
  { to: '/network', label: 'Network', icon: IconUsers, badge: 'network' },
  { to: '/messages', label: 'Messages', icon: IconMessageCircle, badge: 'messages' },
  { to: '/notifications', label: 'Alerts', wideLabel: 'Notifications', icon: IconBell, badge: 'notifications' },
  { to: '/profile', label: 'Profile', badge: null },
];

export const TAB_PATHS = TABS.map((t) => t.to);

function useBadges() {
  const counts = useRealtime((s) => s.counts);
  return {
    network: counts.connectionRequests,
    messages: counts.messages + counts.messageRequests,
    notifications: counts.notifications,
  };
}

function useActiveTab() {
  const { pathname } = useLocation();
  return TABS.find((t) => (t.to === '/' ? pathname === '/' : pathname === t.to || pathname.startsWith(`${t.to}/`)))?.to ?? null;
}

/** Tapping the tab you are already on scrolls back to the top. */
function onTabClick(active: boolean) {
  if (active) window.scrollTo({ top: 0, behavior: 'smooth' });
  else feedback.select();
}

function ProfileIcon({ size, active }: { size: number; active: boolean }) {
  const { user } = useAuth();
  return (
    <span className={`${styles.profileRing} ${active ? styles.profileRingActive : ''}`}>
      <Avatar name={user?.name} url={user?.avatarUrl} size={size} />
    </span>
  );
}

function BottomBar() {
  const badges = useBadges();
  const active = useActiveTab();
  return (
    <nav className={styles.bottom} aria-label="Main">
      {TABS.map((tab) => {
        const selected = active === tab.to;
        const badge = tab.badge ? badges[tab.badge] : 0;
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={`${styles.bottomItem} ${selected ? styles.bottomActive : ''}`}
            aria-label={badge ? `${tab.label}, ${badge} new` : tab.label}
            onClick={() => onTabClick(selected)}
          >
            <span className={styles.bottomIconWrap}>
              {selected ? (
                <motion.span
                  layoutId="bottom-indicator"
                  className={styles.bottomIndicator}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span key={selected ? 'on' : 'off'} className={`${styles.bottomIcon} ${selected ? styles.iconPop : ''}`}>
                {Icon ? <Icon size={23} strokeWidth={selected ? 2.2 : 1.8} aria-hidden /> : <ProfileIcon size={21} active={selected} />}
              </span>
              {badge ? (
                <span className={styles.bottomBadge}>
                  <CountBadge count={badge} />
                </span>
              ) : null}
            </span>
            <span className={styles.bottomLabel}>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function Sidebar() {
  const { signOut } = useAuth();
  const badges = useBadges();
  const active = useActiveTab();
  return (
    <aside className={styles.sidebar}>
      <Link to="/" className={styles.brand} aria-label="LetResearch home">
        <Logo size={30} />
      </Link>
      <Button label="New post" icon={IconPlus} to="/compose" style={{ marginBottom: 22 }} />
      <nav aria-label="Main" className={styles.sideNav}>
        {TABS.map((tab) => {
          const selected = active === tab.to;
          const badge = tab.badge ? badges[tab.badge] : 0;
          const label = tab.wideLabel ?? tab.label;
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={`${styles.sideItem} ${selected ? styles.sideActive : ''}`}
              aria-label={badge ? `${label}, ${badge} new` : label}
              onClick={() => onTabClick(selected)}
            >
              {selected ? (
                <motion.span
                  layoutId="side-indicator"
                  className={styles.sideIndicator}
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                />
              ) : null}
              <span className={styles.sideIcon}>
                {Icon ? <Icon size={21} strokeWidth={selected ? 2.2 : 1.8} aria-hidden /> : <ProfileIcon size={22} active={selected} />}
              </span>
              <span className={styles.sideLabel}>{label}</span>
              <CountBadge count={badge} />
            </NavLink>
          );
        })}
      </nav>
      <div className="grow" />
      <NavLink to="/settings" className={({ isActive }) => `${styles.sideItem} ${isActive ? styles.sideActiveStatic : ''}`}>
        <span className={styles.sideIcon}>
          <IconSettings size={21} strokeWidth={1.8} aria-hidden />
        </span>
        <span className={styles.sideLabel}>Settings</span>
      </NavLink>
      <button
        type="button"
        className={`${styles.sideItem} ${styles.signOut}`}
        onClick={async () => {
          feedback.tap();
          const ok = await confirm({ title: 'Sign out of LetResearch?', confirmLabel: 'Sign out', destructive: true });
          if (ok) void signOut();
        }}
      >
        <span className={styles.sideIcon}>
          <IconLogOut size={21} strokeWidth={1.8} aria-hidden />
        </span>
        <span className={styles.sideLabel}>Sign out</span>
      </button>
      <p className={`t-caption ${styles.publisher}`}>Published by {PUBLISHER}</p>
    </aside>
  );
}

/**
 * Signed-in frame: a sidebar on tablets and computers, a bottom tab bar on phones (shown on
 * the five main pages; inner pages use the full screen with a back button).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { isWide } = useLayout();
  const { status } = useAuth();
  const active = useActiveTab();
  const signedIn = status === 'signedIn';
  const withSidebar = signedIn && isWide;
  const withBottomBar = signedIn && !isWide && !!active;
  return (
    <div className={styles.shell} data-sidebar={withSidebar ? '' : undefined} data-tabbar={withBottomBar ? '' : undefined}>
      {withSidebar ? <Sidebar /> : null}
      <div className={styles.main}>{children}</div>
      {withBottomBar ? <BottomBar /> : null}
      <UpdateBanner />
    </div>
  );
}
