import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { BackButton, ErrorBanner } from '../components/ui';
import { t } from '../lib/i18n';
import {
  centsToInput,
  formatMoney,
  formatMoneyCur,
  formatQty,
  invoiceTotal,
  lineTotal,
  parseMoney,
  parseQty,
  reconcile,
} from '../lib/money';
import { scanBarcodeText } from '../lib/scanner';
import { errText, findProductByBarcode, saveInvoice, useShopProducts, type ShopProduct } from '../lib/shop';

interface Line {
  key: string;
  barcode: string | null;
  name: string;
  qtyMilli: number;
  unitCents: number;
}

const DRAFT_KEY = 'salahiyati:invoice-draft';

interface Draft {
  supplier: string;
  printed: string;
  lines: Line[];
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Draft;
      if (Array.isArray(d.lines)) return { supplier: d.supplier ?? '', printed: d.printed ?? '', lines: d.lines };
    }
  } catch {
    /* storage unavailable or corrupt */
  }
  return { supplier: '', printed: '', lines: [] };
}

function saveDraft(d: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable */
  }
}

/** Enter the items of a supplier receipt; totals and the difference to the printed total are exact. */
export default function ShopInvoice() {
  const navigate = useNavigate();
  const initial = useMemo(loadDraft, []);
  const { products } = useShopProducts();
  const [supplier, setSupplier] = useState(initial.supplier);
  const [printed, setPrinted] = useState(initial.printed);
  const [lines, setLines] = useState<Line[]>(initial.lines);
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [known, setKnown] = useState<ShopProduct | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  useEffect(() => saveDraft({ supplier, printed, lines }), [supplier, printed, lines]);

  const computed = invoiceTotal(lines);
  const totalQty = lines.reduce((s, l) => s + l.qtyMilli, 0);
  const printedCents = printed.trim() ? parseMoney(printed) : null;
  const printedInvalid = printed.trim() !== '' && printedCents === null;
  const result = printedCents !== null ? reconcile(computed, printedCents) : null;

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (known || q.length < 2) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5);
  }, [name, products, known]);

  function pick(p: ShopProduct) {
    setKnown(p);
    setBarcode(p.barcode ?? '');
    setName(p.name);
    setPrice(centsToInput(p.cost_cents));
    window.setTimeout(() => qtyRef.current?.focus(), 0);
  }

  async function lookup(code: string) {
    const c = code.trim();
    if (!c) {
      nameRef.current?.focus();
      return;
    }
    try {
      const p = await findProductByBarcode(c);
      if (p) pick(p);
      else {
        setKnown(null);
        nameRef.current?.focus();
      }
    } catch (e) {
      setError(errText(e));
    }
  }

  async function scan() {
    setError(null);
    try {
      const code = await scanBarcodeText();
      if (code) {
        setBarcode(code);
        await lookup(code);
      }
    } catch (e) {
      setError(errText(e));
    }
  }

  function addLine() {
    const q = parseQty(qty);
    const p = parseMoney(price);
    if (!name.trim()) {
      setFormError(t('inv_bad_name'));
      nameRef.current?.focus();
      return;
    }
    if (q === null || q <= 0) {
      setFormError(t('inv_bad_qty'));
      qtyRef.current?.focus();
      return;
    }
    if (p === null) {
      setFormError(t('inv_bad_price'));
      priceRef.current?.focus();
      return;
    }
    setFormError(null);
    setLines((prev) => [
      ...prev,
      { key: crypto.randomUUID(), barcode: barcode.trim() || null, name: name.trim(), qtyMilli: q, unitCents: p },
    ]);
    setBarcode('');
    setName('');
    setQty('1');
    setPrice('');
    setKnown(null);
    window.setTimeout(() => barcodeRef.current?.focus(), 0);
  }

  function editLine(line: Line) {
    setLines((prev) => prev.filter((l) => l.key !== line.key));
    setBarcode(line.barcode ?? '');
    setName(line.name);
    setQty(formatQty(line.qtyMilli));
    setPrice(centsToInput(line.unitCents));
    setKnown(null);
  }

  function next(ref: React.RefObject<HTMLInputElement | null>) {
    return (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      ref.current?.focus();
    };
  }

  async function save() {
    if (lines.length === 0 || printedInvalid) return;
    setBusy(true);
    setError(null);
    try {
      const id = await saveInvoice(
        supplier,
        printedCents,
        lines.map((l) => ({ name: l.name, barcode: l.barcode, qtyMilli: l.qtyMilli, unitCents: l.unitCents })),
      );
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* storage unavailable */
      }
      navigate(`/shop/invoice/${id}`, { replace: true });
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  function clearDraft() {
    setSupplier('');
    setPrinted('');
    setLines([]);
  }

  return (
    <div className="page page-narrow inv-page">
      <header className="form-head">
        <BackButton to="/shop" />
        <h1>{t('inv_new')}</h1>
      </header>
      <ErrorBanner message={error} />

      <div className="card inv-head">
        <label className="field">
          <span className="field-label">{t('inv_supplier')}</span>
          <input type="text" value={supplier} maxLength={80} onChange={(e) => setSupplier(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{t('inv_printed')}</span>
          <span className="money-input">
            <input
              type="text"
              inputMode="decimal"
              value={printed}
              placeholder="0.00"
              aria-invalid={printedInvalid}
              onChange={(e) => setPrinted(e.target.value)}
            />
            <em>DA</em>
          </span>
        </label>
      </div>

      <form
        className="card inv-form"
        onSubmit={(event) => {
          event.preventDefault();
          addLine();
        }}
      >
        <div className="inv-barcode">
          <input
            ref={barcodeRef}
            type="text"
            inputMode="numeric"
            enterKeyHint="next"
            placeholder={t('inv_barcode')}
            aria-label={t('inv_barcode')}
            value={barcode}
            onChange={(e) => {
              setBarcode(e.target.value);
              setKnown(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void lookup(barcode);
              }
            }}
          />
          <button type="button" className="btn btn-soft btn-icon" aria-label={t('price_scan')} onClick={() => void scan()}>
            <Icon name="scan" size={22} />
          </button>
        </div>
        <input
          ref={nameRef}
          type="text"
          enterKeyHint="next"
          placeholder={t('inv_name')}
          aria-label={t('inv_name')}
          value={name}
          maxLength={120}
          onChange={(e) => {
            setName(e.target.value);
            setKnown(null);
          }}
          onKeyDown={next(qtyRef)}
        />
        {known && <span className="chip chip-mint inv-known">{t('inv_found', { p: formatMoneyCur(known.cost_cents) })}</span>}
        {suggestions.length > 0 && (
          <div className="inv-suggest">
            {suggestions.map((p) => (
              <button key={p.id} type="button" className="pill" onClick={() => pick(p)}>
                {p.name}
              </button>
            ))}
          </div>
        )}
        <div className="inv-pair">
          <label className="field">
            <span className="field-label">{t('inv_qty')}</span>
            <input
              ref={qtyRef}
              type="text"
              inputMode="decimal"
              enterKeyHint="next"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onKeyDown={next(priceRef)}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('inv_price')}</span>
            <input
              ref={priceRef}
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
        </div>
        {formError && (
          <span className="form-error" role="alert">
            {formError}
          </span>
        )}
        <button type="submit" className="btn btn-primary">
          <Icon name="plus" size={18} stroke={2.4} />
          {t('inv_add')}
        </button>
        <span className="muted small">{t('inv_hint')}</span>
      </form>

      <section className="stack-sm">
        <h2 className="section-title">{t('inv_lines')}</h2>
        {lines.length === 0 ? (
          <div className="card empty muted">{t('inv_empty')}</div>
        ) : (
          <>
            <div className="card inv-lines">
              {lines.map((l, i) => (
                <div key={l.key} className="inv-line">
                  <button type="button" className="inv-line-main" onClick={() => editLine(l)}>
                    <span className="inv-line-no">{i + 1}</span>
                    <span className="inv-line-text">
                      <strong>{l.name}</strong>
                      <span className="muted small">
                        {formatQty(l.qtyMilli)} × {formatMoney(l.unitCents)}
                        {l.barcode ? ` · ${l.barcode}` : ''}
                      </span>
                    </span>
                    <strong className="inv-line-total">{formatMoney(lineTotal(l.qtyMilli, l.unitCents))}</strong>
                  </button>
                  <button
                    type="button"
                    className="shop-del"
                    aria-label={t('delete')}
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                  >
                    <Icon name="close" size={16} stroke={2.2} />
                  </button>
                </div>
              ))}
            </div>
            <span className="muted small">{t('inv_edit_hint')}</span>
          </>
        )}
      </section>

      <div className="card inv-summary">
        <div className="inv-sum-row">
          <span>{t('inv_computed')}</span>
          <strong className="inv-sum-total">{formatMoneyCur(computed)}</strong>
        </div>
        <span className="muted small">{t('inv_items', { n: lines.length, q: formatQty(totalQty) })}</span>
        {result === null ? (
          <span className="inv-diff inv-diff-neutral">{printedInvalid ? t('inv_bad_printed') : t('inv_enter_printed')}</span>
        ) : result.state === 'match' ? (
          <span className="inv-diff inv-diff-ok">
            <Icon name="check" size={18} stroke={2.8} />
            {t('inv_match')}
          </span>
        ) : result.state === 'over' ? (
          <span className="inv-diff inv-diff-bad">{t('inv_over', { x: formatMoneyCur(result.diff) })}</span>
        ) : (
          <span className="inv-diff inv-diff-warn">{t('inv_short', { x: formatMoneyCur(-result.diff) })}</span>
        )}
      </div>

      <button type="button" className="btn btn-primary" disabled={busy || lines.length === 0 || printedInvalid} onClick={() => void save()}>
        <Icon name="check" size={18} stroke={2.4} />
        {t('inv_save')}
      </button>
      {(lines.length > 0 || supplier || printed) && (
        <button type="button" className="btn btn-soft" onClick={clearDraft}>
          {t('inv_discard')}
        </button>
      )}
    </div>
  );
}
