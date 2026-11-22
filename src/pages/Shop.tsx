import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { ErrorBanner } from '../components/ui';
import { formatMoneyCur, ltr } from '../lib/money';
import { t } from '../lib/i18n';
import { useInvoices, useShopProducts } from '../lib/shop';

function Tile({ to, icon, title, text, tone }: { to: string; icon: IconName; title: string; text: string; tone: string }) {
  return (
    <Link to={to} className={`shop-tile st-${tone}`}>
      <span className="shop-tile-icon">
        <Icon name={icon} size={26} />
      </span>
      <span className="shop-tile-text">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <Icon name="chevronLeft" size={20} />
    </Link>
  );
}

/** A timestamp as dd/mm/yyyy hh:mm, kept left-to-right. */
export function invoiceDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return ltr(`${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`);
}

/** A yyyy-mm-dd date as dd/mm/yyyy, kept left-to-right. */
export function dayText(day: string): string {
  const [y, m, d] = day.split('-');
  return ltr(`${d}/${m}/${y}`);
}

export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function Shop() {
  const { products, error } = useShopProducts();
  const { invoices, loaded, error: invError } = useInvoices();
  const noPrice = products.filter((p) => p.sell_cents === null).length;

  return (
    <div className="page page-narrow">
      <header className="page-head">
        <h1>{t('shopmgr_title')}</h1>
        <p className="muted">{t('shop_sub')}</p>
      </header>
      <ErrorBanner message={error ?? invError} />

      <div className="shop-stats">
        <span className="chip chip-mint">{t('shop_stat_products', { n: products.length })}</span>
        {noPrice > 0 && <span className="chip chip-peach">{t('shop_stat_noprice', { n: noPrice })}</span>}
      </div>

      <div className="stack-sm">
        <Tile to="/shop/invoice" icon="receipt" tone="sky" title={t('shop_invoice_t')} text={t('shop_invoice_d')} />
        <Tile to="/shop/prices" icon="tag" tone="mint" title={t('shop_price_t')} text={t('shop_price_d')} />
        <Tile to="/shop/receipts" icon="camera" tone="peach" title={t('shop_receipts_t')} text={t('shop_receipts_d')} />
      </div>

      <section className="stack-sm">
        <h2 className="section-title">{t('shop_recent')}</h2>
        {loaded && invoices.length === 0 && <div className="card empty muted">{t('shop_no_invoices')}</div>}
        {invoices.map((inv) => (
          <Link key={inv.id} to={`/shop/invoice/${inv.id}`} className="card inv-row">
            <span className="inv-row-main">
              <strong>{inv.supplier || dayText(inv.invoice_date)}</strong>
              <span className="muted small">
                {inv.supplier ? <>{dayText(inv.invoice_date)} · </> : null}
                {t('inv_items_n', { n: inv.lines })}
              </span>
            </span>
            <strong className="inv-row-total">{formatMoneyCur(inv.total_cents)}</strong>
          </Link>
        ))}
      </section>
    </div>
  );
}
