import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { DeleteSheet } from '../components/DeleteSheet';
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
import { t } from '../lib/i18n';
import { parseTime } from '../lib/planner';
import { purgeProduct } from '../lib/purge';
import { supabase } from '../lib/supabase';
import { useData } from '../state/DataProvider';

export default function Details() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, settings, loaded, consumeProduct, refresh } = useData();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product = products.find((p) => p.id === id);
  const [note, setNote] = useState<string | null>(null);

  async function addToShopping(name: string) {
    const { error: failure } = await supabase.from('shopping_items').insert({ name });
    setNote(failure ? failure.message : t('shop_added'));
  }

  if (!product) {
    return (
      <div className="page page-form">
        <header className="form-head">
          <BackButton to="/products" />
          <h1>{t('details_title')}</h1>
        </header>
        {loaded ? (
          <Empty
            title={t('not_found_title')}
            text={t('not_found_text')}
            action={
              <Link to="/products" className="btn btn-primary">
                {t('back_products')}
              </Link>
            }
          />
        ) : (
          <p className="muted center">{t('loading')}</p>
        )}
      </div>
    );
  }

  const now = new Date();
  const days = daysUntil(product.expiry_date, now);
  const tone = toneOf(statusOf(days));
  const added = toISO(new Date(product.created_at));
  const progress = shelfProgress(added, product.expiry_date, now);
  const bigLabel = days < 0 ? t('big_expired') : days === 0 ? t('big_today') : t('big_left');

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
      setError(message || t('op_fail'));
      setBusy(false);
    }
  }

  return (
    <div className="page page-form">
      <header className="form-head form-head-between">
        <div className="form-head-start">
          <BackButton to="/products" />
          <h1>{t('details_title')}</h1>
        </div>
        <div className="head-actions">
          <Link to={`/product/${product.id}/edit`} className="round-btn" aria-label={t('edit')}>
            <Icon name="pencil" size={20} />
          </Link>
          <button
            type="button"
            className="round-btn round-btn-danger"
            aria-label={t('delete')}
            onClick={() => setConfirming((value) => !value)}
          >
            <Icon name="trash" size={20} />
          </button>
        </div>
      </header>

      {confirming && (
        <DeleteSheet
          title={product.name}
          hint={t('delete_forever_hint')}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            await purgeProduct(product.name, product.barcode);
            await refresh();
            navigate('/products', { replace: true });
          }}
        />
      )}

      <section className={`hero card accent-${tone}`}>
        <div className="hero-top">
          <Thumb product={product} size={84} />
          <span className="hero-name">
            <strong>{product.name}</strong>
            <span className="chip chip-cat">{categoryLabel(product.category)}</span>
          </span>
        </div>
        <div className={`hero-count tone-${tone}`}>
          <span className="hero-num">{Math.abs(days)}</span>
          <span className="hero-label">{bigLabel}</span>
        </div>
        <div className="progress-wrap">
          <span className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress}%` }} />
          </span>
          <span className="progress-labels">
            <span>{t('added_on', { date: formatDay(added) })}</span>
            <span>{t('ends_on', { date: formatDay(product.expiry_date) })}</span>
          </span>
        </div>
      </section>

      <div className="info-grid">
        <div className="card info">
          <span className="muted small">{t('info_expiry')}</span>
          <strong>{formatFull(product.expiry_date)}</strong>
        </div>
        <div className="card info">
          <span className="muted small">{t('info_qty')}</span>
          <strong>{product.quantity}</strong>
        </div>
      </div>

      <section className="card timeline">
        <h2>{t('timeline_title')}</h2>
        {!settings.notifications_enabled && <p className="muted small">{t('notif_off_note')}</p>}
        {rules.length === 0 && <p className="muted small">{t('no_rules')}</p>}
        {rules.map((daysBefore) => {
          const at = new Date(expiry.y, expiry.m - 1, expiry.d - daysBefore, hours, minutes);
          const past = at.getTime() <= now.getTime();
          return (
            <div className="tl-row" key={daysBefore}>
              <span className={`tl-dot ${past ? 'done' : ''}`}>
                <Icon name={past ? 'check' : 'clock'} size={16} stroke={2.2} />
              </span>
              <span className="tl-name">{daysBefore === 0 ? t('tl_day0') : t('tl_before', { days: daysPhrase(daysBefore) })}</span>
              <span className="muted small">
                {formatDay(addDays(product.expiry_date, -daysBefore))} · {past ? t('tl_past') : t('tl_next')}
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

      {note && (
        <div className="banner banner-mint" role="status">
          {note}
        </div>
      )}

      <div className="actions actions-compact">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void run(() => consumeProduct(product.id, 'used'))}
        >
          <Icon name="check" size={18} stroke={2.2} />
          {t('act_used')}
        </button>
        <button
          type="button"
          className="btn btn-sun"
          disabled={busy}
          onClick={() => void run(() => consumeProduct(product.id, 'discarded'))}
        >
          <Icon name="trash" size={18} />
          {t('act_discard')}
        </button>
      </div>
      <div className="actions actions-compact">
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void addToShopping(product.name)}>
          <Icon name="cart" size={18} />
          {t('add_short')}
        </button>
        <Link to={`/product/${product.id}/edit`} className="btn btn-outline">
          <Icon name="pencil" size={18} />
          {t('edit')}
        </Link>
      </div>
    </div>
  );
}
