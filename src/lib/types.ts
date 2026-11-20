export type Category = 'dairy' | 'meat' | 'canned' | 'bakery' | 'other';

export interface Product {
  id: string;
  user_id: string;
  name: string;
  category: Category;
  /** ISO date, yyyy-mm-dd */
  expiry_date: string;
  quantity: number;
  photo_path: string | null;
  barcode: string | null;
  /** Days before expiry to notify (0 = on the expiry day). null = use the user's default rules. */
  remind_days: number[] | null;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  category: Category;
  expiry_date: string;
  quantity: number;
  barcode: string | null;
  remind_days: number[] | null;
  photo_path?: string | null;
}

export interface Settings {
  user_id?: string;
  notifications_enabled: boolean;
  default_remind_days: number[];
  custom_days: number;
  /** HH:MM or HH:MM:SS */
  notify_time: string;
  auto_delete_expired: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  notifications_enabled: true,
  default_remind_days: [7, 1, 0],
  custom_days: 14,
  notify_time: '09:00',
  auto_delete_expired: false,
};
