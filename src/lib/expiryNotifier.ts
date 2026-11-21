import { registerPlugin } from '@capacitor/core';

export interface NotifierItem {
  id: number;
  at: number;
  title: string;
  body: string;
  badge: string;
  chip: string;
  urgent: boolean;
  channel: string;
  productId?: string;
  /** Button labels for the notification: [used, snooze]. */
  actions?: { used: string; snooze: string };
}

export interface ExpiryNotifierPlugin {
  schedule(options: { items: NotifierItem[]; images?: Record<string, string> }): Promise<void>;
  cancelAll(): Promise<void>;
  showNow(item: NotifierItem): Promise<void>;
  /** Actions tapped inside notifications since the app last looked. */
  takeActions(): Promise<{ actions: { productId: string; action: 'used' | 'discarded' }[] }>;
  /** On-device text recognition (ML Kit) for a JPEG given as base64. */
  recognizeText(options: { image: string }): Promise<{ text: string }>;
}

/** Native Android plugin that draws the branded reminder card. */
export const ExpiryNotifier = registerPlugin<ExpiryNotifierPlugin>('ExpiryNotifier');
