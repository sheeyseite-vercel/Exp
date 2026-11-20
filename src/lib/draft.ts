import type { Category } from './types';

/** Data carried from the scan screen to the product form. */
export interface Draft {
  name?: string;
  category?: Category;
  expiry?: string;
  barcode?: string;
  photo?: Blob;
}

let current: Draft | null = null;

export function setDraft(draft: Draft | null): void {
  current = draft;
}

/** Reads the draft without clearing it, so a double render does not lose it. */
export function getDraft(): Draft | null {
  return current;
}
