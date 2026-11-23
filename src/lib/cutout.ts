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

/** Principal-axis tilt of the subject, in radians from horizontal, plus how elongated it is. */
function tilt(data: Uint8ClampedArray, w: number, h: number): { angle: number; ratio: number } | null {
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        n += 1;
        sx += x;
        sy += y;
      }
    }
  }
  if (n < 50) return null;
  const mx = sx / n;
  const my = sy / n;
  let uxx = 0;
  let uyy = 0;
  let uxy = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        const dx = x - mx;
        const dy = y - my;
        uxx += dx * dx;
        uyy += dy * dy;
        uxy += dx * dy;
      }
    }
  }
  const angle = 0.5 * Math.atan2(2 * uxy, uxx - uyy);
  const root = Math.sqrt(((uxx - uyy) / 2) ** 2 + uxy ** 2);
  const l1 = (uxx + uyy) / 2 + root;
  const l2 = (uxx + uyy) / 2 - root;
  return { angle, ratio: l2 > 0 ? Math.sqrt(l1 / l2) : 99 };
}

/** Straightens a tilted product: turns it so its long axis is upright (or flat), up to 35 degrees. */
async function straighten(bitmap: ImageBitmap): Promise<HTMLCanvasElement> {
  const probe = document.createElement('canvas');
  probe.width = bitmap.width;
  probe.height = bitmap.height;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  if (!pctx) throw new Error('canvas unavailable');
  pctx.drawImage(bitmap, 0, 0);
  const found = tilt(pctx.getImageData(0, 0, probe.width, probe.height).data, probe.width, probe.height);
  if (!found || found.ratio < 1.25) return probe;
  const deg = (found.angle * 180) / Math.PI;
  const turn = Math.abs(deg) <= 45 ? -deg : deg > 0 ? 90 - deg : -90 - deg;
  if (Math.abs(turn) < 3 || Math.abs(turn) > 35) return probe;
  const rad = (turn * Math.PI) / 180;
  const size = Math.ceil(Math.hypot(bitmap.width, bitmap.height));
  const rot = document.createElement('canvas');
  rot.width = size;
  rot.height = size;
  const rctx = rot.getContext('2d', { willReadFrequently: true });
  if (!rctx) throw new Error('canvas unavailable');
  rctx.translate(size / 2, size / 2);
  rctx.rotate(rad);
  rctx.imageSmoothingQuality = 'high';
  rctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return rot;
}

/** Crops the transparent margin and centres the subject on a square canvas so every product looks alike. */
async function normalize(png: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(png);
  const probe = await straighten(bitmap);
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  if (!pctx) throw new Error('canvas unavailable');
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
  ctx.drawImage(probe, minX, minY, w, h, Math.round((SIZE - dw) / 2), Math.round((SIZE - dh) / 2), dw, dh);
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
  const small = await compressImage(photo, 1100, 0.9);
  if (Capacitor.isNativePlatform()) {
    const b64 = await toBase64(small);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const { image } = await ExpiryNotifier.removeBackground({ image: b64 });
        return { blob: await normalize(fromBase64(image, 'image/png')), cutout: true };
      } catch {
        /* the on-device model may still be downloading: wait a moment and try again */
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }
  return { blob: small, cutout: false };
}
