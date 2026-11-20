// Date helpers. Dates are handled as ISO strings (yyyy-mm-dd) in the user's local calendar.

const MONTHS = [
  'جانفي',
  'فيفري',
  'مارس',
  'أفريل',
  'ماي',
  'جوان',
  'جويلية',
  'أوت',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

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
  if (days < 0) return 'منتهٍ';
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غدًا';
  if (days === 2) return 'يومان';
  if (days <= 10) return `${days} أيام`;
  return `${days} يومًا`;
}

/** "3 أيام" style count used inside sentences. */
export function daysPhrase(n: number): string {
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومين';
  if (n <= 10) return `${n} أيام`;
  return `${n} يومًا`;
}

export function formatDay(iso: string): string {
  const { m, d } = parseISO(iso);
  return `${d} ${MONTHS[m - 1]}`;
}

export function formatFull(iso: string): string {
  const { y } = parseISO(iso);
  return `${formatDay(iso)} ${y}`;
}

export function formatToday(now: Date = new Date()): string {
  return `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

/** Secondary line under a product name. */
export function expiryLine(iso: string, days: number): string {
  return days < 0 ? `انتهى ${formatDay(iso)}` : `ينتهي ${formatDay(iso)}`;
}

/** Share of the shelf life that has already passed (0-100), measured from the day the product was added. */
export function shelfProgress(addedISO: string, expiryISO: string, now: Date = new Date()): number {
  const total = daysUntil(expiryISO, new Date(parseISO(addedISO).y, parseISO(addedISO).m - 1, parseISO(addedISO).d));
  if (total <= 0) return 100;
  const left = daysUntil(expiryISO, now);
  const elapsed = total - left;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}
