import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PhotoPick } from '../components/PhotoPick';
import { PhotoTile } from '../components/PhotoTile';
import { BackButton, ErrorBanner } from '../components/ui';
import { useCatalog } from '../lib/catalog';
import { cutoutProduct } from '../lib/cutout';
import { t } from '../lib/i18n';
import { centsToInput, formatMoneyCur, formatPercentTenths, formatQty, margin, parseMoney } from '../lib/money';
import { scanBarcodeText } from '../lib/scanner';
import {
  errText,
  findProductByBarcode,
  removeStoredPhoto,
  uploadProductPhoto,
  useShopProducts,
  type ShopProduct,
} from '../lib/shop';
import { usePhotoUrl } from '../state/usePhotoUrl';

const TONES = ['sky', 'mint', 'sun', 'rose'];

function ProductPhoto({ path, name, index = 0 }: { path: string | null; name: string; index?: number }) {
  const url = usePhotoUrl(path);
  return (
    <span className={`pp-photo pp-tone-${TONES[index % TONES.length]}`}>
      {url ? <img src={url} alt="" /> : <span className="pp-letter">{name.trim().charAt(0)}</span>}
    </span>
  );
}

function Suggestion({ p, q, onPick }: { p: ShopProduct; q: string; onPick: () => void }) {
  const starts = p.name.toLowerCase().startsWith(q.toLowerCase());
  return (
    <button type="button" className="sg-row" onClick={onPick}>
      <Icon name="search" size={18} />
      <span className="sg-text">
        {starts ? (
          <>
            <span>{p.name.slice(0, q.length)}</span>
            <b>{p.name.slice(q.length)}</b>
          </>
        ) : (
          <b>{p.name}</b>
        )}
      </span>
      {p.sell_cents !== null && <small>{formatMoneyCur(p.sell_cents)}</small>}
    </button>
  );
}

/** Selling prices: categories → products, search by name (suggestions as you type) or barcode. */
export default function ShopPrices() {
  const { cat } = useParams();
  const navigate = useNavigate();
  const { products, loaded, error, saveProduct, createProduct, deleteProduct } = useShopProducts();
  const { categories } = useCatalog();
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState<ShopProduct | null>(null);
  const [sell, setSell] = useState('');
  const [catId, setCatId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cutting, setCutting] = useState(false);
  const [noCut, setNoCut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [unknown, setUnknown] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCost, setNewCost] = useState('');
  const [armed, setArmed] = useState(false);
  const savedUrl = usePhotoUrl(selected?.photo_path ?? null);

  useEffect(() => {
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const q = query.trim();
  const suggestions = useMemo(() => {
    if (!q) return [];
    const low = q.toLowerCase();
    const starts = products.filter((p) => p.name.toLowerCase().startsWith(low));
    const rest = products.filter((p) => !p.name.toLowerCase().startsWith(low) && p.name.toLowerCase().includes(low));
    return [...starts, ...rest].slice(0, 8);
  }, [products, q]);

  function open(p: ShopProduct) {
    setSelected(p);
    setSell(p.sell_cents === null ? '' : centsToInput(p.sell_cents));
    setCatId(p.category_id);
    setPhoto(null);
    setNoCut(false);
    setUnknown(null);
    setFailure(null);
    setNote(null);
    setArmed(false);
    setQuery('');
  }

  function close() {
    setSelected(null);
    setPhoto(null);
  }

  async function searchBarcode(raw: string) {
    const c = raw.trim();
    if (!c) return;
    setNote(null);
    setFailure(null);
    try {
      const found = await findProductByBarcode(c);
      if (found) {
        open(found);
        setCode('');
      } else {
        setUnknown(c);
        setNewName('');
        setNewCost('');
      }
    } catch (e) {
      setFailure(errText(e));
    }
  }

  async function scan() {
    setFailure(null);
    try {
      const text = await scanBarcodeText();
      if (text) {
        setCode(text);
        await searchBarcode(text);
      }
    } catch (e) {
      setFailure(errText(e));
    }
  }

  async function onPhoto(file: Blob | null) {
    if (!file) return;
    setCutting(true);
    setNoCut(false);
    try {
      const result = await cutoutProduct(file);
      setPhoto(result.blob);
      setNoCut(!result.cutout);
    } catch (e) {
      setFailure(errText(e));
    } finally {
      setCutting(false);
    }
  }

  const sellCents = sell.trim() ? parseMoney(sell) : null;
  const sellInvalid = sell.trim() !== '' && sellCents === null;
  const m = selected && sellCents !== null ? margin(selected.cost_cents, sellCents) : null;

  async function save() {
    if (!selected || sellInvalid || cutting) return;
    setBusy(true);
    try {
      const patch: { sell_cents: number | null; category_id: string | null; photo_path?: string } = {
        sell_cents: sellCents,
        category_id: catId,
      };
      let oldPhoto: string | null = null;
      if (photo) {
        patch.photo_path = await uploadProductPhoto(photo);
        oldPhoto = selected.photo_path;
      }
      await saveProduct(selected.id, patch);
      if (oldPhoto) await removeStoredPhoto(oldPhoto);
      setNote(t('price_saved'));
      close();
    } catch (e) {
      setFailure(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    const cost = parseMoney(newCost);
    if (!unknown || !newName.trim() || cost === null) {
      setFailure(t('inv_bad_price'));
      return;
    }
    try {
      const p = await createProduct(newName, unknown, cost);
      setCode('');
      open(p);
    } catch (e) {
      setFailure(errText(e));
    }
  }

  async function remove() {
    if (!selected) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    try {
      const old = selected.photo_path;
      await deleteProduct(selected.id);
      await removeStoredPhoto(old);
      close();
    } catch (e) {
      setFailure(errText(e));
    }
  }

  // ---- shared: search + editor ------------------------------------------------------------
  const noneCount = products.filter((p) => !p.category_id || !categories.some((c) => c.id === p.category_id)).length;
  const inCategory = (id: string) => products.filter((p) => p.category_id === id);
  const category = categories.find((c) => c.id === cat);
  const list = cat === 'none' ? products.filter((p) => !p.category_id || !categories.some((c) => c.id === p.category_id)) : cat ? inCategory(cat) : [];

  const search = (
    <>
      <div className="sg-wrap">
        <label className="sg-box">
          <Icon name="search" size={20} />
          <input
            type="search"
            enterKeyHint="search"
            placeholder={t('price_search_name')}
            aria-label={t('price_search_name')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && suggestions[0]) {
                e.preventDefault();
                open(suggestions[0]);
              }
            }}
          />
          {query && (
            <button type="button" className="sg-clear" aria-label={t('close')} onClick={() => setQuery('')}>
              <Icon name="close" size={16} stroke={2.2} />
            </button>
          )}
        </label>
        {q && (
          <div className="sg-list">
            {suggestions.length === 0 ? (
              <span className="sg-none muted">{t('price_no_match')}</span>
            ) : (
              suggestions.map((p) => <Suggestion key={p.id} p={p} q={q} onPick={() => open(p)} />)
            )}
          </div>
        )}
      </div>

      <div className="bc-line">
        <Icon name="scan" size={20} />
        <input
          type="text"
          inputMode="numeric"
          enterKeyHint="search"
          placeholder={t('price_search_code')}
          aria-label={t('price_search_code')}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setUnknown(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void searchBarcode(code);
            }
          }}
        />
        <button type="button" className="bc-scan" aria-label={t('price_scan')} onClick={() => void scan()}>
          {t('price_scan')}
        </button>
      </div>

      {unknown && (
        <div className="card inv-form">
          <strong>{t('price_unknown')}</strong>
          <span className="muted small">
            {t('price_code')}: {unknown}
          </span>
          <input type="text" placeholder={t('inv_name')} aria-label={t('inv_name')} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input
            type="text"
            inputMode="decimal"
            placeholder={t('price_cost')}
            aria-label={t('price_cost')}
            value={newCost}
            onChange={(e) => setNewCost(e.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={() => void create()}>
            {t('price_create')}
          </button>
        </div>
      )}
    </>
  );

  const editor = selected && (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet sheet-tall" role="dialog" aria-label={selected.name} onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <span className="stack-xs">
            <strong>{selected.name}</strong>
            <span className="muted small">
              {t('price_code')}: {selected.barcode ?? '—'}
            </span>
          </span>
          <button type="button" className="shop-del" aria-label={t('cancel')} onClick={close}>
            <Icon name="close" size={18} stroke={2.2} />
          </button>
        </div>

        <div className="pp-edit-photo">
          <span className="pp-photo pp-tone-sky pp-big">
            {cutting ? (
              <span className="pp-busy">{t('price_cutting')}</span>
            ) : photoUrl || savedUrl ? (
              <img src={photoUrl ?? savedUrl ?? ''} alt="" />
            ) : (
              <span className="pp-letter">{selected.name.trim().charAt(0)}</span>
            )}
          </span>
          <div className="pp-edit-side">
            <strong>{t('price_photo')}</strong>
            <PhotoPick file={photo} onFile={onPhoto} />
            <span className="muted small">{noCut ? t('price_nocut') : t('price_photo_hint')}</span>
          </div>
        </div>

        <div className="ps-stats">
          <span className="ps-stat ps-blue">
            <small>{t('price_cost')}</small>
            <strong>{formatMoneyCur(selected.cost_cents)}</strong>
          </span>
          <span className="ps-stat ps-green">
            <small>{t('price_stock_label')}</small>
            <strong>{formatQty(selected.stock_milli)}</strong>
          </span>
        </div>

        <label className="field ps-field">
          <span className="field-label">{t('price_sell')}</span>
          <span className="money-input">
            <input
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="0.00"
              value={sell}
              aria-invalid={sellInvalid}
              onChange={(e) => setSell(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void save();
                }
              }}
            />
            <em>DA</em>
          </span>
        </label>
        {sellInvalid && <span className="form-error">{t('price_bad')}</span>}
        {m && (
          <span className={`inv-diff ${m.profit >= 0 ? 'inv-diff-ok' : 'inv-diff-bad'}`}>
            {t(m.profit >= 0 ? 'price_profit' : 'price_loss', {
              p: formatMoneyCur(Math.abs(m.profit)),
              pc: m.percentTenths === null ? '—' : formatPercentTenths(Math.abs(m.percentTenths)),
            })}
          </span>
        )}

        <div className="stack-xs">
          <span className="field-label">{t('price_category')}</span>
          <div className="pills" role="group">
            <button type="button" className={`pill ${catId === null ? 'active' : ''}`} aria-pressed={catId === null} onClick={() => setCatId(null)}>
              {t('price_uncat')}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`pill ${catId === c.id ? 'active' : ''}`}
                aria-pressed={catId === c.id}
                onClick={() => setCatId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="btn btn-primary" disabled={sellInvalid || busy || cutting} onClick={() => void save()}>
          <Icon name="check" size={18} stroke={2.4} />
          {t('price_save')}
        </button>
        <button type="button" className={`btn ${armed ? 'btn-danger' : 'btn-danger-soft'}`} onClick={() => void remove()}>
          <Icon name="trash" size={20} />
          {armed ? t('confirm_word') : t('price_delete')}
        </button>
      </div>
    </div>
  );

  // ---- level 2: products of a category ---------------------------------------------------------
  if (cat) {
    return (
      <div className="page page-narrow">
        <header className="form-head">
          <BackButton to="/shop/prices" />
          <h1>{cat === 'none' ? t('price_uncat') : (category?.name ?? t('shop_price_t'))}</h1>
        </header>
        <ErrorBanner message={error ?? failure} />
        {note && (
          <div className="banner banner-mint" role="status">
            {note}
          </div>
        )}
        {loaded && list.length === 0 && <div className="card empty muted">{t('price_cat_empty')}</div>}
        <div className="pp-grid">
          {list.map((p, i) => (
            <button key={p.id} type="button" className="pp-card" onClick={() => open(p)}>
              <ProductPhoto path={p.photo_path} name={p.name} index={i} />
              <strong className="pp-name">{p.name}</strong>
              {p.sell_cents === null ? (
                <span className="pp-set">{t('price_set')}</span>
              ) : (
                <span className="pp-price">{formatMoneyCur(p.sell_cents)}</span>
              )}
            </button>
          ))}
        </div>
        {editor}
      </div>
    );
  }

  // ---- level 1: search + categories ------------------------------------------------------------
  return (
    <div className="page page-narrow">
      <header className="form-head">
        <BackButton to="/shop" />
        <h1>{t('shop_price_t')}</h1>
      </header>
      <ErrorBanner message={error ?? failure} />
      {note && (
        <div className="banner banner-mint" role="status">
          {note}
        </div>
      )}
      {search}

      {loaded && products.length === 0 && <div className="card empty muted">{t('price_empty')}</div>}

      <div className="pick-grid">
        {categories.map((c, i) => (
          <Link key={c.id} to={`/shop/prices/${c.id}`} className="cat-card">
            <PhotoTile path={c.photo_path} label={c.name} index={i} className="cat-cover" />
            <span className="cat-shade" />
            <span className="cat-info">
              <strong>{c.name}</strong>
              <span className="cat-count">{t('prod_count', { n: inCategory(c.id).length })}</span>
            </span>
          </Link>
        ))}
        {noneCount > 0 && (
          <Link to="/shop/prices/none" className="cat-card">
            <PhotoTile path={null} label={t('price_uncat')} index={categories.length} className="cat-cover" />
            <span className="cat-shade" />
            <span className="cat-info">
              <strong>{t('price_uncat')}</strong>
              <span className="cat-count">{t('prod_count', { n: noneCount })}</span>
            </span>
          </Link>
        )}
      </div>

      <button type="button" className="btn btn-soft" onClick={() => navigate('/catalog')}>
        <Icon name="layers" size={18} />
        {t('catalog_title')}
      </button>
      {editor}
    </div>
  );
}
