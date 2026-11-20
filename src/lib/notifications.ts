import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { t } from './i18n';
import { notificationBody, planNotifications } from './planner';
import { addDays, toISO } from './dates';
import type { Product, Settings } from './types';

export type PermissionState = 'granted' | 'denied' | 'unsupported';

export interface SyncResult {
  scheduled: number;
  permission: PermissionState;
}

async function ensureChannel(): Promise<void> {
  await LocalNotifications.createChannel({
    id: 'expiry',
    name: t('notif_channel'),
    importance: 4,
    visibility: 1,
    vibration: true,
  }).catch(() => undefined);
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
  await ensureChannel();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 2_000_000_000,
        title: t('app_name'),
        body: notificationBody(t('test_sample'), 3, addDays(toISO(new Date()), 3), 12),
        channelId: 'expiry',
        // No schedule: the notification is shown immediately.
      },
    ],
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
    const current = await LocalNotifications.checkPermissions();
    return { scheduled: 0, permission: current.display === 'denied' ? 'denied' : 'granted' };
  }

  let permission = await LocalNotifications.checkPermissions();
  if (permission.display === 'prompt' || permission.display === 'prompt-with-rationale') {
    permission = await LocalNotifications.requestPermissions();
  }
  if (permission.display !== 'granted') return { scheduled: 0, permission: 'denied' };

  await ensureChannel();

  await LocalNotifications.schedule({
    notifications: plan.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      channelId: 'expiry',
      schedule: { at: item.at, allowWhileIdle: true },
      extra: { productId: item.productId },
    })),
  });
  return { scheduled: plan.length, permission: 'granted' };
}
