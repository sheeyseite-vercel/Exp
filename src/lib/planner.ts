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
  /** Empty for digests that cover several products. */
  productId: string;
  kind: 'product' | 'daily' | 'weekly';
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

const WEEKS_AHEAD = 8;

function listNames(names: string[]): string {
  const shown = names.slice(0, 3).join('، ');
  return names.length > 3 ? `${shown} …` : shown;
}

/** Works out which notifications should exist. Pure: no device access. */
export function planNotifications(
  products: Product[],
  settings: Settings,
  now: Date = new Date(),
): PlannedNotification[] {
  if (!settings.notifications_enabled) return [];
  const { hours, minutes } = parseTime(settings.notify_time);
  const active = products.filter((p) => !p.consumed_at);
  const single: (Omit<PlannedNotification, 'id'> & { name: string })[] = [];

  for (const product of active) {
    const days = new Set(product.remind_days ?? settings.default_remind_days);
    const { y, m, d } = parseISO(product.expiry_date);
    for (const daysBefore of days) {
      const at = new Date(y, m - 1, d - daysBefore, hours, minutes, 0);
      if (at.getTime() <= now.getTime()) continue;
      single.push({
        at,
        title: t('app_name'),
        body: notificationBody(product.name, daysBefore, product.expiry_date, product.quantity),
        ...reminderCard(daysBefore),
        productId: product.id,
        kind: 'product',
        name: product.name,
      });
    }
  }

  let planned: Omit<PlannedNotification, 'id'>[] = single;

  if (settings.daily_digest) {
    const groups = new Map<number, typeof single>();
    for (const item of single) {
      const key = item.at.getTime();
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    planned = [];
    for (const group of groups.values()) {
      if (group.length === 1) {
        planned.push(group[0]);
        continue;
      }
      const names = [...new Set(group.map((g) => g.name))];
      planned.push({
        at: group[0].at,
        title: t('app_name'),
        body: t('notif_daily', { n: names.length, names: listNames(names) }),
        badge: String(names.length),
        chip: t('chip_digest'),
        urgent: group.some((g) => g.urgent),
        productId: '',
        kind: 'daily',
      });
    }
  }

  if (settings.weekly_digest) {
    const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    first.setDate(first.getDate() + ((settings.weekly_day - first.getDay() + 7) % 7));
    for (let week = 0; week < WEEKS_AHEAD; week++) {
      const at = new Date(first.getFullYear(), first.getMonth(), first.getDate() + week * 7, hours, minutes, 0);
      if (at.getTime() <= now.getTime()) continue;
      const start = new Date(at.getFullYear(), at.getMonth(), at.getDate());
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
      const due = active.filter((p) => {
        const { y, m, d } = parseISO(p.expiry_date);
        const exp = new Date(y, m - 1, d);
        return exp >= start && exp < end;
      });
      if (due.length === 0) continue;
      const names = [...new Set(due.map((p) => p.name))];
      planned.push({
        at,
        title: t('app_name'),
        body: t('notif_weekly', { n: due.length, names: listNames(names) }),
        badge: String(due.length),
        chip: t('chip_digest'),
        urgent: false,
        productId: '',
        kind: 'weekly',
      });
    }
  }

  planned.sort((a, b) => a.at.getTime() - b.at.getTime());
  return planned.slice(0, MAX_SCHEDULED).map((item, index) => {
    const { name: _name, ...rest } = item as typeof item & { name?: string };
    void _name;
    return { ...rest, id: index + 1 };
  });
}
