import type { ComponentType } from 'react';
import { feedback } from '@/lib/feedback';
import { CONTACT_METHODS } from '@/lib/links';
import type { LinkField, Profile, Visibility } from '@/lib/types';
import { colors } from '@/theme';
import {
  IconAtSign,
  IconBookOpen,
  IconBriefcase,
  IconCode,
  IconFlaskConical,
  IconGlobe,
  IconIdCard,
  IconMail,
  IconMessageCircle,
  IconPhone,
  IconSend,
  type IconProps,
} from '../icons';
import { PrivacyPill } from '../privacy/PrivacyControls';
import styles from './ContactLinks.module.css';

/** Generic, label-first icons keep the silver UI calm and avoid third-party logos. */
export const CONTACT_ICONS: Record<LinkField, ComponentType<IconProps>> = {
  whatsapp: IconMessageCircle,
  linkedin: IconBriefcase,
  telegram: IconSend,
  email: IconMail,
  phone: IconPhone,
  github: IconCode,
  portfolio: IconGlobe,
  scholar: IconBookOpen,
  researchgate: IconFlaskConical,
  orcid: IconIdCard,
  twitter: IconAtSign,
};

function linkProps(url: string) {
  const external = /^https?:/i.test(url);
  return external ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : { href: url };
}

/** Compact chips shown under the profile actions – messaging apps first. */
export function ContactChips({ links }: { links: Profile['links'] }) {
  const entries = CONTACT_METHODS.filter((m) => links[m.field]);
  if (!entries.length) return null;
  return (
    <div className={styles.chips}>
      {entries.map((method, i) => {
        const Icon = CONTACT_ICONS[method.field];
        const value = links[method.field]!;
        const url = method.toUrl(value);
        if (!url) return null;
        return (
          <a
            key={method.field}
            {...linkProps(url)}
            className={`${styles.chip} ${method.messaging ? styles.chipMessaging : ''}`}
            style={{ animationDelay: `${i * 40}ms` }}
            aria-label={`${method.label}: ${method.display(value)}`}
            onClick={() => feedback.tap()}
          >
            <Icon size={15} strokeWidth={2} aria-hidden />
            <span>{method.label}</span>
          </a>
        );
      })}
    </div>
  );
}

/** Detailed contact list for the About tab. Owners get a privacy pill on every row. */
export function ContactList({
  links,
  visibility,
  onVisibilityChange,
}: {
  links: Profile['links'];
  visibility?: Profile['visibility'];
  onVisibilityChange?: (field: LinkField, value: Visibility) => void;
}) {
  const entries = CONTACT_METHODS.filter((m) => links[m.field]);
  if (!entries.length) return null;
  return (
    <ul className={styles.list}>
      {entries.map((method) => {
        const Icon = CONTACT_ICONS[method.field];
        const value = links[method.field]!;
        const url = method.toUrl(value);
        const inner = (
          <>
            <span className={styles.rowIcon}>
              <Icon size={17} color={colors.inkSoft} aria-hidden />
            </span>
            <span className="col grow">
              <span className="t-caption">{method.label}</span>
              <span className="t-body nowrap">{method.display(value)}</span>
            </span>
          </>
        );
        return (
          <li key={method.field} className={styles.row}>
            {url ? (
              <a {...linkProps(url)} className={styles.rowMain} onClick={() => feedback.tap()}>
                {inner}
              </a>
            ) : (
              <span className={styles.rowMain}>{inner}</span>
            )}
            {visibility && onVisibilityChange ? (
              <PrivacyPill field={method.field} value={visibility[method.field]} onChange={(v) => onVisibilityChange(method.field, v)} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
