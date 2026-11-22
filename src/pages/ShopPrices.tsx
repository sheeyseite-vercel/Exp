import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { BackButton, ErrorBanner } from '../components/ui';
import { t } from '../lib/i18n';
import { centsToInput, formatMoney, formatMoneyCur, formatPercentTenths, formatQty, margin, parseMoney } from '../lib/money';
import { scanBarcodeText } from '../lib/scanner';
import { errText, findProductByBarcode, useShopProducts, type ShopProduct } from '../lib/shop';

/** Find a product by barcode or name, see the purchase cost saved from invoices, and set the selling price. */
export default function ShopPrices() {
  const { products, loaded, error, setSellPrice, createProduct, deleteProduct } = useShopProducts();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ShopProduct | null>(null);
  const [sell, setSell] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [unknown, setUnknown] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCost, setNewCost] = useState('');
  const [armed, setArmed] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q));
  }, [products, query]);

  function open(p: ShopProduct) {
    setSelected(p);
    setSell(p.sell_cents === null ? '' : centsToInput(p.sell_cents));
    setUnknown(null);
    setFailure(null);
    setArmed(false);
  }

  async function search(raw: string) {
    const code = raw.trim();
    if (!code) return;
    setNote(null);
    try {
      const exact = await findProductByBarcode(code);
      if (exact) {
        open(exact);
        return;
      }
      if (/^\d{6,}$/.test(code)) {
        setUnknown(code);
        setNewName('');
        setNewCost('');
      } else if (filtered.length === 1) open(filtered[0]);
    } catch (e) {
      setFailure(errText(e));
    }
  }

  async function scan() {
    setFailure(null);
    try {
      const code = await scanBarcodeText();
      if (code) {
        setQuery(code);
        await search(code);
      }
    } catch (e) {
      setFailure(errText(e));
    }
  }

  const sellCents = sell.trim() ? parseMoney(sell) : null;
  const sellInvalid = sell.trim() !== '' && sellCents === null;
  const m = selected && sellCents !== null ? margin(selected.cost_cents, sellCents) : null;

  async function save() {
    if (!selected || sellInvalid) return;
    try {
      await setSellPrice(selected.id, sellCents);
      setNote(t('price_saved'));
      setSelected(null);
    } catch (e) {
      setFailure(errText(e));
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
      await deleteProduct(selected.id);
      setSelected(null);
    } catch (e) {
      setFailure(errText(e));
    }
  }

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

      <div className="inv-barcode">
        <input
          type="search"
          enterKeyHint="search"
          placeholder={t('price_search')}
          aria-label={t('price_search')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setUnknown(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search(query);
            }
          }}
        />
        <button type="button" className="btn btn-primary btn-icon" aria-label={t('price_scan')} onClick={() => void scan()}>
          <Icon name="scan" size={22} />
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

      {loaded && products.length === 0 && <div className="card empty muted">{t('price_empty')}</div>}

      <div className="card inv-lines">
        {filtered.map((p) => (
          <button key={p.id} type="button" className="inv-line-main price-row" onClick={() => open(p)}>
            <span className="inv-line-text">
              <strong>{p.name}</strong>
              <span className="muted small">
                {p.barcode ? `${p.barcode} · ` : ''}
                {t('price_cost')} {formatMoney(p.cost_cents)}
              </span>
            </span>
            {p.sell_cents === null ? (
              <span className="chip chip-peach">{t('price_none')}</span>
            ) : (
              <strong className="inv-line-total">{formatMoneyCur(p.sell_cents)}</strong>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div className="sheet-backdrop" onClick={() => setSelected(null)}>
          <div className="sheet" role="dialog" aria-label={selected.name} onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head">
              <span className="stack-xs">
                <strong>{selected.name}</strong>
                <span className="muted small">
                  {t('price_code')}: {selected.barcode ?? '—'}
                </span>
              </span>
              <button type="button" className="shop-del" aria-label={t('cancel')} onClick={() => setSelected(null)}>
                <Icon name="close" size={18} stroke={2.2} />
              </button>
            </div>
            <div className="price-cost">
              <span>
                {t('price_cost')}
                <small className="muted">{t('price_cost_note')}</small>
              </span>
              <strong>{formatMoneyCur(selected.cost_cents)}</strong>
            </div>
            <span className="muted small">{t('price_stock', { q: formatQty(selected.stock_milli) })}</span>
            <label className="field">
              <span className="field-label">{t('price_sell')}</span>
              <span className="money-input">
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
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
            <button type="button" className="btn btn-primary" disabled={sellInvalid} onClick={() => void save()}>
              <Icon name="check" size={18} stroke={2.4} />
              {t('price_save')}
            </button>
            <button type="button" className={`btn ${armed ? 'btn-danger' : 'btn-danger-soft'}`} onClick={() => void remove()}>
              <Icon name="trash" size={20} />
              {armed ? t('confirm_word') : t('price_delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
