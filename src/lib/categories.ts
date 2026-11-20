import type { Category } from './types';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'dairy', label: 'ألبان' },
  { id: 'meat', label: 'لحوم' },
  { id: 'canned', label: 'معلّبات' },
  { id: 'bakery', label: 'مخبوزات' },
  { id: 'other', label: 'أخرى' },
];

export function categoryLabel(id: Category): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? 'أخرى';
}

/** Icon used on a product tile. */
export function categoryIcon(id: Category): 'droplet' | 'snowflake' | 'cube' {
  if (id === 'dairy') return 'droplet';
  if (id === 'meat') return 'snowflake';
  return 'cube';
}
