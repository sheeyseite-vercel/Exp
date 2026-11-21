import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PhotoTile } from '../components/PhotoTile';
import { BackButton, Empty, ErrorBanner } from '../components/ui';
import { qtyLabel, useCatalog } from '../lib/catalog';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import type { CatProduct, Unit } from '../lib/types';

export default function ShoppingPick() {
  const { cat } = useParams();
  const navigate = useNavigate();
  const { categories, products, loaded, error } = useCatalog();
  const [selected, setSelected] = useState<CatProduct | null>(null);
  const [unit, setUnit] = useState<Unit>('box');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const category = categories.find((c) => c.id === cat);

  async function add() {
    if (!selected) return;
    const row = { name: selected.name, brand: selected.brand, photo_path: selected.photo_path, unit, qty: unit === 'half' ? 1 : qty };
    const { error: insertError } = await supabase.from('shopping_items').insert(row);
    if (insertError) {
      setFailure(insertError.message);
      return;
    }
    setNote(`${t('pick_added', { name: selected.name })} · ${qtyLabel(row)}`);
    setSelected(null);
    setQty(1);
    setUnit('box');
  }

  // ---- level 1: categories ----------------------------------------------------------------
  if (!cat) {
    return (
      <div className="page page-narrow">
        <header className="form-head">
          <BackButton to="/shopping" />
          <h1>{t('pick_category')}</h1>
        </header>
        <ErrorBanner message={error} />
        {loaded && categories.length === 0 ? (
          <Empty
            title={t('pick_empty')}
            text=""
            action={
              <Link to="/catalog" className="btn btn-primary">
                {t('pick_setup')}
              </Link>
            }
          />
        ) : (
          <div className="pick-grid">
            {categories.map((c, i) => (
              <Link key={c.id} to={`/shopping/add/${c.id}`} className="pick-card">
                <PhotoTile path={c.photo_path} label={c.name} index={i} className="pick-photo" />
                <strong>{c.name}</strong>
                <span className="muted small">
                  {t('prod_count', { n: products.filter((p) => p.category_id === c.id).length })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- level 2: products of one category ----------------------------------------------------
  const list = products.filter((p) => p.category_id === cat);
  return (
    <div className="page page-narrow">
      <header className="form-head">
        <BackButton to="/shopping/add" />
        <h1>{category?.name ?? t('pick_category')}</h1>
      </header>
      <ErrorBanner message={error ?? failure} />
      {note && (
        <div className="banner banner-mint" role="status">
          {note}
        </div>
      )}
      {loaded && list.length === 0 && <Empty title={t('pick_products_empty')} text="" />}
      <div className="pick-grid">
        {list.map((p, i) => (
          <button key={p.id} type="button" className="pick-card" onClick={() => setSelected(p)}>
            <PhotoTile path={p.photo_path} label={p.name} index={i} className="pick-photo" />
            <strong>{p.name}</strong>
            {p.brand && <span className="muted small">{p.brand}</span>}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-soft" onClick={() => navigate('/shopping')}>
        {t('pick_done')}
      </button>

      {selected && (
        <div className="sheet-backdrop" onClick={() => setSelected(null)}>
          <div className="sheet" role="dialog" aria-label={selected.name} onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head">
              <PhotoTile path={selected.photo_path} label={selected.name} className="sheet-photo" />
              <span className="stack-xs">
                <strong>{selected.name}</strong>
                {selected.brand && <span className="muted small">{selected.brand}</span>}
              </span>
              <button type="button" className="shop-del" aria-label={t('cancel')} onClick={() => setSelected(null)}>
                <Icon name="close" size={18} stroke={2.2} />
              </button>
            </div>
            <div className="pills" role="group">
              {(['box', 'half', 'piece'] as Unit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={unit === u}
                  className={`pill ${unit === u ? 'active' : ''}`}
                  onClick={() => setUnit(u)}
                >
                  {t(`unit_${u}` as 'unit_box')}
                </button>
              ))}
            </div>
            {unit !== 'half' && (
              <div className="sheet-qty">
                <button type="button" className="step-btn" aria-label="-" onClick={() => setQty(Math.max(1, qty - 1))}>
                  <Icon name="minus" size={18} stroke={2.4} />
                </button>
                <strong>{qty}</strong>
                <button type="button" className="step-btn" aria-label="+" onClick={() => setQty(Math.min(999, qty + 1))}>
                  <Icon name="plus" size={18} stroke={2.4} />
                </button>
              </div>
            )}
            <button type="button" className="btn btn-primary" onClick={() => void add()}>
              <Icon name="plus" size={18} stroke={2.4} />
              {t('sheet_add')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
