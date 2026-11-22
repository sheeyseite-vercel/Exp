import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { t } from '../lib/i18n';
import { setDraft } from '../lib/draft';
import { formatFull } from '../lib/dates';
import { compressImage } from '../lib/image';
import { lookupBarcode } from '../lib/openfoodfacts';
import { parseScan } from '../lib/qr';
import { isNative } from '../lib/supabase';
import { useData } from '../state/DataProvider';
import { ALL_FORMATS } from '../lib/scanner';
import type { Category } from '../lib/types';

type Mode = 'qr' | 'photo';

interface Result {
  kind: 'code' | 'photo';
  name?: string;
  expiry?: string;
  barcode?: string;
  category?: Category;
  photo?: Blob;
  photoPath?: string;
  previewUrl?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The scanner is a Google Play services module that may need a one-time download. */
async function ensureScannerModule(): Promise<void> {
  const first = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (first.available) return;
  await BarcodeScanner.installGoogleBarcodeScannerModule();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(1000);
    const check = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (check.available) return;
  }
  throw new Error(t('scanner_fail'));
}

export default function Scan() {
  const navigate = useNavigate();
  const { products } = useData();
  const [mode, setMode] = useState<Mode>('qr');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // Starting a new add flow always begins with an empty draft.
  useEffect(() => setDraft(null), []);

  useEffect(() => {
    const url = result?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [result?.previewUrl]);

  async function startScan() {
    setError(null);
    if (!isNative) {
      setError(t('scan_web_only'));
      return;
    }
    setBusy(true);
    try {
      await ensureScannerModule();
      const { barcodes } = await BarcodeScanner.scan({
        formats: ALL_FORMATS,
      });
      const raw = barcodes[0]?.rawValue ?? barcodes[0]?.displayValue ?? '';
      if (!raw) {
        setError(t('scan_none'));
        return;
      }
      const info = parseScan(raw);
      let name = info.name;
      let category: Category | undefined;
      let photoPath: string | undefined;
      // A product you already added once is recognised by its barcode, whatever the databases know.
      const mine = info.barcode ? products.find((p) => p.barcode === info.barcode) : undefined;
      if (mine) {
        name = mine.name;
        category = mine.category;
        photoPath = mine.photo_path ?? undefined;
      }
      if (!name && info.barcode) {
        const food = await lookupBarcode(info.barcode);
        if (food) {
          name = food.name;
          category = food.category;
        }
      }
      setResult({ kind: 'code', name, expiry: info.expiry, barcode: info.barcode, category, photoPath });
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : '';
      if (!/cancel/i.test(message)) setError(message || t('scan_fail'));
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const photo = await compressImage(file, 1600, 0.88);
      setResult({ kind: 'photo', photo, previewUrl: URL.createObjectURL(photo) });
    } catch {
      setError(t('photo_fail'));
    } finally {
      setBusy(false);
    }
  }

  function proceed() {
    if (!result) return;
    setDraft({
      name: result.name,
      category: result.category,
      expiry: result.expiry,
      barcode: result.barcode,
      photo: result.photo,
      photoPath: result.photoPath,
    });
    navigate('/product/new');
  }

  const detectedTitle =
    result?.kind === 'photo' ? t('detected_photo') : (result?.name ?? t('detected_code'));
  const detectedText =
    result?.kind === 'photo'
      ? t('detected_photo_text')
      : result?.expiry
        ? t('detected_expiry', { date: formatFull(result.expiry) })
        : result?.name
          ? t('detected_known')
          : t('detected_noname');

  return (
    <div className="scan">
      <div className="scan-top">
        <Link to="/" className="round-btn round-btn-glass" aria-label={t('close')}>
          <Icon name="close" size={22} stroke={2} />
        </Link>
        <span className="scan-title">{t('scan_title')}</span>
        <span className="round-btn round-btn-ghost" aria-hidden="true" />
      </div>

      <div className="scan-stage">
        <div className="frame">
          <span className="corner c-tl" />
          <span className="corner c-tr" />
          <span className="corner c-bl" />
          <span className="corner c-br" />
          {mode === 'qr' ? (
            <button type="button" className="frame-action" onClick={() => void startScan()} disabled={busy}>
              <Icon name="scan" size={34} />
              {busy ? t('scan_preparing') : t('scan_tap')}
            </button>
          ) : (
            <label className="frame-action" htmlFor="photo-input">
              <Icon name="camera" size={34} />
              {busy ? t('scan_processing') : t('scan_take_photo')}
              <input
                id="photo-input"
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(event) => {
                  void onPhoto(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          )}
        </div>
        <span className="scan-hint">
          {mode === 'qr' ? t('scan_hint_qr') : t('scan_hint_photo')}
        </span>
      </div>

      <div className="sheet">
        <span className="grabber" />
        <div className="segmented" role="group" aria-label={t('mode_aria')}>
          <button
            type="button"
            aria-pressed={mode === 'qr'}
            className={mode === 'qr' ? 'active' : ''}
            onClick={() => {
              setMode('qr');
              setResult(null);
              setError(null);
            }}
          >
            <Icon name="scan" size={18} stroke={1.9} />
            {t('mode_qr')}
          </button>
          <button
            type="button"
            aria-pressed={mode === 'photo'}
            className={mode === 'photo' ? 'active' : ''}
            onClick={() => {
              setMode('photo');
              setResult(null);
              setError(null);
            }}
          >
            <Icon name="camera" size={18} stroke={1.9} />
            {t('mode_photo')}
          </button>
          <Link to="/product/new" onClick={() => setDraft(null)}>
            <Icon name="pencil" size={18} stroke={1.9} />
            {t('mode_manual')}
          </Link>
        </div>

        {error && (
          <div className="banner banner-rose" role="alert">
            {error}
          </div>
        )}

        {result && (
          <div className="card detected">
            <span className="thumb tone-mint" style={{ width: 48, height: 48 }}>
              {result.previewUrl ? <img src={result.previewUrl} alt="" /> : <Icon name="check" size={24} stroke={2} />}
            </span>
            <span className="row-main">
              <span className="row-name">{detectedTitle}</span>
              <span className="row-sub">{detectedText}</span>
            </span>
            <span className="chip chip-mint">{t('ready')}</span>
          </div>
        )}

        <button type="button" className="btn btn-primary" disabled={!result} onClick={proceed}>
          {t('scan_continue')}
          <Icon name="chevronLeft" size={20} stroke={2} />
        </button>
        <p className="muted small center">{t('scan_continue_hint')}</p>
      </div>
    </div>
  );
}
