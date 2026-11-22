import { getLang } from './i18n';
import type { Category } from './types';

export interface FoodInfo {
  name: string;
  category: Category;
}

function categoryFromTags(tags: string[]): Category {
  const joined = tags.join(' ');
  if (/dairies|milks|yogurts|cheeses|butters|creams/.test(joined)) return 'dairy';
  if (/meats|poultry|fishes|seafood|sausages|chicken/.test(joined)) return 'meat';
  if (/canned|preserved/.test(joined)) return 'canned';
  if (/breads|bakery|biscuits|cakes|pastries/.test(joined)) return 'bakery';
  return 'other';
}

type Raw = Record<string, string | string[] | undefined>;

const ARABIC = /[؀-ۿ]/;

/** The name in the app language when there is one; Latin-script languages never get an Arabic name if a Latin one exists. */
function pickName(p: Raw): string {
  const lang = getLang();
  const text = (key: string) => (typeof p[key] === 'string' ? (p[key] as string).trim() : '');
  const order =
    lang === 'ar'
      ? ['product_name_ar', 'product_name', 'product_name_fr', 'product_name_en', 'generic_name_ar', 'generic_name']
      : lang === 'fr'
        ? ['product_name_fr', 'product_name', 'product_name_en', 'generic_name_fr', 'generic_name']
        : ['product_name_en', 'product_name', 'product_name_fr', 'generic_name_en', 'generic_name'];
  const candidates = order.map(text).filter(Boolean);
  if (lang === 'ar') return candidates[0] ?? '';
  return candidates.find((c) => !ARABIC.test(c)) ?? '';
}

const SERVERS = ['world.openfoodfacts.org', 'world.openproductsfacts.org', 'world.openbeautyfacts.org', 'world.openpetfoodfacts.org'];

async function fetchOne(host: string, code: string, signal: AbortSignal): Promise<FoodInfo | null> {
  try {
    const fields =
      'product_name,product_name_ar,product_name_fr,product_name_en,generic_name,generic_name_ar,generic_name_fr,generic_name_en,brands,quantity,categories_tags';
    const response = await fetch(`https://${host}/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`, { signal });
    if (!response.ok) return null;
    const json = (await response.json()) as { status?: number; product?: Raw };
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const base = pickName(p);
    const brand = (typeof p.brands === 'string' ? p.brands : '').split(',')[0]?.trim() ?? '';
    const quantity = (typeof p.quantity === 'string' ? p.quantity : '').trim();
    if (!base && !brand) return null;
    const parts = base ? [base] : [];
    if (brand && !base.toLowerCase().includes(brand.toLowerCase())) parts.push(brand);
    if (quantity) parts.push(quantity);
    return { name: parts.join(' ').slice(0, 120), category: categoryFromTags(Array.isArray(p.categories_tags) ? p.categories_tags : []) };
  } catch {
    return null;
  }
}

/** Looks a barcode up in the free Open Food / Products / Beauty / Pet Food Facts databases, all at once. */
export async function lookupBarcode(code: string): Promise<FoodInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const all = await Promise.all(SERVERS.map((host) => fetchOne(host, code, controller.signal)));
    return all.find((x) => x !== null) ?? null;
  } finally {
    clearTimeout(timer);
  }
}
