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
}

export interface ExpiryNotifierPlugin {
  schedule(options: { items: NotifierItem[]; images?: Record<string, string> }): Promise<void>;
  cancelAll(): Promise<void>;
  showNow(item: NotifierItem): Promise<void>;
}

/** Native Android plugin that draws the branded reminder card. */
export const ExpiryNotifier = registerPlugin<ExpiryNotifierPlugin>('ExpiryNotifier');
