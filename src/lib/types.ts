/** One of the built-in ids, or any name the person typed. */
export type Category = string;

export type Location = 'fridge' | 'freezer' | 'pantry' | 'other';
export const LOCATIONS: Location[] = ['fridge', 'freezer', 'pantry', 'other'];
export type Outcome = 'used' | 'discarded';

export type Unit = 'box' | 'half' | 'piece';

export interface ShoppingItem {
  id: string;
  name: string;
  done: boolean;
  created_at: string;
  qty: number;
  unit: Unit;
  brand: string | null;
  photo_path: string | null;
}

export interface CatCategory {
  id: string;
  name: string;
  photo_path: string | null;
}

export interface CatProduct {
  id: string;
  category_id: string;
  name: string;
  brand: string | null;
  photo_path: string | null;
}

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
  location: Location;
  outcome: Outcome | null;
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
  location: Location;
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
  /** One combined notification per day instead of one per product. */
  daily_digest: boolean;
  /** Weekly summary of what expires in the coming week. */
  weekly_digest: boolean;
  /** 0 = Sunday … 6 = Saturday */
  weekly_day: number;
}

export const DEFAULT_SETTINGS: Settings = {
  notifications_enabled: true,
  default_remind_days: [7, 1, 0],
  custom_days: 14,
  notify_time: '09:00',
  auto_delete_expired: false,
  daily_digest: false,
  weekly_digest: false,
  weekly_day: 0,
};
