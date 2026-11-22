import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PhotoPick } from '../components/PhotoPick';
import { PhotoTile } from '../components/PhotoTile';
import { BackButton, ErrorBanner } from '../components/ui';
import { qtyLabel, useCatalog } from '../lib/catalog';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import type { CatProduct, Unit } from '../lib/types';

/** Categories and products with photos: pick for the shopping list, or edit them. `manage` opens in edit mode. */
export default function ShoppingPick({ manage = false }: { manage?: boolean }) {
  const { cat } = useParams();
  const navigate = useNavigate();
  const { categories, products, loaded, error, addCategory, setCategoryPhoto, deleteCategory, addProduct, deleteProduct } = useCatalog();
  const [edit, setEdit] = useState(manage);
  const [selected, setSelected] = useState<CatProduct | null>(null);
  const [unit, setUnit] = useState<Unit>('box');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const base = manage ? '/catalog' : '/shopping/add';
  const category = categories.find((c) => c.id === cat);
  const editing = edit;
  const suggestions = t('cat_suggestions')
    .split('|')
    .filter((s) => !categories.some((c) => c.name === s));

  function resetForm() {
    setName('');
    setBrand('');
    setPhoto(null);
  }

  async function addToList() {
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

  const toggle = (
    <button type="button" className={`btn btn-sm ${editing ? 'btn-primary' : 'btn-soft'}`} onClick={() => setEdit(!editing)}>
      {editing ? t('pick_done') : t('pick_manage')}
    </button>
  );

  // ---- level 1: categories ----------------------------------------------------------------
  if (!cat) {
    return (
      <div className="page page-narrow">
        <header className="form-head">
          <BackButton to={manage ? '/profile' : '/shopping'} />
          <h1>{manage ? t('catalog_title') : t('pick_category')}</h1>
          {toggle}
        </header>
        <ErrorBanner message={error} />

        {editing && (
          <>
            <form
              className="cat-form cat-form-col"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!name.trim()) return;
                setBusy(true);
                await addCategory(name);
                setBusy(false);
                resetForm();
              }}
            >
              <input type="text" value={name} maxLength={60} placeholder={t('cat_name_ph')} aria-label={t('cat_name_ph')} onChange={(e) => setName(e.target.value)} />
              <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
                <Icon name="plus" size={18} stroke={2.4} />
                {t('cat_add')}
              </button>
            </form>
            {suggestions.length > 0 && (
              <div className="stack-xs">
                <span className="muted small">{t('cat_suggest')}</span>
                <div className="pills">
                  {suggestions.map((s) => (
                    <button key={s} type="button" className="pill" disabled={busy} onClick={() => void addCategory(s)}>
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {loaded && categories.length === 0 && !editing && (
          <div className="card empty">
            <strong>{t('pick_empty')}</strong>
            <button type="button" className="btn btn-primary" onClick={() => setEdit(true)}>
              {t('pick_new_cat')}
            </button>
          </div>
        )}

        <div className="pick-grid">
          {categories.map((c, i) => (
            <div key={c.id} className="pick-wrap">
              <Link to={`${base}/${c.id}`} className="cat-card">
                <PhotoTile path={c.photo_path} label={c.name} index={i} className="cat-cover" />
                <span className="cat-shade" />
                <span className="cat-info">
                  <strong>{c.name}</strong>
                  <span className="cat-count">{t('prod_count', { n: products.filter((p) => p.category_id === c.id).length })}</span>
                </span>
              </Link>
              {editing && (
                <button
                  type="button"
                  className={`pick-del-btn ${confirm === c.id ? 'armed' : ''}`}
                  aria-label={t('cat_delete')}
                  onClick={async () => {
                    if (confirm !== c.id) {
                      setConfirm(c.id);
                      return;
                    }
                    setConfirm(null);
                    await deleteCategory(c.id);
                  }}
                >
                  <Icon name="trash" size={22} />
                  {confirm === c.id && <span>{t('confirm_word')}</span>}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- level 2: products of one category ----------------------------------------------------
  const list = products.filter((p) => p.category_id === cat);
  return (
    <div className="page page-narrow">
      <header className="form-head">
        <BackButton to={base} />
        <h1>{category?.name ?? t('pick_category')}</h1>
        {toggle}
      </header>
      <ErrorBanner message={error ?? failure} />
      {note && !editing && (
        <div className="banner banner-mint" role="status">
          {note}
        </div>
      )}

      {editing && category && (
        <div className="card cover-edit">
          <PhotoTile path={category.photo_path} label={category.name} className="cover-thumb" />
          <div className="cover-edit-body">
            <strong>{t('cat_photo')}</strong>
            <PhotoPick
              file={null}
              onFile={async (blob) => {
                if (!blob) return;
                setCoverBusy(true);
                await setCategoryPhoto(category.id, blob);
                setCoverBusy(false);
              }}
            />
            {coverBusy && <span className="muted small">{t('loading')}</span>}
          </div>
        </div>
      )}

      {editing && (
        <form
          className="cat-form cat-form-col"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim()) return;
            setBusy(true);
            await addProduct(cat, name, brand, photo);
            setBusy(false);
            resetForm();
          }}
        >
          <input type="text" value={name} maxLength={120} placeholder={t('prod_name_ph')} aria-label={t('prod_name_ph')} onChange={(e) => setName(e.target.value)} />
          <input type="text" value={brand} maxLength={60} placeholder={t('prod_brand_ph')} aria-label={t('prod_brand_ph')} onChange={(e) => setBrand(e.target.value)} />
          <PhotoPick file={photo} onFile={setPhoto} />
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            <Icon name="plus" size={18} stroke={2.4} />
            {t('add_product')}
          </button>
        </form>
      )}

      {loaded && list.length === 0 && !editing && (
        <div className="card empty">
          <strong>{t('pick_products_empty')}</strong>
          <button type="button" className="btn btn-primary" onClick={() => setEdit(true)}>
            {t('pick_new_prod')}
          </button>
        </div>
      )}

      <div className="pick-grid">
        {list.map((p, i) => (
          <div key={p.id} className="pick-wrap">
            <button type="button" className="pick-card" onClick={() => (editing ? undefined : setSelected(p))}>
              <PhotoTile path={p.photo_path} label={p.name} index={i} className="pick-photo" />
              <strong>{p.name}</strong>
              {p.brand && <span className="muted small">{p.brand}</span>}
            </button>
            {editing && (
              <button
                type="button"
                className={`pick-del-btn ${confirm === p.id ? 'armed' : ''}`}
                aria-label={t('delete')}
                onClick={async () => {
                  if (confirm !== p.id) {
                    setConfirm(p.id);
                    return;
                  }
                  setConfirm(null);
                  await deleteProduct(p.id);
                }}
              >
                <Icon name="trash" size={22} />
                {confirm === p.id && <span>{t('confirm_word')}</span>}
              </button>
            )}
          </div>
        ))}
      </div>

      {editing ? (
        <button
          type="button"
          className="btn btn-danger-soft"
          onClick={async () => {
            if (confirm !== 'cat') {
              setConfirm('cat');
              return;
            }
            await deleteCategory(cat);
            navigate(base, { replace: true });
          }}
        >
          <Icon name="trash" size={18} />
          {confirm === 'cat' ? t('confirm_word') : t('cat_delete')}
        </button>
      ) : (
        !manage && (
          <button type="button" className="btn btn-soft" onClick={() => navigate('/shopping')}>
            {t('pick_done')}
          </button>
        )
      )}

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
                <button key={u} type="button" aria-pressed={unit === u} className={`pill ${unit === u ? 'active' : ''}`} onClick={() => setUnit(u)}>
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
            <button type="button" className="btn btn-primary" onClick={() => void addToList()}>
              <Icon name="plus" size={18} stroke={2.4} />
              {t('sheet_add')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
