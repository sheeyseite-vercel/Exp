/** Makes searching and matching forgiving: ignores case, Arabic diacritics and common letter variants. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Two products are the same product (different batches) when they share a barcode or a name. */
export function productKey(product: { name: string; barcode: string | null }): string {
  return product.barcode ? `b:${product.barcode}` : `n:${normalizeText(product.name)}`;
}
