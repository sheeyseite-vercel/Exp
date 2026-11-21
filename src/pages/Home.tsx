import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { formatToday } from '../lib/dates';
import { t, type TKey } from '../lib/i18n';

const FEATURES: { icon: IconName; tone: string; title: TKey; text: TKey }[] = [
  { icon: 'scan', tone: 'lilac', title: 'feat_scan_t', text: 'feat_scan_d' },
  { icon: 'camera', tone: 'sky', title: 'feat_photo_t', text: 'feat_photo_d' },
  { icon: 'pencil', tone: 'peach', title: 'feat_manual_t', text: 'feat_manual_d' },
  { icon: 'layers', tone: 'mint', title: 'feat_batches_t', text: 'feat_batches_d' },
  { icon: 'bell', tone: 'rose', title: 'feat_alerts_t', text: 'feat_alerts_d' },
  { icon: 'cloud', tone: 'sky', title: 'feat_sync_t', text: 'feat_sync_d' },
];

export default function Home() {
  return (
    <div className="page page-home">
      <span className="muted small">{formatToday(new Date())}</span>

      <section className="hero-home">
        <span className="hero-star" aria-hidden="true">
          <Icon name="star" size={150} />
        </span>
        <span className="logo">
          <Icon name="star" size={26} />
        </span>
        <h1>{t('home_title')}</h1>
        <p>{t('home_text')}</p>
        <div className="hero-actions">
          <Link to="/scan" className="btn btn-primary">
            <Icon name="plus" size={18} stroke={2.2} />
            {t('home_cta')}
          </Link>
          <Link to="/products" className="hero-link">
            {t('home_products')}
            <Icon name="chevronLeft" size={16} stroke={2.4} />
          </Link>
        </div>
      </section>

      <span className="section-label">{t('home_features')}</span>
      <section className="feature-list card">
        {FEATURES.map((feature) => (
          <article key={feature.title} className={`frow tone-${feature.tone}`}>
            <span className="feature-icon">
              <Icon name={feature.icon} size={22} />
            </span>
            <span className="frow-text">
              <h2>{t(feature.title)}</h2>
              <p>{t(feature.text)}</p>
            </span>
          </article>
        ))}
      </section>
    </div>
  );
}
