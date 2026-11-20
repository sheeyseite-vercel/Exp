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

/** Looks a barcode up in the free Open Food Facts database. Returns null when unknown or offline. */
export async function lookupBarcode(code: string): Promise<FoodInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_ar,brands,quantity,categories_tags`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        product_name_ar?: string;
        brands?: string;
        quantity?: string;
        categories_tags?: string[];
      };
    };
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const base = (p.product_name_ar || p.product_name || '').trim();
    if (!base) return null;
    const brand = (p.brands ?? '').split(',')[0]?.trim();
    const quantity = (p.quantity ?? '').trim();
    const parts = [base];
    if (brand && !base.toLowerCase().includes(brand.toLowerCase())) parts.push(brand);
    if (quantity) parts.push(quantity);
    return { name: parts.join(' ').slice(0, 120), category: categoryFromTags(p.categories_tags ?? []) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
