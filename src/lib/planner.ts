import { daysPhrase, formatDay, parseISO } from './dates';
import { t } from './i18n';
import type { Product, Settings } from './types';

export interface PlannedNotification {
  id: number;
  at: Date;
  title: string;
  body: string;
  /** Big number shown on the notification badge ('!' on the expiry day). */
  badge: string;
  /** Short label, e.g. "Tomorrow". */
  chip: string;
  urgent: boolean;
  productId: string;
}

const MAX_SCHEDULED = 300;

export function notificationBody(name: string, daysBefore: number, expiryISO: string, quantity = 1): string {
  const label = quantity > 1 ? `${name} ×${quantity}` : name;
  if (daysBefore === 0) return t('notif_today', { name: label });
  if (daysBefore === 1) return t('notif_tomorrow', { name: label });
  return t('notif_in', { name: label, days: daysPhrase(daysBefore), date: formatDay(expiryISO) });
}

export function reminderCard(daysBefore: number): { badge: string; chip: string; urgent: boolean } {
  if (daysBefore === 0) return { badge: '!', chip: t('chip_today'), urgent: true };
  if (daysBefore === 1) return { badge: '1', chip: t('chip_tomorrow'), urgent: true };
  return { badge: String(daysBefore), chip: daysPhrase(daysBefore), urgent: false };
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
        title: t('app_name'),
        body: notificationBody(product.name, daysBefore, product.expiry_date, product.quantity),
        ...reminderCard(daysBefore),
        productId: product.id,
      });
    }
  }

  planned.sort((a, b) => a.at.getTime() - b.at.getTime());
  return planned.slice(0, MAX_SCHEDULED).map((item, index) => ({ ...item, id: index + 1 }));
}
