import { Capacitor } from '@capacitor/core';
import { ExpiryNotifier } from './expiryNotifier';
import { findExpiryDate } from './ocrDate';

export type OcrResult = { status: 'found'; iso: string } | { status: 'none' } | { status: 'unsupported' };

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

interface Variant {
  rotate: 0 | 90 | 180 | 270;
  /** Grey-scale with stretched contrast: helps with embossed, laser-etched or faint ink-jet dates. */
  enhance: boolean;
  invert?: boolean;
}

/** Draws the photo rotated and scaled to about 1800 px so small printed dates become readable. */
async function render(bitmap: ImageBitmap, variant: Variant): Promise<Blob> {
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(3, 1800 / longest);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const turned = variant.rotate === 90 || variant.rotate === 270;
  const canvas = document.createElement('canvas');
  canvas.width = turned ? h : w;
  canvas.height = turned ? w : h;
  const ctx = canvas.getContext('2d', { willReadFrequently: variant.enhance });
  if (!ctx) throw new Error('canvas unavailable');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((variant.rotate * Math.PI) / 180);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  if (variant.enhance) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = g;
      hist[g] += 1;
    }
    const total = d.length / 4;
    let acc = 0;
    let lo = 0;
    let hi = 255;
    for (let v = 0; v < 256; v += 1) {
      acc += hist[v];
      if (acc > total * 0.02) {
        lo = v;
        break;
      }
    }
    acc = 0;
    for (let v = 255; v >= 0; v -= 1) {
      acc += hist[v];
      if (acc > total * 0.02) {
        hi = v;
        break;
      }
    }
    const span = Math.max(24, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      let g = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span));
      if (variant.invert) g = 255 - g;
      d[i] = g;
      d[i + 1] = g;
      d[i + 2] = g;
    }
    ctx.putImageData(img, 0, 0);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('image encoding failed');
  return blob;
}

const PASSES: Variant[] = [
  { rotate: 0, enhance: false },
  { rotate: 0, enhance: true },
  { rotate: 90, enhance: false },
  { rotate: 270, enhance: false },
  { rotate: 180, enhance: false },
  { rotate: 0, enhance: true, invert: true },
  { rotate: 90, enhance: true },
  { rotate: 270, enhance: true },
  { rotate: 180, enhance: true },
];

/**
 * Reads the printed expiry date from a photo, on the device. Tries the photo upright, sideways and upside
 * down, plain and contrast-boosted, and stops at the first pass that contains a date.
 */
export async function readDateFromPhoto(photo: Blob): Promise<OcrResult> {
  if (!Capacitor.isNativePlatform()) return { status: 'unsupported' };
  try {
    const bitmap = await createImageBitmap(photo);
    try {
      for (const variant of PASSES) {
        const { text } = await ExpiryNotifier.recognizeText({ image: await toBase64(await render(bitmap, variant)) });
        const iso = findExpiryDate(text);
        if (iso) return { status: 'found', iso };
      }
    } finally {
      bitmap.close();
    }
    return { status: 'none' };
  } catch {
    return { status: 'none' };
  }
}
