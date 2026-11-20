import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { BackButton, Empty, Thumb, toneOf } from '../components/ui';
import { categoryLabel } from '../lib/categories';
import {
  addDays,
  daysPhrase,
  daysUntil,
  formatDay,
  formatFull,
  parseISO,
  shelfProgress,
  statusOf,
  toISO,
} from '../lib/dates';
import { parseTime } from '../lib/planner';
import { useData } from '../state/DataProvider';

export default function Details() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, settings, loaded, consumeProduct, removeProduct } = useData();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product = products.find((p) => p.id === id);

  if (!product) {
    return (
      <div className="page page-form">
        <header className="form-head">
          <BackButton to="/products" />
          <h1>تفاصيل المنتج</h1>
        </header>
        {loaded ? (
          <Empty
            title="المنتج غير موجود"
            text="ربما حُذف أو تم استهلاكه."
            action={
              <Link to="/products" className="btn btn-primary">
                العودة إلى المنتجات
              </Link>
            }
          />
        ) : (
          <p className="muted center">جارٍ التحميل…</p>
        )}
      </div>
    );
  }

  const now = new Date();
  const days = daysUntil(product.expiry_date, now);
  const tone = toneOf(statusOf(days));
  const added = toISO(new Date(product.created_at));
  const progress = shelfProgress(added, product.expiry_date, now);
  const bigLabel = days < 0 ? 'يوم منذ انتهاء الصلاحية' : days === 0 ? 'ينتهي اليوم' : 'يوم حتى الانتهاء';

  const rules = [...new Set(product.remind_days ?? settings.default_remind_days)].sort((a, b) => b - a);
  const { hours, minutes } = parseTime(settings.notify_time);
  const expiry = parseISO(product.expiry_date);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      navigate('/products', { replace: true });
    } catch (failure) {
      const message = failure && typeof failure === 'object' && 'message' in failure ? String(failure.message) : '';
      setError(message || 'تعذّر تنفيذ العملية. حاول مرة أخرى.');
      setBusy(false);
    }
  }

  return (
    <div className="page page-form">
      <header className="form-head form-head-between">
        <div className="form-head-start">
          <BackButton to="/products" />
          <h1>تفاصيل المنتج</h1>
        </div>
        <div className="head-actions">
          <Link to={`/product/${product.id}/edit`} className="round-btn" aria-label="تعديل">
            <Icon name="pencil" size={20} />
          </Link>
          <button
            type="button"
            className="round-btn round-btn-danger"
            aria-label="حذف"
            onClick={() => setConfirming((value) => !value)}
          >
            <Icon name="trash" size={20} />
          </button>
        </div>
      </header>

      {confirming && (
        <div className="card confirm" role="alertdialog" aria-label="تأكيد الحذف">
          <span className="row-name">حذف هذا المنتج نهائيًا؟</span>
          <span className="confirm-actions">
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={busy}
              onClick={() => void run(() => removeProduct(product.id))}
            >
              حذف
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setConfirming(false)}>
              إلغاء
            </button>
          </span>
        </div>
      )}

      <section className={`hero tone-${tone}`}>
        <div className="hero-top">
          <Thumb product={product} size={56} />
          <span className="hero-name">
            <strong>{product.name}</strong>
            <span className="chip chip-white">{categoryLabel(product.category)}</span>
          </span>
        </div>
        <div className="hero-days">
          <span className="hero-num">{Math.abs(days)}</span>
          <span className="hero-label">{bigLabel}</span>
        </div>
        <div className="progress-wrap">
          <span className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress}%` }} />
          </span>
          <span className="progress-labels">
            <span>أُضيف {formatDay(added)}</span>
            <span>ينتهي {formatDay(product.expiry_date)}</span>
          </span>
        </div>
      </section>

      <div className="info-grid">
        <div className="card info">
          <span className="muted small">تاريخ الانتهاء</span>
          <strong>{formatFull(product.expiry_date)}</strong>
        </div>
        <div className="card info">
          <span className="muted small">الكمية</span>
          <strong>{product.quantity}</strong>
        </div>
      </div>

      <section className="card timeline">
        <h2>جدول التنبيهات</h2>
        {!settings.notifications_enabled && <p className="muted small">التنبيهات متوقفة من صفحة التنبيهات.</p>}
        {rules.length === 0 && <p className="muted small">لا توجد تنبيهات لهذا المنتج.</p>}
        {rules.map((daysBefore) => {
          const at = new Date(expiry.y, expiry.m - 1, expiry.d - daysBefore, hours, minutes);
          const past = at.getTime() <= now.getTime();
          return (
            <div className="tl-row" key={daysBefore}>
              <span className={`tl-dot ${past ? 'done' : ''}`}>
                <Icon name={past ? 'check' : 'clock'} size={16} stroke={2.2} />
              </span>
              <span className="tl-name">{daysBefore === 0 ? 'يوم الانتهاء' : `قبل ${daysPhrase(daysBefore)}`}</span>
              <span className="muted small">
                {formatDay(addDays(product.expiry_date, -daysBefore))} · {past ? 'مضى موعده' : 'قادم'}
              </span>
            </div>
          );
        })}
      </section>

      {error && (
        <div className="banner banner-rose" role="alert">
          {error}
        </div>
      )}

      <span className="grow" />

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void run(() => consumeProduct(product.id))}
        >
          <Icon name="check" size={20} stroke={2.2} />
          تم استهلاكه
        </button>
        <Link to={`/product/${product.id}/edit`} className="btn btn-outline">
          تعديل
        </Link>
      </div>
    </div>
  );
}
