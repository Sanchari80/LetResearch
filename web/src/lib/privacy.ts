import { colors } from '@/theme';
import type { PaperDownloadAccess, PaperViewAccess, Visibility, VisibilityField } from './types';

export const VISIBILITY_OPTIONS: { value: Visibility; label: string; description: string }[] = [
  { value: 'public', label: 'Public', description: 'Anyone on LetResearch and visitors to your profile link.' },
  { value: 'connections', label: 'Connections', description: 'Only researchers you are connected with.' },
  { value: 'private', label: 'Only me', description: 'Hidden from everyone else.' },
];

export const VIEW_ACCESS_OPTIONS: { value: PaperViewAccess; label: string; description: string }[] = [
  { value: 'public', label: 'Public', description: 'Anyone can see the title, abstract and details.' },
  { value: 'connections', label: 'Connections', description: 'Only your connections can open it. Others see a locked entry.' },
  { value: 'private', label: 'Only me', description: 'Hidden from your profile for everyone else.' },
];

export const DOWNLOAD_ACCESS_OPTIONS: { value: PaperDownloadAccess; label: string; description: string }[] = [
  { value: 'everyone', label: 'Everyone', description: 'Any signed-in researcher who can view it.' },
  { value: 'connections', label: 'Connections', description: 'Only your connections can download.' },
  { value: 'none', label: 'No one', description: 'Downloads are turned off.' },
  { value: 'paid', label: 'Paid access', description: 'Title and abstract stay free; full-text checkout is coming soon.' },
];

export function visibilityLabel(value: Visibility) {
  return VISIBILITY_OPTIONS.find((o) => o.value === value)?.label ?? 'Public';
}

export function downloadLabel(value: PaperDownloadAccess) {
  return DOWNLOAD_ACCESS_OPTIONS.find((o) => o.value === value)?.label ?? 'Everyone';
}

/** Tint for each privacy level: patina = public, steel = connections, graphite = only me. */
export function visibilityTone(value: Visibility | PaperDownloadAccess | string) {
  if (value === 'public' || value === 'everyone') return { fg: colors.accent, bg: colors.accentSoft };
  if (value === 'connections') return { fg: colors.steel, bg: colors.steelSoft };
  if (value === 'paid') return { fg: colors.accent, bg: colors.accentSoft };
  return { fg: colors.inkSoft, bg: '#E2E4E8' };
}

export const FIELD_LABELS: Record<VisibilityField, string> = {
  qualification: 'Qualification',
  institution: 'Institution',
  location: 'Location',
  bio: 'About',
  interests: 'Research interests',
  email: 'Email',
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Website',
  researchgate: 'ResearchGate',
  scholar: 'Google Scholar',
  orcid: 'ORCID',
  telegram: 'Telegram',
  twitter: 'X (Twitter)',
  connectionsList: 'Connections list',
};

export function audienceSentence(field: VisibilityField, value: Visibility) {
  const label = FIELD_LABELS[field];
  if (value === 'public') return `${label} is now public.`;
  if (value === 'connections') return `${label} is now visible to your connections.`;
  return `${label} is now visible only to you.`;
}
