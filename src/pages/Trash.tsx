import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DeleteSheet } from '../components/DeleteSheet';
import { Icon } from '../components/Icon';
import { LongPress } from '../components/LongPress';
import { PhotoTile } from '../components/PhotoTile';
import { BackButton, ErrorBanner } from '../components/ui';
import { catName } from '../lib/categories';
import { useCatalog } from '../lib/catalog';
import { t } from '../lib/i18n';
import { scanBarcodeText } from '../lib/scanner';
import { errText, findProductByBarcode, useShopProducts } from '../lib/shop';
import { supabase } from '../lib/supabase';
import { normalizeText } from '../lib/text';
import { prefetchPhotos } from '../state/usePhotoUrl';
import { dayText } from './Shop';

interface Item {
  key: string;
  name: string;
  photo_path: string | null;
  category_id: string | null;
}

interface Discard {
  id: string;
  name: string;
  photo_path: string | null;
  quantity: number;
  created_at: string;
}

/** Records products thrown away: pick the product (by category, name or barcode), then how many. */
export default function Trash() {
  const { cat } = useParams();
  const { categories, products: catalog, loaded } = useCatalog();
  const { products: shop } = useShopProducts();
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [chosen, setChosen] = useState<Item | null>(null);
  const [qty, setQty] = useState('1');
  const [log, setLog] = useState<Discard[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [del, setDel] = useState<Discard | null>(null);

  const items = useMemo<Item[]>(() => {
    const map = new Map<string, Item>();
    for (const p of catalog) map.set(normalizeText(p.name), { key: `c${p.id}`, name: p.name, photo_path: p.photo_path, category_id: p.category_id });
    for (const p of shop) {
      const k = normalizeText(p.name);
      const prev = map.get(k);
      if (prev) map.set(k, { ...prev, photo_path: prev.photo_path ?? p.photo_path, category_id: prev.category_id ?? p.category_id });
      else map.set(k, { key: `s${p.id}`, name: p.name, photo_path: p.photo_path, category_id: p.category_id });
    }
    return [...map.values()];
  }, [catalog, shop]);

  const reloadLog = useCallback(async () => {
    const { data, error } = await supabase
      .from('discards')
      .select('id,name,photo_path,quantity,created_at')
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) setFailure(error.message);
    else setLog(data as Discard[]);
  }, []);

  useEffect(() => {
    void reloadLog();
  }, [reloadLog]);

  useEffect(() => prefetchPhotos(items.map((i) => i.photo_path)), [items]);

  const needle = normalizeText(query);
  const found = needle ? items.filter((i) => normalizeText(i.name).includes(needle)).slice(0, 12) : [];
  const category = categories.find((c) => c.id === cat);
  const list = cat ? items.filter((i) => i.category_id === cat) : [];
  const noneCount = items.filter((i) => !i.category_id || !categories.some((c) => c.id === i.category_id)).length;

  async function searchCode(raw: string) {
    const c = raw.trim();
    if (!c) return;
    try {
      const p = await findProductByBarcode(c);
      if (p) {
        setChosen({ key: `s${p.id}`, name: p.name, photo_path: p.photo_path, category_id: p.category_id });
        setQty('1');
        setCode('');
      } else setFailure(t('price_no_match'));
    } catch (e) {
      setFailure(errText(e));
    }
  }

  async function save() {
    const n = Number.parseInt(qty, 10);
    if (!chosen || !Number.isFinite(n) || n < 1) return;
    const { error } = await supabase.from('discards').insert({ name: chosen.name, photo_path: chosen.photo_path, quantity: Math.min(9999, n) });
    if (error) {
      setFailure(error.message);
      return;
    }
    setNote(t('trash_saved', { n, name: chosen.name }));
    setChosen(null);
    void reloadLog();
  }

  const header = (
    <header className="form-head">
      <BackButton to={cat ? '/trash' : '/'} />
      <h1>{cat ? (cat === 'none' ? t('price_uncat') : category ? catName(category.name) : t('trash_title')) : t('trash_title')}</h1>
    </header>
  );

  const grid = (rows: Item[]) => (
    <div className="pp-grid">
      {rows.map((i, n) => (
        <button
          key={i.key}
          type="button"
          className="pp-card"
          onClick={() => {
            setChosen(i);
            setQty('1');
            setQuery('');
          }}
        >
          <PhotoTile path={i.photo_path} label={i.name} index={n} className="pp-tile" />
          <strong className="pp-name">{i.name}</strong>
        </button>
      ))}
    </div>
  );

  return (
    <div className="page page-narrow">
      {header}
      <ErrorBanner message={failure} />
      {note && (
        <div className="banner banner-mint" role="status">
          {note}
        </div>
      )}

      <label className="search">
        <Icon name="search" size={20} />
        <input type="search" placeholder={t('price_search_name')} aria-label={t('price_search_name')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="bc-line">
        <Icon name="scan" size={20} />
        <input
          type="text"
          inputMode="numeric"
          enterKeyHint="search"
          placeholder={t('price_search_code')}
          aria-label={t('price_search_code')}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void searchCode(code);
            }
          }}
        />
        <button
          type="button"
          className="bc-scan"
          onClick={async () => {
            try {
              const text = await scanBarcodeText();
              if (text) {
                setCode(text);
                await searchCode(text);
              }
            } catch (e) {
              setFailure(errText(e));
            }
          }}
        >
          {t('price_scan')}
        </button>
      </div>

      {needle ? (
        found.length === 0 ? (
          <div className="card empty muted">{t('price_no_match')}</div>
        ) : (
          grid(found)
        )
      ) : cat ? (
        <>
          {loaded && list.length === 0 && <div className="card empty muted">{t('price_cat_empty')}</div>}
          {grid(list)}
        </>
      ) : (
        <>
          <div className="pick-grid">
            {categories.map((c, i) => (
              <Link key={c.id} to={`/trash/${c.id}`} className="cat-card">
                <PhotoTile path={c.photo_path} label={catName(c.name)} index={i} className="cat-cover" />
                <span className="cat-shade" />
                <span className="cat-info">
                  <strong>{catName(c.name)}</strong>
                  <span className="cat-count">{t('prod_count', { n: items.filter((p) => p.category_id === c.id).length })}</span>
                </span>
              </Link>
            ))}
            {noneCount > 0 && (
              <Link to="/trash/none" className="cat-card">
                <PhotoTile path={null} label={t('price_uncat')} index={categories.length} className="cat-cover" />
                <span className="cat-shade" />
                <span className="cat-info">
                  <strong>{t('price_uncat')}</strong>
                  <span className="cat-count">{t('prod_count', { n: noneCount })}</span>
                </span>
              </Link>
            )}
          </div>

          {log.length > 0 && (
            <section className="stack-sm">
              <span className="section-label">{t('trash_history')}</span>
              <div className="card tr-log">
                {log.map((d) => (
                  <LongPress key={d.id} onLong={() => setDel(d)}>
                    <div className="tr-row">
                      <PhotoTile path={d.photo_path} label={d.name} className="tr-photo" />
                      <span className="row-main">
                        <span className="row-name">{d.name}</span>
                        <span className="row-sub">{dayText(d.created_at.slice(0, 10))}</span>
                      </span>
                      <span className="tr-qty">×{d.quantity}</span>
                    </div>
                  </LongPress>
                ))}
              </div>
              <span className="muted small">{t('trash_hold')}</span>
            </section>
          )}
        </>
      )}

      {chosen && (
        <div className="sheet-backdrop" onClick={() => setChosen(null)}>
          <div className="sheet" role="dialog" aria-label={chosen.name} onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head">
              <PhotoTile path={chosen.photo_path} label={chosen.name} className="sheet-photo" />
              <span className="stack-xs">
                <strong>{chosen.name}</strong>
                <span className="muted small">{t('trash_how_many')}</span>
              </span>
              <button type="button" className="shop-del" aria-label={t('cancel')} onClick={() => setChosen(null)}>
                <Icon name="close" size={18} stroke={2.2} />
              </button>
            </div>
            <div className="sheet-qty">
              <button type="button" className="step-btn" aria-label="-" onClick={() => setQty(String(Math.max(1, (Number.parseInt(qty, 10) || 1) - 1)))}>
                <Icon name="minus" size={18} stroke={2.4} />
              </button>
              <input
                className="step-input"
                type="number"
                inputMode="numeric"
                min={1}
                aria-label={t('quantity')}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void save();
                  }
                }}
              />
              <button type="button" className="step-btn step-btn-primary" aria-label="+" onClick={() => setQty(String((Number.parseInt(qty, 10) || 0) + 1))}>
                <Icon name="plus" size={18} stroke={2.4} />
              </button>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void save()}>
              <Icon name="check" size={18} stroke={2.4} />
              {t('price_save')}
            </button>
          </div>
        </div>
      )}

      {del && (
        <DeleteSheet
          title={`${del.name} ×${del.quantity}`}
          onClose={() => setDel(null)}
          onConfirm={async () => {
            const { error } = await supabase.from('discards').delete().eq('id', del.id);
            if (error) setFailure(error.message);
            await reloadLog();
          }}
        />
      )}
    </div>
  );
}
