import { useCallback, useEffect, useState } from 'react';
import { PHOTO_BUCKET } from './config';
import { t } from './i18n';
import { compressImage } from './image';
import { supabase } from './supabase';
import type { CatCategory, CatProduct, ShoppingItem } from './types';

async function uploadPhoto(file: Blob | null | undefined): Promise<string | null> {
  if (!file) return null;
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return null;
  const small = await compressImage(file, 800, 0.8);
  const path = `${uid}/c-${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, small, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export function qtyLabel(item: Pick<ShoppingItem, 'qty' | 'unit'>): string {
  if (item.unit === 'half') return t('unit_half');
  if (item.unit === 'box') return item.qty === 1 ? t('qty_box_1') : t('qty_box_n', { n: item.qty });
  return t('qty_piece', { n: item.qty });
}

/** The person's own categories and products (with photos) used by the shopping list. */
export function useCatalog() {
  const [categories, setCategories] = useState<CatCategory[]>([]);
  const [products, setProducts] = useState<CatProduct[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('catalog_categories').select('id,name,photo_path').order('created_at'),
      supabase.from('catalog_products').select('id,category_id,name,brand,photo_path').order('created_at'),
    ]);
    if (c.error || p.error) setError((c.error ?? p.error)?.message ?? null);
    else {
      setCategories(c.data as CatCategory[]);
      setProducts(p.data as CatProduct[]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addCategory = useCallback(
    async (name: string, photo?: Blob | null) => {
      try {
        const photo_path = await uploadPhoto(photo);
        const { error: failure } = await supabase.from('catalog_categories').insert({ name: name.trim(), photo_path });
        if (failure) throw failure;
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e));
      }
    },
    [reload],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const { error: failure } = await supabase.from('catalog_categories').delete().eq('id', id);
      if (failure) setError(failure.message);
      await reload();
    },
    [reload],
  );

  const addProduct = useCallback(
    async (categoryId: string, name: string, brand: string, photo?: Blob | null) => {
      try {
        const photo_path = await uploadPhoto(photo);
        const { error: failure } = await supabase
          .from('catalog_products')
          .insert({ category_id: categoryId, name: name.trim(), brand: brand.trim() || null, photo_path });
        if (failure) throw failure;
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e));
      }
    },
    [reload],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const { error: failure } = await supabase.from('catalog_products').delete().eq('id', id);
      if (failure) setError(failure.message);
      await reload();
    },
    [reload],
  );

  return { categories, products, loaded, error, addCategory, deleteCategory, addProduct, deleteProduct };
}
