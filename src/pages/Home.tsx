import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { formatToday, daysUntil } from '../lib/dates';
import { t, type TKey } from '../lib/i18n';
import { useData } from '../state/DataProvider';

const FEATURES: { icon: IconName; tone: string; title: TKey; text: TKey }[] = [
  { icon: 'scan', tone: 'lilac', title: 'feat_scan_t', text: 'feat_scan_d' },
  { icon: 'camera', tone: 'sky', title: 'feat_photo_t', text: 'feat_photo_d' },
  { icon: 'layers', tone: 'mint', title: 'feat_batches_t', text: 'feat_batches_d' },
  { icon: 'bell', tone: 'rose', title: 'feat_alerts_t', text: 'feat_alerts_d' },
  { icon: 'cloud', tone: 'sky', title: 'feat_sync_t', text: 'feat_sync_d' },
];

function Tile({ to, icon, label, tone }: { to: string; icon: IconName; label: string; tone: string }) {
  return (
    <Link to={to} className={`hm-row hm-${tone}`}>
      <span className="hm-ic">
        <Icon name={icon} size={22} />
      </span>
      <strong>{label}</strong>
      <Icon name="chevronLeft" size={18} />
    </Link>
  );
}

export default function Home() {
  const { products } = useData();
  const days = products.map((p) => daysUntil(p.expiry_date));
  const soon = days.filter((d) => d >= 0 && d <= 7).length;
  const expired = days.filter((d) => d < 0).length;

  return (
    <div className="page page-home">
      <header className="hm-top">
        <span className="hm-date">{formatToday(new Date())}</span>
        <h1>{t('home_title')}</h1>
      </header>

      <section className="hm-hero">
        <span className="hm-orb hm-orb-a" />
        <span className="hm-orb hm-orb-b" />
        <p>{t('home_text')}</p>
        <div className="hm-stats">
          <Link to="/products" className="hm-stat">
            <strong>{products.length}</strong>
            <span>{t('nav_products')}</span>
          </Link>
          <Link to="/products?f=soon" className="hm-stat hm-stat-soon">
            <strong>{soon}</strong>
            <span>{t('filter_soon')}</span>
          </Link>
          <Link to="/products?f=expired" className="hm-stat hm-stat-exp">
            <strong>{expired}</strong>
            <span>{t('filter_expired')}</span>
          </Link>
        </div>
        <Link to="/scan" className="hm-cta">
          <Icon name="plus" size={20} stroke={2.6} />
          <span>{t('home_cta')}</span>
        </Link>
      </section>

      <div className="hm-list">
        <Tile to="/shopping" icon="cart" label={t('shop_title')} tone="blue" />
        <Tile to="/catalog" icon="layers" label={t('cat_section')} tone="green" />
        <Tile to="/trash" icon="trash" label={t('trash_title')} tone="sun" />
      </div>

      <span className="section-label">{t('home_features')}</span>
      <div className="hm-feats card">
        {FEATURES.map((f, i) => (
          <article key={f.title} className="hm-feat">
            <span className={`hm-feat-ic tone-${f.tone}`}>
              <Icon name={f.icon} size={20} />
            </span>
            <span className="hm-feat-t">
              <strong>{t(f.title)}</strong>
              <span>{t(f.text)}</span>
            </span>
            <span className="hm-feat-n">{i + 1}</span>
          </article>
        ))}
      </div>
    </div>
  );
}
