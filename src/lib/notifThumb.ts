import { PHOTO_BUCKET } from './config';
import { supabase } from './supabase';

const cache = new Map<string, string>();
const SIDE = 128;

/** Small square JPEG (base64, no prefix) of a product photo for the notification. */
export async function notificationThumb(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit) return hit;
  try {
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 120);
    if (!data) return null;
    const blob = await (await fetch(data.signedUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = SIDE;
    canvas.height = SIDE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIDE, SIDE);
    bitmap.close();
    const b64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1] ?? null;
    if (b64) cache.set(path, b64);
    return b64;
  } catch {
    return null;
  }
}
