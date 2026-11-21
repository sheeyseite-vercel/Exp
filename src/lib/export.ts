import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { categoryLabel } from './categories';
import { t, type TKey } from './i18n';
import type { Product } from './types';

function cell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(rows: Product[]): string {
  const head = ['name', 'category', 'location', 'quantity', 'expiry_date', 'barcode', 'status'];
  const lines = rows.map((p) =>
    [
      p.name,
      categoryLabel(p.category),
      t(`loc_${p.location ?? 'other'}` as TKey),
      p.quantity,
      p.expiry_date,
      p.barcode,
      p.consumed_at ? (p.outcome === 'discarded' ? 'discarded' : 'used') : 'active',
    ]
      .map(cell)
      .join(','),
  );
  // BOM so Excel reads Arabic correctly.
  return '﻿' + [head.join(','), ...lines].join('\r\n');
}

/** Saves the CSV and opens the share sheet (or downloads it in a browser). */
export async function exportProducts(rows: Product[]): Promise<void> {
  const csv = buildCsv(rows);
  const name = `expired-${new Date().toISOString().slice(0, 10)}.csv`;
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({ path: name, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, url: file.uri });
    return;
  }
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
