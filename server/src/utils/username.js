import { User } from '../models/User.js';

export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;

export const RESERVED_USERNAMES = new Set([
  'admin',
  'api',
  'app',
  'settings',
  'login',
  'register',
  'welcome',
  'u',
  'chat',
  'post',
  'paper',
  'papers',
  'profile',
  'network',
  'messages',
  'notifications',
  'letresearch',
  'support',
  'help',
  'moderation',
]);

export function slugifyName(name) {
  return (
    String(name || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 22) || 'researcher'
  );
}

export async function generateUsername(name) {
  const base = slugifyName(name);
  if (!RESERVED_USERNAMES.has(base) && base.length >= 3 && !(await User.exists({ username: base }))) return base;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
