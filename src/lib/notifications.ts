import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { t } from './i18n';
import { notificationBody, planNotifications, reminderCard } from './planner';
import { ExpiryNotifier } from './expiryNotifier';
import { notificationThumb } from './notifThumb';
import { addDays, toISO } from './dates';
import type { Product, Settings } from './types';

export type PermissionState = 'granted' | 'denied' | 'unsupported';

export interface SyncResult {
  scheduled: number;
  permission: PermissionState;
}

export type TestResult = 'sent' | 'denied' | 'unsupported';

/** Sends a sample notification a moment from now so the person can see how reminders look. */
export async function sendTestNotification(): Promise<TestResult> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display === 'prompt' || permission.display === 'prompt-with-rationale') {
    permission = await LocalNotifications.requestPermissions();
  }
  if (permission.display !== 'granted') return 'denied';
  await ExpiryNotifier.showNow({
    id: 2_000_000_000,
    at: 0,
    title: t('app_name'),
    body: notificationBody(t('test_sample'), 3, addDays(toISO(new Date()), 3), 12),
    ...reminderCard(3),
    channel: t('notif_channel'),
  });
  return 'sent';
}

export type ExactAlarmState = 'granted' | 'denied' | 'unsupported';

/** Android 12+ only delivers reminders on time when the app may use exact alarms. */
export async function exactAlarmState(): Promise<ExactAlarmState> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return 'unsupported';
  try {
    const result = await LocalNotifications.checkExactNotificationSetting();
    return result.exact_alarm === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function openExactAlarmSettings(): Promise<void> {
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } catch {
    /* settings screen unavailable */
  }
}

/** Replaces every pending reminder on the device with the current plan. */
export async function syncNotifications(products: Product[], settings: Settings): Promise<SyncResult> {
  if (!Capacitor.isNativePlatform()) return { scheduled: 0, permission: 'unsupported' };

  const plan = planNotifications(products, settings);

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  if (plan.length === 0) {
    await ExpiryNotifier.cancelAll().catch(() => undefined);
    const current = await LocalNotifications.checkPermissions();
    return { scheduled: 0, permission: current.display === 'denied' ? 'denied' : 'granted' };
  }

  let permission = await LocalNotifications.checkPermissions();
  if (permission.display === 'prompt' || permission.display === 'prompt-with-rationale') {
    permission = await LocalNotifications.requestPermissions();
  }
  if (permission.display !== 'granted') return { scheduled: 0, permission: 'denied' };

  const images: Record<string, string> = {};
  const withPhoto = products.filter((p) => p.photo_path && plan.some((item) => item.productId === p.id));
  await Promise.all(
    withPhoto.map(async (p) => {
      const thumb = await notificationThumb(p.photo_path as string);
      if (thumb) images[p.id] = thumb;
    }),
  );

  await ExpiryNotifier.schedule({
    images,
    items: plan.map((item) => ({
      id: item.id,
      at: item.at.getTime(),
      title: item.title,
      body: item.body,
      badge: item.badge,
      chip: item.chip,
      urgent: item.urgent,
      channel: t('notif_channel'),
      productId: item.productId,
      actions: item.productId ? { used: t('act_used'), snooze: t('act_snooze') } : undefined,
    })),
  });
  return { scheduled: plan.length, permission: 'granted' };
}

/** Actions the person tapped inside notifications while the app was closed. */
export async function takeNotifierActions(): Promise<{ productId: string; action: 'used' | 'discarded' }[]> {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    return (await ExpiryNotifier.takeActions()).actions;
  } catch {
    return [];
  }
}
