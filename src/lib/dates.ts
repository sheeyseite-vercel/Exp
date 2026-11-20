// Date helpers. Dates are handled as ISO strings (yyyy-mm-dd) in the user's local calendar.
import { getLang, MONTHS, t, WEEKDAYS } from './i18n';

export type Status = 'expired' | 'urgent' | 'soon' | 'fresh';

export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isValidISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const { y, m, d } = parseISO(iso);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso);
  return toISO(new Date(y, m - 1, d + n));
}

/** Whole calendar days from today until the given date (negative = already past). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const { y, m, d } = parseISO(iso);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function statusOf(days: number): Status {
  if (days < 0) return 'expired';
  if (days <= 2) return 'urgent';
  if (days <= 7) return 'soon';
  return 'fresh';
}

/** Short label shown in a status chip. */
export function chipLabel(days: number): string {
  if (days < 0) return t('chip_expired');
  if (days === 0) return t('chip_today');
  if (days === 1) return t('chip_tomorrow');
  if (days === 2) return t('chip_two');
  return daysPhrase(days);
}

/** "3 days" style count used inside sentences. */
export function daysPhrase(n: number): string {
  if (n === 1) return t('day_one');
  if (n === 2) return t('day_two');
  if (n <= 10) return t('days_few', { n });
  return t('days_many', { n });
}

export function formatDay(iso: string): string {
  const { m, d } = parseISO(iso);
  const month = MONTHS[getLang()][m - 1];
  return getLang() === 'en' ? `${month} ${d}` : `${d} ${month}`;
}

export function formatFull(iso: string): string {
  const { y } = parseISO(iso);
  return getLang() === 'en' ? `${formatDay(iso)}, ${y}` : `${formatDay(iso)} ${y}`;
}

export function formatToday(now: Date = new Date()): string {
  const lang = getLang();
  const weekday = WEEKDAYS[lang][now.getDay()];
  const month = MONTHS[lang][now.getMonth()];
  return lang === 'en' ? `${weekday}, ${month} ${now.getDate()}` : `${weekday} ${now.getDate()} ${month}`;
}

/** Secondary line under a product name. */
export function expiryLine(iso: string, days: number): string {
  return days < 0 ? t('expiry_ended', { date: formatDay(iso) }) : t('expiry_ends', { date: formatDay(iso) });
}

/** Share of the shelf life that has already passed (0-100), measured from the day the product was added. */
export function shelfProgress(addedISO: string, expiryISO: string, now: Date = new Date()): number {
  const total = daysUntil(expiryISO, new Date(parseISO(addedISO).y, parseISO(addedISO).m - 1, parseISO(addedISO).d));
  if (total <= 0) return 100;
  const left = daysUntil(expiryISO, now);
  const elapsed = total - left;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}
