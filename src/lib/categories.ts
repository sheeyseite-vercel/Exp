import { t, type TKey } from './i18n';
import type { Category } from './types';

export const CATEGORY_IDS: Category[] = ['dairy', 'meat', 'canned', 'bakery', 'other'];

export function categoryLabel(id: Category): string {
  return t(`cat_${id}` as TKey);
}

/** Icon used on a product tile. */
export function categoryIcon(id: Category): 'droplet' | 'snowflake' | 'cube' {
  if (id === 'dairy') return 'droplet';
  if (id === 'meat') return 'snowflake';
  return 'cube';
}
