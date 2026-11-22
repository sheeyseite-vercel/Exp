import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { categoryIcon } from '../lib/categories';
import { chipLabel, daysUntil, expiryLine, statusOf, type Status } from '../lib/dates';
import { t } from '../lib/i18n';
import type { Product } from '../lib/types';
import { usePhotoUrl } from '../state/usePhotoUrl';
import { Icon } from './Icon';

export function toneOf(status: Status): 'rose' | 'peach' | 'mint' {
  if (status === 'expired' || status === 'urgent') return 'rose';
  if (status === 'soon') return 'peach';
  return 'mint';
}

export function StatusChip({ days }: { days: number }) {
  const status = statusOf(days);
  const className = status === 'expired' ? 'chip chip-expired' : `chip chip-${toneOf(status)}`;
  return <span className={className}>{chipLabel(days)}</span>;
}

export function Thumb({ product, size = 52 }: { product: Product; size?: number }) {
  const url = usePhotoUrl(product.photo_path);
  const tone = toneOf(statusOf(daysUntil(product.expiry_date)));
  return (
    <span className={`thumb tone-${tone} ${product.photo_path?.endsWith('.png') ? 'thumb-cut' : ''}`} style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" /> : <Icon name={categoryIcon(product.category)} size={Math.round(size * 0.46)} />}
    </span>
  );
}

export function ProductRow({ product, compact = false }: { product: Product; compact?: boolean }) {
  const days = daysUntil(product.expiry_date);
  const tone = toneOf(statusOf(days));
  return (
    <Link to={`/product/${product.id}`} className={compact ? 'row row-compact' : `row card accent accent-${tone}`}>
      <Thumb product={product} size={compact ? 42 : 52} />
      <span className="row-main">
        <span className="row-name">{product.name}</span>
        <span className="row-sub">
          {expiryLine(product.expiry_date, days)}
          {compact ? '' : ` · ${t('row_qty', { n: product.quantity })}`}
        </span>
      </span>
      <StatusChip days={days} />
    </Link>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  tone = 'primary',
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  tone?: 'primary' | 'light';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`switch ${checked ? 'on' : ''} ${tone === 'light' ? 'switch-light' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="knob" />
    </button>
  );
}

export function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="round-btn"
      aria-label={t('back')}
      onClick={() => (to ? navigate(to) : navigate(-1))}
    >
      <Icon name="chevronRight" size={22} stroke={1.9} />
    </button>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card empty">
      <span className="empty-icon">
        <Icon name="calendarCheck" size={28} />
      </span>
      <strong>{title}</strong>
      <span className="muted">{text}</span>
      {action}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="banner banner-rose" role="alert">
      {message}
    </div>
  );
}
