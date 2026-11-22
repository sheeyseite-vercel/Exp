import { useCallback, useEffect, useState } from 'react';
import { PHOTO_BUCKET } from './config';
import { compressImage } from './image';
import { supabase } from './supabase';

export interface ShopProduct {
  id: string;
  barcode: string | null;
  name: string;
  cost_cents: number;
  sell_cents: number | null;
  stock_milli: number;
  category_id: string | null;
  photo_path: string | null;
}

export interface ShopInvoice {
  id: string;
  supplier: string | null;
  printed_cents: number | null;
  total_cents: number;
  /** yyyy-mm-dd, the date written on the receipt */
  invoice_date: string;
  created_at: string;
}

export interface ShopLine {
  id: string;
  name: string;
  barcode: string | null;
  qty_milli: number;
  unit_cents: number;
}

export interface ShopReceipt {
  id: string;
  title: string;
  photo_path: string;
  created_at: string;
}

export function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String((e as { message?: string })?.message ?? e);
}

const PRODUCT_COLS = 'id,barcode,name,cost_cents,sell_cents,stock_milli,category_id,photo_path';

export async function findProductByBarcode(code: string): Promise<ShopProduct | null> {
  const { data, error } = await supabase.from('shop_products').select(PRODUCT_COLS).eq('barcode', code.trim()).maybeSingle();
  if (error) throw error;
  return (data as ShopProduct | null) ?? null;
}

export function useShopProducts() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error: failure } = await supabase.from('shop_products').select(PRODUCT_COLS).order('name');
    if (failure) setError(failure.message);
    else setProducts(data as ShopProduct[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveProduct = useCallback(
    async (id: string, patch: { sell_cents?: number | null; category_id?: string | null; photo_path?: string | null }) => {
      const { error: failure } = await supabase
        .from('shop_products')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (failure) throw failure;
      await reload();
    },
    [reload],
  );

  const createProduct = useCallback(
    async (name: string, barcode: string | null, cost: number): Promise<ShopProduct> => {
      const { data, error: failure } = await supabase
        .from('shop_products')
        .insert({ name: name.trim(), barcode: barcode?.trim() || null, cost_cents: cost })
        .select(PRODUCT_COLS)
        .single();
      if (failure) throw failure;
      await reload();
      return data as ShopProduct;
    },
    [reload],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const { error: failure } = await supabase.from('shop_products').delete().eq('id', id);
      if (failure) throw failure;
      await reload();
    },
    [reload],
  );

  return { products, loaded, error, reload, saveProduct, createProduct, deleteProduct };
}

/** Uploads a (cut-out) product photo and returns its storage path. */
export async function uploadProductPhoto(photo: Blob): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error('not signed in');
  const ext = photo.type === 'image/png' ? 'png' : 'jpg';
  const path = `${uid}/p-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: photo.type || 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function removeStoredPhoto(path: string | null): Promise<void> {
  if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<(ShopInvoice & { lines: number })[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const { data, error: failure } = await supabase
        .from('shop_invoices')
        .select('id,supplier,printed_cents,total_cents,invoice_date,created_at,shop_invoice_lines(count)')
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);
      if (failure) setError(failure.message);
      else
        setInvoices(
          (data as unknown as (ShopInvoice & { shop_invoice_lines: { count: number }[] })[]).map((row) => ({
            ...row,
            lines: row.shop_invoice_lines?.[0]?.count ?? 0,
          })),
        );
      setLoaded(true);
    })();
  }, []);
  return { invoices, loaded, error };
}

export interface LineInput {
  name: string;
  barcode: string | null;
  qtyMilli: number;
  unitCents: number;
}

/** Saves the invoice, its lines, cost prices and stock in a single database transaction. */
export async function saveInvoice(supplier: string, printedCents: number | null, date: string, lines: LineInput[]): Promise<string> {
  const { data, error } = await supabase.rpc('shop_save_invoice', {
    p_supplier: supplier,
    p_printed_cents: printedCents,
    p_date: date,
    p_lines: linesJson(lines),
  });
  if (error) throw error;
  return data as string;
}

/** Replaces an invoice's lines (stock and cost prices follow) and its header fields, atomically. */
export async function updateInvoice(
  id: string,
  supplier: string,
  printedCents: number | null,
  date: string,
  lines: LineInput[],
): Promise<void> {
  const { error } = await supabase.rpc('shop_update_invoice', {
    p_id: id,
    p_supplier: supplier,
    p_printed_cents: printedCents,
    p_date: date,
    p_lines: linesJson(lines),
  });
  if (error) throw error;
}

function linesJson(lines: LineInput[]) {
  return lines.map((l) => ({ name: l.name, barcode: l.barcode, qty_milli: l.qtyMilli, unit_cents: l.unitCents }));
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.rpc('shop_delete_invoice', { p_id: id });
  if (error) throw error;
}

export async function loadInvoice(id: string): Promise<{ invoice: ShopInvoice; lines: ShopLine[] } | null> {
  const [i, l] = await Promise.all([
    supabase.from('shop_invoices').select('id,supplier,printed_cents,total_cents,invoice_date,created_at').eq('id', id).maybeSingle(),
    supabase.from('shop_invoice_lines').select('id,name,barcode,qty_milli,unit_cents').eq('invoice_id', id).order('position'),
  ]);
  if (i.error) throw i.error;
  if (l.error) throw l.error;
  if (!i.data) return null;
  return { invoice: i.data as ShopInvoice, lines: l.data as ShopLine[] };
}

export function useReceipts() {
  const [receipts, setReceipts] = useState<ShopReceipt[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error: failure } = await supabase
      .from('shop_receipts')
      .select('id,title,photo_path,created_at')
      .order('created_at', { ascending: false });
    if (failure) setError(failure.message);
    else setReceipts(data as ShopReceipt[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = useCallback(
    async (title: string, photo: Blob) => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) throw new Error('not signed in');
      const small = await compressImage(photo, 1800, 0.85);
      const path = `${uid}/r-${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, small, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const { error: failure } = await supabase.from('shop_receipts').insert({ title: title.trim(), photo_path: path });
      if (failure) {
        await supabase.storage.from(PHOTO_BUCKET).remove([path]);
        throw failure;
      }
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (receipt: ShopReceipt) => {
      const { error: failure } = await supabase.from('shop_receipts').delete().eq('id', receipt.id);
      if (failure) throw failure;
      await supabase.storage.from(PHOTO_BUCKET).remove([receipt.photo_path]);
      await reload();
    },
    [reload],
  );

  return { receipts, loaded, error, add, remove };
}
