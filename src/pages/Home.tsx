import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Empty, ErrorBanner, ProductRow } from '../components/ui';
import { daysUntil, formatToday } from '../lib/dates';
import { describeRules } from '../lib/planner';
import { useData } from '../state/DataProvider';

function firstName(user: { user_metadata?: Record<string, unknown> } | null): string | null {
  const full = (user?.user_metadata?.full_name ?? user?.user_metadata?.name) as string | undefined;
  return full?.trim().split(/\s+/)[0] || null;
}

export default function Home() {
  const { products, settings, user, loaded, error } = useData();
  const now = new Date();
  const days = products.map((p) => daysUntil(p.expiry_date, now));
  const soon = days.filter((d) => d >= 0 && d <= 7).length;
  const expired = days.filter((d) => d < 0).length;
  const fresh = days.filter((d) => d > 7).length;
  const nearest = products.slice(0, 3);
  const name = firstName(user);
  const rules = describeRules(settings);

  return (
    <div className="page page-home">
      <header className="page-head">
        <div>
          <span className="muted small">{formatToday(now)}</span>
          <h1>{name ? `مرحبًا ${name}` : 'مرحبًا بك'}</h1>
        </div>
        <Link to="/alerts" className="round-btn bell" aria-label="التنبيهات">
          <Icon name="bell" size={22} />
          {soon + expired > 0 && <span className="dot" />}
        </Link>
      </header>

      <ErrorBanner message={error} />

      <section className="home-grid">
        <Link to="/products?f=soon" className="tile tone-peach t-soon">
          <span className="tile-label">تنتهي خلال 7 أيام</span>
          <span className="tile-num tile-num-xl">{soon}</span>
          <span className="tile-link">
            عرض المنتجات <Icon name="chevronLeft" size={16} stroke={2} />
          </span>
        </Link>
        <Link to="/products?f=expired" className="tile tone-rose t-expired">
          <span className="tile-label">منتهية الصلاحية</span>
          <span className="tile-num">{expired}</span>
        </Link>
        <Link to="/products?f=fresh" className="tile tone-mint t-fresh">
          <span className="tile-label">صالحة</span>
          <span className="tile-num">{fresh}</span>
        </Link>

        <section className="card t-near">
          <div className="card-head">
            <h2>الأقرب انتهاءً</h2>
            <Link to="/products" className="link">
              عرض الكل
            </Link>
          </div>
          {nearest.length > 0 ? (
            nearest.map((product) => <ProductRow key={product.id} product={product} compact />)
          ) : loaded ? (
            <Empty
              title="لا توجد منتجات بعد"
              text="أضف أول منتج بالمسح أو يدويًا وسنتتبّع صلاحيته."
              action={
                <Link to="/scan" className="btn btn-primary">
                  <Icon name="plus" size={20} stroke={2.2} />
                  إضافة منتج
                </Link>
              }
            />
          ) : (
            <p className="muted small">جارٍ التحميل…</p>
          )}
        </section>

        <Link to="/alerts" className="tile tone-sky t-alerts">
          <Icon name="bell" size={22} />
          <span className="tile-label">{settings.notifications_enabled ? `تنبيه ${rules}` : rules}</span>
        </Link>
        <Link to="/scan" className="tile tone-lilac t-scan">
          <Icon name="scan" size={22} />
          <span className="tile-label">أضف منتجًا بالمسح</span>
        </Link>
      </section>
    </div>
  );
}
