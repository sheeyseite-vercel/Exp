import { Capacitor } from '@capacitor/core';
import { ExpiryNotifier } from './expiryNotifier';
import { compressImage } from './image';

const SIZE = 1000;
const PAD = 0.07;

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function fromBase64(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Crops the transparent margin and centres the subject on a square canvas so every product looks alike. */
async function normalize(png: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(png);
  const probe = document.createElement('canvas');
  probe.width = bitmap.width;
  probe.height = bitmap.height;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  if (!pctx) throw new Error('canvas unavailable');
  pctx.drawImage(bitmap, 0, 0);
  const { data } = pctx.getImageData(0, 0, probe.width, probe.height);
  let minX = probe.width;
  let minY = probe.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < probe.height; y += 1) {
    for (let x = 0; x < probe.width; x += 1) {
      if (data[(y * probe.width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('empty cut-out');
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const box = SIZE * (1 - PAD * 2);
  const scale = Math.min(box / w, box / h);
  const dw = Math.round(w * scale);
  const dh = Math.round(h * scale);
  const out = document.createElement('canvas');
  out.width = SIZE;
  out.height = SIZE;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, minX, minY, w, h, Math.round((SIZE - dw) / 2), Math.round((SIZE - dh) / 2), dw, dh);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('image encoding failed');
  return blob;
}

export interface CutoutResult {
  blob: Blob;
  /** true when the background was removed; false when the original photo had to be used. */
  cutout: boolean;
}

/** Turns a product photo into a clean cut-out on transparent background, same framing for every product. */
export async function cutoutProduct(photo: Blob): Promise<CutoutResult> {
  const small = await compressImage(photo, 1400, 0.92);
  if (Capacitor.isNativePlatform()) {
    try {
      const { image } = await ExpiryNotifier.removeBackground({ image: await toBase64(small) });
      return { blob: await normalize(fromBase64(image, 'image/png')), cutout: true };
    } catch {
      /* model unavailable or no subject found: fall back to the original photo */
    }
  }
  return { blob: small, cutout: false };
}
