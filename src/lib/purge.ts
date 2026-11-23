import { supabase } from './supabase';

const like = (text: string) => text.trim().replace(/[\\%_]/g, '\\$&');

/**
 * Deletes a product from every section at once: expiry list, selling prices, categories and the shopping list.
 * Matches by barcode (when there is one) or by name, ignoring case.
 */
export async function purgeProduct(name: string, barcode?: string | null): Promise<void> {
  const tables = ['products', 'shop_products', 'catalog_products', 'shopping_items'] as const;
  const code = barcode?.trim();
  for (const table of tables) {
    if (name.trim()) {
      const { error } = await supabase.from(table).delete().ilike('name', like(name));
      if (error) throw error;
    }
    if (code && (table === 'products' || table === 'shop_products')) {
      const { error } = await supabase.from(table).delete().eq('barcode', code);
      if (error) throw error;
    }
  }
}
