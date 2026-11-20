import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { planNotifications } from './planner';
import type { Product, Settings } from './types';

export type PermissionState = 'granted' | 'denied' | 'unsupported';

export interface SyncResult {
  scheduled: number;
  permission: PermissionState;
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

  await LocalNotifications.createChannel({
    id: 'expiry',
    name: 'تنبيهات الصلاحية',
    importance: 4,
    visibility: 1,
    vibration: true,
  }).catch(() => undefined);

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
