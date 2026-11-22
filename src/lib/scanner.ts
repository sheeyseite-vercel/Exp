import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { t } from './i18n';
import { isNative } from './supabase';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureModule(): Promise<void> {
  const first = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (first.available) return;
  await BarcodeScanner.installGoogleBarcodeScannerModule();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(1000);
    if ((await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()).available) return;
  }
  throw new Error(t('scanner_fail'));
}

/** Opens the camera scanner and resolves with the raw barcode text, or null when cancelled / nothing read. */
export async function scanBarcodeText(): Promise<string | null> {
  if (!isNative) throw new Error(t('scan_web_only'));
  await ensureModule();
  try {
    const { barcodes } = await BarcodeScanner.scan({
      formats: [
        BarcodeFormat.Ean13,
        BarcodeFormat.Ean8,
        BarcodeFormat.UpcA,
        BarcodeFormat.UpcE,
        BarcodeFormat.Code128,
        BarcodeFormat.Code39,
        BarcodeFormat.QrCode,
      ],
    });
    return (barcodes[0]?.rawValue ?? barcodes[0]?.displayValue ?? '').trim() || null;
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : '';
    if (/cancel/i.test(message)) return null;
    throw failure;
  }
}
