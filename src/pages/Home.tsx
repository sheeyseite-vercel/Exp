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
    <Link to={to} className={`hm-tile hm-${tone}`}>
      <span className="hm-ic">
        <Icon name={icon} size={24} />
      </span>
      <strong>{label}</strong>
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
      <span className="muted small">{formatToday(new Date())}</span>

      <header className="home-greet">
        <h1>{t('home_title')}</h1>
        <p>{t('home_text')}</p>
      </header>

      <Link to="/scan" className="hm-add">
        <span className="hm-add-ic">
          <Icon name="plus" size={26} stroke={2.4} />
        </span>
        <span className="hm-add-text">
          <strong>{t('home_cta')}</strong>
          <small>{t('home_cta_hint')}</small>
        </span>
        <Icon name="chevronLeft" size={20} />
      </Link>

      {(soon > 0 || expired > 0) && (
        <div className="hm-alerts">
          {soon > 0 && (
            <Link to="/products?f=soon" className="chip chip-peach">
              {t('filter_soon')} {soon}
            </Link>
          )}
          {expired > 0 && (
            <Link to="/products?f=expired" className="chip chip-rose">
              {t('filter_expired')} {expired}
            </Link>
          )}
        </div>
      )}

      <div className="hm-grid">
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
