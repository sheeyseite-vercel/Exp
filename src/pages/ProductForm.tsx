import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { BackButton } from '../components/ui';
import { CATEGORY_IDS, categoryLabel } from '../lib/categories';
import { readDateFromPhoto } from '../lib/ocr';
import { addDays, daysPhrase, daysUntil, formatFull, isValidISO, toISO } from '../lib/dates';
import { getDraft, setDraft } from '../lib/draft';
import { t, type TKey } from '../lib/i18n';
import { compressImage } from '../lib/image';
import { normalizeText, productKey } from '../lib/text';
import { LOCATIONS, type Category, type Location } from '../lib/types';
import { useData } from '../state/DataProvider';
import { usePhotoUrl } from '../state/usePhotoUrl';

const PRESET_DAYS = [7, 1, 0];

function remindLabel(days: number): string {
  return days === 0 ? t('remind_day0') : daysPhrase(days);
}

function remainingText(iso: string): string {
  if (!isValidISO(iso)) return t('pick_date');
  const days = daysUntil(iso);
  if (days < 0) return t('expired_since', { d: daysPhrase(-days) });
  if (days === 0) return t('expires_today');
  return t('in_days', { d: daysPhrase(days) });
}

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, settings, loaded, saveProduct } = useData();
  const editing = id !== undefined;
  const existing = editing ? products.find((p) => p.id === id) : undefined;

  const draft = useMemo(() => (editing ? null : getDraft()), [editing]);

  const [name, setName] = useState(draft?.name ?? '');
  const [category, setCategory] = useState<Category>(draft?.category ?? 'other');
  const [location, setLocation] = useState<Location>('fridge');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const [expiry, setExpiry] = useState(draft?.expiry ?? '');
  const [qtyText, setQtyText] = useState('1');
  const [reusePath, setReusePath] = useState<string | null>(null);
  const [remind, setRemind] = useState<number[] | null>(null);
  const [barcode, setBarcode] = useState<string | null>(draft?.barcode ?? null);
  const [photo, setPhoto] = useState<Blob | null>(draft?.photo ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initialised, setInitialised] = useState(!editing);

  // Fill the form once when editing an existing product.
  useEffect(() => {
    if (!editing || initialised || !existing) return;
    setName(existing.name);
    setCategory(existing.category);
    setLocation(existing.location ?? 'fridge');
    setExpiry(existing.expiry_date);
    setQtyText(String(existing.quantity));
    setRemind(existing.remind_days);
    setBarcode(existing.barcode);
    setInitialised(true);
  }, [editing, initialised, existing]);

  useEffect(() => {
    if (editing && loaded && !existing) navigate('/products', { replace: true });
  }, [editing, loaded, existing, navigate]);

  const localPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview],
  );
  const storedPreview = usePhotoUrl(removePhoto ? null : (existing?.photo_path ?? reusePath));
  const preview = localPreview ?? storedPreview;

  const parsedQty = Number.parseInt(qtyText, 10);
  const quantity = Number.isFinite(parsedQty) ? Math.max(1, Math.min(999, parsedQty)) : 1;

  // Products already in the list: offer them as shortcuts, and explain that each batch is tracked on its own.
  const needle = normalizeText(name);
  const known = useMemo(() => {
    const seen = new Map<string, (typeof products)[number]>();
    for (const product of products) if (product.id !== id && !seen.has(productKey(product))) seen.set(productKey(product), product);
    return [...seen.values()];
  }, [products, id]);
  const suggestions =
    needle.length > 0 && !editing ? known.filter((p) => normalizeText(p.name).includes(needle) && normalizeText(p.name) !== needle).slice(0, 4) : [];
  const sameProduct = products.filter(
    (p) => p.id !== id && ((barcode && p.barcode === barcode) || (needle.length > 0 && normalizeText(p.name) === needle)),
  );
  const sameQuantity = sameProduct.reduce((sum, p) => sum + p.quantity, 0);

  function pickSuggestion(product: (typeof products)[number]) {
    setName(product.name);
    setCategory(product.category);
    setLocation(product.location ?? 'fridge');
    setBarcode(product.barcode);
    if (!photo && product.photo_path) {
      setReusePath(product.photo_path);
      setRemovePhoto(false);
    }
  }

  const effective = remind ?? settings.default_remind_days;
  const extras = effective.filter((d) => !PRESET_DAYS.includes(d)).sort((a, b) => b - a);

  function toggleRemind(days: number) {
    const set = new Set(effective);
    if (set.has(days)) set.delete(days);
    else set.add(days);
    setRemind([...set].sort((a, b) => b - a));
  }

  function addCustom() {
    const value = Number.parseInt(customValue, 10);
    if (!Number.isFinite(value) || value < 1 || value > 365) {
      setError(t('custom_error'));
      return;
    }
    setError(null);
    setRemind([...new Set([...effective, value])].sort((a, b) => b - a));
    setCustomValue('');
    setCustomOpen(false);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await compressImage(file));
      setRemovePhoto(false);
    } catch {
      setError(t('photo_fail'));
    }
  }

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError(t('err_name'));
      return;
    }
    if (!isValidISO(expiry)) {
      setError(t('err_date'));
      return;
    }
    setSaving(true);
    try {
      const saved = await saveProduct(
        {
          name,
          category,
          location,
          expiry_date: expiry,
          quantity,
          barcode,
          remind_days: remind,
          photo_path: removePhoto && !photo ? null : (reusePath ?? undefined),
        },
        photo,
        id,
      );
      setDraft(null);
      navigate(editing ? `/product/${saved.id}` : '/products', { replace: true });
    } catch (failure) {
      const message = failure && typeof failure === 'object' && 'message' in failure ? String(failure.message) : '';
      setError(message || t('save_fail'));
    } finally {
      setSaving(false);
    }
  }

  const today = toISO(new Date());

  return (
    <div className="page page-form">
      <header className="form-head">
        <BackButton />
        <h1>{editing ? t('form_edit') : t('form_new')}</h1>
      </header>

      <div className="name-row">
        <div className="photo-box">
          {preview ? (
            <>
              <img src={preview} alt={t('photo_alt')} />
              <button
                type="button"
                className="photo-remove"
                aria-label={t('photo_remove')}
                onClick={() => {
                  setPhoto(null);
                  setReusePath(null);
                  setRemovePhoto(true);
                }}
              >
                <Icon name="close" size={14} stroke={2.4} />
              </button>
            </>
          ) : (
            <label htmlFor="form-photo" className="photo-add">
              <Icon name="camera" size={24} />
              {t('photo_add')}
              <input
                id="form-photo"
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
        <label className="card field field-grow" htmlFor="name">
          <span className="field-label">{t('name_label')}</span>
          <input
            id="name"
            type="text"
            value={name}
            maxLength={120}
            placeholder={t('name_placeholder')}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      </div>

      {photo && (
        <div className="stack">
          <button
            type="button"
            className="btn btn-soft"
            disabled={ocrBusy}
            onClick={async () => {
              setOcrBusy(true);
              setOcrNote(null);
              const result = await readDateFromPhoto(photo);
              setOcrBusy(false);
              if (result.status === 'found') {
                setExpiry(result.iso);
                setOcrNote(t('ocr_found', { date: formatFull(result.iso) }));
              } else {
                setOcrNote(result.status === 'unsupported' ? t('ocr_web') : t('ocr_none'));
              }
            }}
          >
            <Icon name="scan" size={18} />
            {ocrBusy ? t('ocr_busy') : t('ocr_btn')}
          </button>
          {ocrNote && (
            <span className="muted small" role="status">
              {ocrNote}
            </span>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="stack">
          <span className="section-label">{t('suggest_title')}</span>
          <div className="pills">
            {suggestions.map((product) => (
              <button key={product.id} type="button" className="pill" onClick={() => pickSuggestion(product)}>
                {product.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {sameProduct.length > 0 && (
        <div className="banner banner-sky" role="status">
          {t('batch_note', { n: sameQuantity })}
        </div>
      )}

      <div className="stack">
        <span className="section-label">{t('category_label')}</span>
        <div className="pills" role="group" aria-label={t('category_label')}>
          {CATEGORY_IDS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              className={`pill ${category === item ? 'active' : ''}`}
              onClick={() => setCategory(item)}
            >
              {categoryLabel(item)}
            </button>
          ))}
        </div>
      </div>

      <div className="stack">
        <span className="section-label">{t('loc_label')}</span>
        <div className="pills" role="group" aria-label={t('loc_label')}>
          {LOCATIONS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={location === item}
              className={`pill ${location === item ? 'active' : ''}`}
              onClick={() => setLocation(item)}
            >
              {t(`loc_${item}` as TKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="date-row">
        <label className="card field date-field" htmlFor="expiry">
          <span className="date-icon">
            <Icon name="calendar" size={22} />
          </span>
          <span className="field-col">
            <span className="field-label">{t('expiry_label')}</span>
            <input
              id="expiry"
              type="date"
              value={expiry}
              min="2000-01-01"
              max="2100-12-31"
              onChange={(event) => setExpiry(event.target.value)}
            />
          </span>
        </label>
        <div className="tile tone-peach remaining">
          <span className="small">{t('remaining')}</span>
          <strong>{remainingText(expiry)}</strong>
        </div>
      </div>

      <div className="pills quick" role="group" aria-label={t('quick_aria')}>
        <button type="button" className="pill" onClick={() => setExpiry(addDays(today, 7))}>
          {t('quick_week')}
        </button>
        <button type="button" className="pill" onClick={() => setExpiry(addDays(today, 30))}>
          {t('quick_month')}
        </button>
        <button type="button" className="pill" onClick={() => setExpiry(addDays(today, 90))}>
          {t('quick_3months')}
        </button>
      </div>

      <div className="card stepper-row">
        <span className="stack-xs">
          <span className="row-name">{t('quantity')}</span>
          <span className="muted small">{t('qty_hint')}</span>
        </span>
        <span className="stepper">
          <button
            type="button"
            className="step-btn"
            aria-label={t('qty_dec')}
            onClick={() => setQtyText(String(Math.max(1, quantity - 1)))}
          >
            <Icon name="minus" size={18} stroke={2.2} />
          </button>
          <input
            className="step-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            aria-label={t('quantity')}
            value={qtyText}
            onChange={(event) => setQtyText(event.target.value)}
            onBlur={() => setQtyText(String(quantity))}
          />
          <button
            type="button"
            className="step-btn step-btn-primary"
            aria-label={t('qty_inc')}
            onClick={() => setQtyText(String(Math.min(999, quantity + 1)))}
          >
            <Icon name="plus" size={18} stroke={2.2} />
          </button>
        </span>
      </div>

      <div className="card remind-card">
        <div className="remind-title">
          <Icon name="bell" size={20} />
          {t('remind_title')}
        </div>
        <div className="pills" role="group" aria-label={t('remind_aria')}>
          {PRESET_DAYS.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={effective.includes(days)}
              className={`pill pill-check ${effective.includes(days) ? 'on' : ''}`}
              onClick={() => toggleRemind(days)}
            >
              {effective.includes(days) && <Icon name="check" size={14} stroke={2.6} />}
              {days === 0 ? t('remind_day0') : days === 1 ? t('remind_day1') : t('remind_dayn', { n: days })}
            </button>
          ))}
          {extras.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed="true"
              className="pill pill-check on"
              onClick={() => toggleRemind(days)}
            >
              <Icon name="check" size={14} stroke={2.6} />
              {remindLabel(days)}
            </button>
          ))}
          <button type="button" className="pill pill-dashed" onClick={() => setCustomOpen((open) => !open)}>
            {t('remind_custom')}
          </button>
        </div>
        {customOpen && (
          <div className="custom-row">
            <label htmlFor="custom-days" className="small muted">
              {t('custom_label')}
            </label>
            <input
              id="custom-days"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
            />
            <button type="button" className="btn btn-soft btn-sm" onClick={addCustom}>
              {t('add')}
            </button>
          </div>
        )}
        {remind === null ? (
          <span className="muted small">{t('remind_global')}</span>
        ) : (
          <button type="button" className="link link-btn" onClick={() => setRemind(null)}>
            {t('remind_back')}
          </button>
        )}
      </div>

      {error && (
        <div className="banner banner-rose" role="alert">
          {error}
        </div>
      )}

      <span className="grow" />

      <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
        <Icon name="check" size={20} stroke={2.2} />
        {saving ? t('saving') : t('save_product')}
      </button>
    </div>
  );
}
