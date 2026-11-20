import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Empty, ErrorBanner, ProductRow } from '../components/ui';
import { daysUntil } from '../lib/dates';
import { useData } from '../state/DataProvider';

type Filter = 'all' | 'soon' | 'expired' | 'fresh';
const FILTERS: Filter[] = ['all', 'soon', 'expired', 'fresh'];
const LABELS: Record<Filter, string> = { all: 'الكل', soon: 'قريبًا', expired: 'منتهية', fresh: 'صالحة' };

/** Makes Arabic search forgiving: ignores diacritics and common letter variants. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

export default function Products() {
  const { products, loaded, error } = useData();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');

  const requested = params.get('f') as Filter | null;
  const filter: Filter = requested && FILTERS.includes(requested) ? requested : 'all';

  const rows = useMemo(() => {
    const now = new Date();
    return products.map((product) => ({ product, days: daysUntil(product.expiry_date, now) }));
  }, [products]);

  const counts: Record<Filter, number> = {
    all: rows.length,
    soon: rows.filter((r) => r.days >= 0 && r.days <= 7).length,
    expired: rows.filter((r) => r.days < 0).length,
    fresh: rows.filter((r) => r.days > 7).length,
  };

  const needle = normalize(query.trim());
  const visible = rows.filter(({ product, days }) => {
    if (filter === 'soon' && !(days >= 0 && days <= 7)) return false;
    if (filter === 'expired' && days >= 0) return false;
    if (filter === 'fresh' && days <= 7) return false;
    return needle === '' || normalize(product.name).includes(needle);
  });

  return (
    <div className="page page-narrow">
      <header className="page-head page-head-base">
        <h1>منتجاتي</h1>
        <span className="muted">{counts.all} منتجًا</span>
      </header>

      <ErrorBanner message={error} />

      <label className="search" htmlFor="product-search">
        <Icon name="search" size={20} />
        <input
          id="product-search"
          type="search"
          placeholder="ابحث عن منتج"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="filters" role="group" aria-label="تصفية المنتجات">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            className={`fchip fchip-${item} ${filter === item ? 'active' : ''}`}
            onClick={() => setParams(item === 'all' ? {} : { f: item }, { replace: true })}
          >
            {LABELS[item]} {counts[item]}
          </button>
        ))}
      </div>

      <div className="list">
        {visible.map(({ product }) => (
          <ProductRow key={product.id} product={product} />
        ))}
        {visible.length === 0 &&
          (loaded ? (
            rows.length === 0 ? (
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
              <Empty title="لا توجد نتائج" text="جرّب كلمة أخرى أو غيّر التصفية." />
            )
          ) : (
            <p className="muted center">جارٍ التحميل…</p>
          ))}
      </div>
    </div>
  );
}
