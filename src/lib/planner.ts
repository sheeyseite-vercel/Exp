import { daysPhrase, formatDay, parseISO } from './dates';
import type { Product, Settings } from './types';

export interface PlannedNotification {
  id: number;
  at: Date;
  title: string;
  body: string;
  productId: string;
}

const MAX_SCHEDULED = 300;

export function notificationBody(name: string, daysBefore: number, expiryISO: string): string {
  if (daysBefore === 0) return `${name}: تنتهي صلاحيته اليوم.`;
  if (daysBefore === 1) return `${name}: تنتهي صلاحيته غدًا.`;
  return `${name}: تنتهي صلاحيته بعد ${daysPhrase(daysBefore)}، يوم ${formatDay(expiryISO)}.`;
}

export function parseTime(value: string): { hours: number; minutes: number } {
  const [h, m] = value.split(':').map(Number);
  return { hours: Number.isFinite(h) ? h : 9, minutes: Number.isFinite(m) ? m : 0 };
}

/** Works out which notifications should exist. Pure: no device access. */
export function planNotifications(
  products: Product[],
  settings: Settings,
  now: Date = new Date(),
): PlannedNotification[] {
  if (!settings.notifications_enabled) return [];
  const { hours, minutes } = parseTime(settings.notify_time);
  const planned: Omit<PlannedNotification, 'id'>[] = [];

  for (const product of products) {
    if (product.consumed_at) continue;
    const days = new Set(product.remind_days ?? settings.default_remind_days);
    const { y, m, d } = parseISO(product.expiry_date);
    for (const daysBefore of days) {
      const at = new Date(y, m - 1, d - daysBefore, hours, minutes, 0);
      if (at.getTime() <= now.getTime()) continue;
      planned.push({
        at,
        title: 'صلاحيتي',
        body: notificationBody(product.name, daysBefore, product.expiry_date),
        productId: product.id,
      });
    }
  }

  planned.sort((a, b) => a.at.getTime() - b.at.getTime());
  return planned.slice(0, MAX_SCHEDULED).map((item, index) => ({ ...item, id: index + 1 }));
}

/** Short text such as "قبل 7 و3 أيام" for the active rules. */
export function describeRules(settings: Settings): string {
  if (!settings.notifications_enabled) return 'التنبيهات متوقفة';
  const unique = [...new Set(settings.default_remind_days)];
  const before = unique.filter((d) => d > 0).sort((a, b) => b - a);
  const onDay = unique.includes(0);
  if (before.length === 0) return onDay ? 'يوم الانتهاء فقط' : 'لا توجد قواعد مفعّلة';
  const text = before.length === 1 ? `قبل ${daysPhrase(before[0])}` : `قبل ${before.join(' و')} أيام`;
  return onDay ? `${text} ويوم الانتهاء` : text;
}
