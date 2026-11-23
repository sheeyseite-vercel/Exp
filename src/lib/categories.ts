import { getLang, t, type Lang, type TKey } from './i18n';
import type { Category } from './types';

export const CATEGORY_IDS: Category[] = ['dairy', 'meat', 'canned', 'bakery', 'other'];

// The same category in every language, so a name typed in English reads in Arabic after switching language.
const GROUPS: Record<Lang, string>[] = [
  { ar: 'الكوكيز', fr: 'Biscuits', en: 'Cookies' },
  { ar: 'الألبان', fr: 'Produits laitiers', en: 'Dairy' },
  { ar: 'مواد التنظيف', fr: 'Produits ménagers', en: 'Cleaning supplies' },
  { ar: 'المشروبات', fr: 'Boissons', en: 'Drinks' },
  { ar: 'المعلّبات', fr: 'Conserves', en: 'Canned food' },
  { ar: 'الخضر والفواكه', fr: 'Fruits et légumes', en: 'Fruit & vegetables' },
  { ar: 'الحلويات', fr: 'Sucreries', en: 'Sweets' },
  { ar: 'اللحوم', fr: 'Viandes', en: 'Meat' },
  { ar: 'المخبوزات', fr: 'Boulangerie', en: 'Bakery' },
  { ar: 'القهوة والشاي', fr: 'Café et thé', en: 'Coffee & tea' },
  { ar: 'الأجبان', fr: 'Fromages', en: 'Cheese' },
  { ar: 'الزيوت', fr: 'Huiles', en: 'Oils' },
  { ar: 'المعجنات', fr: 'Pâtes', en: 'Pasta' },
  { ar: 'الأرز والحبوب', fr: 'Riz et céréales', en: 'Rice & grains' },
  { ar: 'التوابل', fr: 'Épices', en: 'Spices' },
  { ar: 'العصائر', fr: 'Jus', en: 'Juices' },
  { ar: 'المياه', fr: 'Eaux', en: 'Water' },
  { ar: 'الأدوات المنزلية', fr: 'Articles ménagers', en: 'Household' },
  { ar: 'مستحضرات التجميل', fr: 'Cosmétiques', en: 'Cosmetics' },
  { ar: 'النظافة الشخصية', fr: 'Hygiène', en: 'Personal care' },
  { ar: 'الأطفال', fr: 'Bébé', en: 'Baby' },
  { ar: 'المجمدات', fr: 'Surgelés', en: 'Frozen' },
  { ar: 'الشوكولاطة', fr: 'Chocolat', en: 'Chocolate' },
  { ar: 'الشيبس والمقرمشات', fr: 'Chips et snacks', en: 'Snacks' },
  { ar: 'الأخرى', fr: 'Autres', en: 'Other' },
];

function key(text: string): string {
  return text.trim().toLowerCase().replace(/[ً-ٟـ]/g, '').replace(/^ال/, '');
}

const INDEX = new Map<string, Record<Lang, string>>();
for (const group of GROUPS) for (const name of Object.values(group)) INDEX.set(key(name), group);

/** A category name shown in the current language when it is a known one; any other name is shown as typed. */
export function catName(name: string): string {
  const group = INDEX.get(key(name));
  return group ? group[getLang()] : name;
}

export function categoryLabel(id: Category): string {
  return CATEGORY_IDS.includes(id) ? t(`cat_${id}` as TKey) : catName(id);
}

/** Icon used on a product tile. */
export function categoryIcon(id: Category): 'droplet' | 'snowflake' | 'cube' {
  if (id === 'dairy') return 'droplet';
  if (id === 'meat') return 'snowflake';
  return 'cube';
}
