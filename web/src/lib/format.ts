const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Compact relative time: "now", "5m", "3h", "2d", "12 Oct", "12 Oct 2023". */
export function timeAgo(value?: string | Date | null) {
  if (!value) return '';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${sameYear ? '' : ` ${date.getFullYear()}`}`;
}

/** "Active 5 minutes ago" style text for chat headers. */
export function lastSeenText(value?: string | null) {
  if (!value) return 'Offline';
  const diff = Date.now() - new Date(value).getTime();
  if (diff < MINUTE) return 'Active just now';
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `Active ${m} minute${m === 1 ? '' : 's'} ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `Active ${h} hour${h === 1 ? '' : 's'} ago`;
  }
  const d = Math.floor(diff / DAY);
  if (d < 30) return `Active ${d} day${d === 1 ? '' : 's'} ago`;
  return 'Offline';
}

export function clockTime(value: string | Date) {
  const date = new Date(value);
  const h = date.getHours();
  const m = date.getMinutes();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Day label for chat separators: Today, Yesterday, Mon 12 Oct, 12 Oct 2023. */
export function dayLabel(value: string | Date) {
  const date = new Date(value);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(date)) / DAY);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function isSameDay(a: string | Date, b: string | Date) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function fileSize(bytes?: number | null) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

export function firstName(name?: string | null) {
  return (name || '').trim().split(/\s+/)[0] || 'this researcher';
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function compactNumber(n: number) {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
}

/** "Nature Communications, 2024" – citation style, no middle dots. */
export function citation(venue?: string | null, year?: number | null) {
  return [venue, year].filter(Boolean).join(', ');
}

export function fileKindLabel(mime?: string | null) {
  if (!mime) return 'File';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'Word';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('video/')) return 'Video';
  return 'File';
}

export function hostOf(url: string) {
  const match = url.match(/^https?:\/\/([^/?#]+)/i);
  return match ? match[1].replace(/^www\./, '') : '';
}

export function normalizeUrlInput(value: string) {
  const text = value.trim();
  if (!text) return '';
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

export function isLikelyUrl(value: string) {
  return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(value.trim());
}
