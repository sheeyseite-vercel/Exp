import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { BackButton } from '../components/ui';
import { CATEGORIES } from '../lib/categories';
import { addDays, daysPhrase, daysUntil, isValidISO, toISO } from '../lib/dates';
import { getDraft, setDraft } from '../lib/draft';
import { compressImage } from '../lib/image';
import type { Category } from '../lib/types';
import { useData } from '../state/DataProvider';
import { usePhotoUrl } from '../state/usePhotoUrl';

const PRESET_DAYS = [7, 3, 1, 0];

function remindLabel(days: number): string {
  return days === 0 ? 'يوم الانتهاء' : daysPhrase(days);
}

function remainingText(iso: string): string {
  if (!isValidISO(iso)) return 'اختر التاريخ';
  const days = daysUntil(iso);
  if (days < 0) return `منتهٍ منذ ${daysPhrase(-days)}`;
  if (days === 0) return 'ينتهي اليوم';
  return `بعد ${daysPhrase(days)}`;
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
  const [expiry, setExpiry] = useState(draft?.expiry ?? '');
  const [quantity, setQuantity] = useState(1);
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
    setExpiry(existing.expiry_date);
    setQuantity(existing.quantity);
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
  const storedPreview = usePhotoUrl(removePhoto ? null : existing?.photo_path);
  const preview = localPreview ?? storedPreview;

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
      setError('اكتب عدد أيام بين 1 و365 للتنبيه المخصص.');
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
      setError('تعذّرت معالجة الصورة. حاول مرة أخرى.');
    }
  }

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError('اكتب اسم المنتج.');
      return;
    }
    if (!isValidISO(expiry)) {
      setError('اختر تاريخ الانتهاء.');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveProduct(
        {
          name,
          category,
          expiry_date: expiry,
          quantity,
          barcode,
          remind_days: remind,
          photo_path: removePhoto && !photo ? null : undefined,
        },
        photo,
        id,
      );
      setDraft(null);
      navigate(editing ? `/product/${saved.id}` : '/products', { replace: true });
    } catch (failure) {
      const message = failure && typeof failure === 'object' && 'message' in failure ? String(failure.message) : '';
      setError(message || 'تعذّر حفظ المنتج. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  }

  const today = toISO(new Date());

  return (
    <div className="page page-form">
      <header className="form-head">
        <BackButton />
        <h1>{editing ? 'تعديل المنتج' : 'بيانات المنتج'}</h1>
      </header>

      <div className="name-row">
        <div className="photo-box">
          {preview ? (
            <>
              <img src={preview} alt="صورة المنتج" />
              <button
                type="button"
                className="photo-remove"
                aria-label="إزالة الصورة"
                onClick={() => {
                  setPhoto(null);
                  setRemovePhoto(true);
                }}
              >
                <Icon name="close" size={14} stroke={2.4} />
              </button>
            </>
          ) : (
            <label htmlFor="form-photo" className="photo-add">
              <Icon name="camera" size={24} />
              إضافة صورة
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
          <span className="field-label">اسم المنتج</span>
          <input
            id="name"
            type="text"
            value={name}
            maxLength={120}
            placeholder="مثال: حليب كامل الدسم 1 لتر"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      </div>

      <div className="stack">
        <span className="section-label">الفئة</span>
        <div className="pills" role="group" aria-label="الفئة">
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={category === item.id}
              className={`pill ${category === item.id ? 'active' : ''}`}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
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
            <span className="field-label">تاريخ الانتهاء</span>
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
          <span className="small">المتبقي</span>
          <strong>{remainingText(expiry)}</strong>
        </div>
      </div>

      <div className="pills quick" role="group" aria-label="تواريخ سريعة">
        <button type="button" className="pill" onClick={() => setExpiry(addDays(today, 7))}>
          بعد أسبوع
        </button>
        <button type="button" className="pill" onClick={() => setExpiry(addDays(today, 30))}>
          بعد شهر
        </button>
        <button type="button" className="pill" onClick={() => setExpiry(addDays(today, 90))}>
          بعد 3 أشهر
        </button>
      </div>

      <div className="card stepper-row">
        <span className="row-name">الكمية</span>
        <span className="stepper">
          <button
            type="button"
            className="step-btn"
            aria-label="إنقاص الكمية"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Icon name="minus" size={18} stroke={2.2} />
          </button>
          <span className="step-value" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            className="step-btn step-btn-primary"
            aria-label="زيادة الكمية"
            onClick={() => setQuantity((q) => Math.min(999, q + 1))}
          >
            <Icon name="plus" size={18} stroke={2.2} />
          </button>
        </span>
      </div>

      <div className="card remind-card">
        <div className="remind-title">
          <Icon name="bell" size={20} />
          ذكّرني قبل الانتهاء بـ
        </div>
        <div className="pills" role="group" aria-label="مواعيد التذكير">
          {PRESET_DAYS.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={effective.includes(days)}
              className={`pill pill-check ${effective.includes(days) ? 'on' : ''}`}
              onClick={() => toggleRemind(days)}
            >
              {effective.includes(days) && <Icon name="check" size={14} stroke={2.6} />}
              {days === 0 ? 'يوم الانتهاء' : days === 1 ? 'يوم واحد' : `${days} أيام`}
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
            + مخصص
          </button>
        </div>
        {customOpen && (
          <div className="custom-row">
            <label htmlFor="custom-days" className="small muted">
              عدد الأيام قبل الانتهاء
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
              إضافة
            </button>
          </div>
        )}
        {remind === null ? (
          <span className="muted small">حسب قواعد التنبيه العامة في الإعدادات.</span>
        ) : (
          <button type="button" className="link link-btn" onClick={() => setRemind(null)}>
            العودة إلى القواعد العامة
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
        {saving ? 'جارٍ الحفظ…' : 'حفظ المنتج'}
      </button>
    </div>
  );
}
