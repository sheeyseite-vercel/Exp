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

/** Reads the printed expiry date from a product photo, on the device. */
export async function readDateFromPhoto(photo: Blob): Promise<OcrResult> {
  if (!Capacitor.isNativePlatform()) return { status: 'unsupported' };
  try {
    const { text } = await ExpiryNotifier.recognizeText({ image: await toBase64(photo) });
    const iso = findExpiryDate(text);
    return iso ? { status: 'found', iso } : { status: 'none' };
  } catch {
    return { status: 'none' };
  }
}
