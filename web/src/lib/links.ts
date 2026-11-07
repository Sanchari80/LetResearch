// Contact methods a researcher can add to their profile, and how each becomes a link.
import type { LinkField } from './types';

export interface ContactMethod {
  field: LinkField;
  label: string;
  placeholder: string;
  hint?: string;
  keyboard?: 'default' | 'email-address' | 'phone-pad' | 'url';
  /** Messaging apps are shown next to the Message button on profiles. */
  messaging?: boolean;
  toUrl: (value: string) => string | null;
  display: (value: string) => string;
}

const stripProtocol = (v: string) => v.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
const digits = (v: string) => v.replace(/[^\d]/g, '');
const asUrl = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);
const handle = (v: string) =>
  v
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/[^/]+\//i, '')
    .replace(/\/$/, '');

export const CONTACT_METHODS: ContactMethod[] = [
  {
    field: 'whatsapp',
    label: 'WhatsApp',
    placeholder: '+8801XXXXXXXXX',
    hint: 'Include the country code. Visitors can open a WhatsApp chat with you.',
    keyboard: 'phone-pad',
    messaging: true,
    toUrl: (v) => (digits(v).length >= 6 ? `https://wa.me/${digits(v)}` : null),
    display: (v) => v.trim(),
  },
  {
    field: 'linkedin',
    label: 'LinkedIn',
    placeholder: 'linkedin.com/in/your-name',
    keyboard: 'url',
    messaging: true,
    toUrl: (v) => (v.includes('linkedin.com') ? asUrl(v.trim()) : `https://www.linkedin.com/in/${handle(v)}`),
    display: (v) => stripProtocol(v).replace(/^linkedin\.com\/in\//i, ''),
  },
  {
    field: 'telegram',
    label: 'Telegram',
    placeholder: '@username',
    keyboard: 'default',
    messaging: true,
    toUrl: (v) => (handle(v) ? `https://t.me/${handle(v)}` : null),
    display: (v) => `@${handle(v)}`,
  },
  {
    field: 'email',
    label: 'Email',
    placeholder: 'you@university.edu',
    keyboard: 'email-address',
    messaging: true,
    toUrl: (v) => (v.includes('@') ? `mailto:${v.trim()}` : null),
    display: (v) => v.trim(),
  },
  {
    field: 'phone',
    label: 'Phone',
    placeholder: '+8801XXXXXXXXX',
    keyboard: 'phone-pad',
    toUrl: (v) => (digits(v).length >= 6 ? `tel:${v.replace(/[^\d+]/g, '')}` : null),
    display: (v) => v.trim(),
  },
  {
    field: 'github',
    label: 'GitHub',
    placeholder: 'github.com/username',
    keyboard: 'url',
    toUrl: (v) => (v.includes('github.com') ? asUrl(v.trim()) : `https://github.com/${handle(v)}`),
    display: (v) => stripProtocol(v).replace(/^github\.com\//i, ''),
  },
  {
    field: 'portfolio',
    label: 'Website',
    placeholder: 'your-lab.org',
    keyboard: 'url',
    toUrl: (v) => asUrl(v.trim()),
    display: (v) => stripProtocol(v),
  },
  {
    field: 'scholar',
    label: 'Google Scholar',
    placeholder: 'scholar.google.com/citations?user=…',
    keyboard: 'url',
    toUrl: (v) => asUrl(v.trim()),
    display: () => 'Scholar profile',
  },
  {
    field: 'researchgate',
    label: 'ResearchGate',
    placeholder: 'researchgate.net/profile/Your-Name',
    keyboard: 'url',
    toUrl: (v) => asUrl(v.trim()),
    display: (v) => stripProtocol(v).replace(/^researchgate\.net\/profile\//i, ''),
  },
  {
    field: 'orcid',
    label: 'ORCID',
    placeholder: '0000-0000-0000-0000',
    keyboard: 'default',
    toUrl: (v) => {
      const id = v.match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/i)?.[0];
      return id ? `https://orcid.org/${id}` : v.includes('orcid.org') ? asUrl(v.trim()) : null;
    },
    display: (v) => v.match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/i)?.[0] ?? stripProtocol(v),
  },
  {
    field: 'twitter',
    label: 'X (Twitter)',
    placeholder: '@username',
    keyboard: 'default',
    toUrl: (v) => (handle(v) ? `https://x.com/${handle(v)}` : null),
    display: (v) => `@${handle(v)}`,
  },
];

export const CONTACT_BY_FIELD = Object.fromEntries(CONTACT_METHODS.map((m) => [m.field, m])) as Record<LinkField, ContactMethod>;
