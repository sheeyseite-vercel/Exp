import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CategoryPicker } from '../components/CategoryPicker';
import { Icon } from '../components/Icon';
import { Empty, ErrorBanner, ProductRow, StatusChip, Thumb, toneOf } from '../components/ui';
import { daysUntil, expiryLine, statusOf } from '../lib/dates';
import { t, type TKey } from '../lib/i18n';
import { normalizeText, productKey } from '../lib/text';
import { catName, categoryLabel } from '../lib/categories';
import type { Product } from '../lib/types';
import { useData } from '../state/DataProvider';

type Filter = 'all' | 'soon' | 'expired' | 'fresh';
const FILTERS: Filter[] = ['all', 'soon', 'expired', 'fresh'];

interface Row {
  product: Product;
  days: number;
}

/** Batches of the same product, nearest expiry first. */
function BatchGroup({ rows }: { rows: Row[] }) {
  const total = rows.reduce((sum, row) => sum + row.product.quantity, 0);
  const first = rows[0];
  return (
    <div className={`card group pr-group pr-${toneOf(statusOf(first.days))}`}>
      <div className="row">
        <Thumb product={first.product} size={52} />
        <span className="row-main">
          <span className="row-name">{first.product.name}</span>
          <span className="row-sub">
            {t('group_batches', { n: rows.length })} · {t('group_total', { n: total })}
          </span>
        </span>
        <StatusChip days={first.days} />
      </div>
      {rows.map(({ product, days }) => (
        <Link key={product.id} to={`/product/${product.id}`} className="batch">
          <span className="batch-date">{expiryLine(product.expiry_date, days)}</span>
          <span className="muted small">{t('row_qty', { n: product.quantity })}</span>
          <StatusChip days={days} />
        </Link>
      ))}
    </div>
  );
}

export default function Products() {
  const { products, loaded, error } = useData();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string | null>(null);

  const requested = params.get('f') as Filter | null;
  const filter: Filter = requested && FILTERS.includes(requested) ? requested : 'all';

  const rows = useMemo<Row[]>(() => {
    const now = new Date();
    return products.map((product) => ({ product, days: daysUntil(product.expiry_date, now) }));
  }, [products]);

  const counts: Record<Filter, number> = {
    all: rows.length,
    soon: rows.filter((r) => r.days >= 0 && r.days <= 7).length,
    expired: rows.filter((r) => r.days < 0).length,
    fresh: rows.filter((r) => r.days > 7).length,
  };

  const needle = normalizeText(query);
  const visible = rows.filter(({ product, days }) => {
    if (filter === 'soon' && !(days >= 0 && days <= 7)) return false;
    if (filter === 'expired' && days >= 0) return false;
    if (filter === 'fresh' && days <= 7) return false;
    if (cat && normalizeText(categoryLabel(product.category)) !== normalizeText(catName(cat))) return false;
    return needle === '' || normalizeText(product.name).includes(needle);
  });

  // Same product bought several times: one card, one line per batch (rows are already sorted by expiry).
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of visible) {
      const key = productKey(row.product);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, filter, query, cat]);

  return (
    <div className="page page-narrow">
      <ErrorBanner message={error} />

      <div className="search-row">
        <label className="search" htmlFor="product-search">
          <Icon name="search" size={20} />
          <input
            id="product-search"
            type="search"
            placeholder={t('products_search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <CategoryPicker filter compact value={cat} onChange={setCat} extra={[...new Set(products.map((p) => p.category))]} />
      </div>

      <div className="filters" role="group" aria-label={t('filters_aria')}>
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            className={`fchip fchip-${item} ${filter === item ? 'active' : ''}`}
            onClick={() => setParams(item === 'all' ? {} : { f: item }, { replace: true })}
          >
            {t(`filter_${item}` as TKey)} {counts[item]}
          </button>
        ))}
      </div>

      <div className="list">
        {groups.map((group) =>
          group.length === 1 ? (
            <ProductRow key={group[0].product.id} product={group[0].product} />
          ) : (
            <BatchGroup key={productKey(group[0].product)} rows={group} />
          ),
        )}
        {visible.length === 0 &&
          (loaded ? (
            rows.length === 0 ? (
              <Empty
                title={t('empty_title')}
                text={t('empty_text')}
                action={
                  <Link to="/scan" className="btn btn-primary">
                    <Icon name="plus" size={20} stroke={2.2} />
                    {t('add_product')}
                  </Link>
                }
              />
            ) : (
              <Empty title={t('no_results_title')} text={t('no_results_text')} />
            )
          ) : (
            <p className="muted center">{t('loading')}</p>
          ))}
      </div>
    </div>
  );
}
