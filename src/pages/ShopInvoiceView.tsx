import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { BackButton, ErrorBanner } from '../components/ui';
import { t } from '../lib/i18n';
import { centsToInput, formatMoney, formatMoneyCur, formatQty, lineTotal, parseMoney, parseQty, qtyToInput, reconcile } from '../lib/money';
import { deleteInvoice, errText, loadInvoice, updateInvoice, type ShopInvoice, type ShopLine } from '../lib/shop';
import { dayText } from './Shop';

export default function ShopInvoiceView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<{ invoice: ShopInvoice; lines: ShopLine[] } | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [editing, setEditing] = useState<ShopLine | null>(null);
  const [fName, setFName] = useState('');
  const [fQty, setFQty] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [saving, setSaving] = useState(false);

  function openLine(l: ShopLine) {
    setEditing(l);
    setFName(l.name);
    setFQty(qtyToInput(l.qty_milli));
    setFPrice(centsToInput(l.unit_cents));
  }

  async function saveLine() {
    if (!data || !editing) return;
    const qty = parseQty(fQty);
    const price = parseMoney(fPrice);
    if (!fName.trim() || qty === null || qty <= 0 || price === null) return;
    setSaving(true);
    try {
      const lines = data.lines.map((l) =>
        l.id === editing.id
          ? { name: fName.trim(), barcode: l.barcode, qtyMilli: qty, unitCents: price }
          : { name: l.name, barcode: l.barcode, qtyMilli: l.qty_milli, unitCents: l.unit_cents },
      );
      await updateInvoice(id, data.invoice.supplier ?? '', data.invoice.printed_cents, data.invoice.invoice_date, lines);
      setData(await loadInvoice(id));
      setEditing(null);
    } catch (e) {
      setError(errText(e));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadInvoice(id)
      .then(setData)
      .catch((e) => {
        setError(errText(e));
        setData(null);
      });
  }, [id]);

  async function remove() {
    if (!armed) {
      setArmed(true);
      return;
    }
    try {
      await deleteInvoice(id);
      navigate('/shop', { replace: true });
    } catch (e) {
      setError(errText(e));
    }
  }

  const inv = data?.invoice;
  const diff = inv && inv.printed_cents !== null ? reconcile(inv.total_cents, inv.printed_cents) : null;

  return (
    <div className="page page-narrow">
      <header className="form-head">
        <BackButton to="/shop" />
        <h1>{t('inv_view')}</h1>
        {data?.invoice && (
          <Link to={`/shop/invoice/${id}/edit`} className="round-btn edit-btn" aria-label={t('inv_edit')}>
            <Icon name="pencil" size={20} />
          </Link>
        )}
      </header>
      <ErrorBanner message={error} />
      {data === null && !error && <div className="card empty muted">{t('inv_missing')}</div>}
      {inv && data && (
        <>
          <div className="card inv-summary">
            <strong>{inv.supplier || dayText(inv.invoice_date)}</strong>
            {inv.supplier && <span className="muted small">{dayText(inv.invoice_date)}</span>}
            <div className="inv-sum-row">
              <span>{t('inv_computed')}</span>
              <strong className="inv-sum-total">{formatMoneyCur(inv.total_cents)}</strong>
            </div>
            {inv.printed_cents !== null && (
              <div className="inv-sum-row">
                <span>{t('inv_printed_short')}</span>
                <strong>{formatMoneyCur(inv.printed_cents)}</strong>
              </div>
            )}
            {diff &&
              (diff.state === 'match' ? (
                <span className="inv-diff inv-diff-ok">
                  <Icon name="check" size={18} stroke={2.8} />
                  {t('inv_match')}
                </span>
              ) : diff.state === 'over' ? (
                <span className="inv-diff inv-diff-bad">{t('inv_over', { x: formatMoneyCur(diff.diff) })}</span>
              ) : (
                <span className="inv-diff inv-diff-warn">{t('inv_short', { x: formatMoneyCur(-diff.diff) })}</span>
              ))}
          </div>
          <div className="card inv-lines">
            {data.lines.map((l, i) => (
              <div key={l.id} className="inv-line">
                <button type="button" className="inv-line-main inv-line-btn" onClick={() => openLine(l)}>
                  <span className="inv-line-no">{i + 1}</span>
                  <span className="inv-line-text">
                    <strong>{l.name}</strong>
                    <span className="muted small">
                      {formatQty(l.qty_milli)} × {formatMoney(l.unit_cents)}
                      {l.barcode ? ` · ${l.barcode}` : ''}
                    </span>
                  </span>
                  <strong className="inv-line-total">{formatMoney(lineTotal(l.qty_milli, l.unit_cents))}</strong>
                </button>
              </div>
            ))}
          </div>
          <Link to={`/shop/invoice/${id}/edit`} className="btn btn-soft">
            <Icon name="pencil" size={18} />
            {t('inv_edit')}
          </Link>
          <span className="muted small">{t('inv_delete_note')}</span>
          <button type="button" className={`btn ${armed ? 'btn-danger' : 'btn-danger-soft'}`} onClick={() => void remove()}>
            <Icon name="trash" size={20} />
            {armed ? t('confirm_word') : t('inv_delete')}
          </button>
        </>
      )}
      {editing && (
        <div className="sheet-backdrop" onClick={() => setEditing(null)}>
          <div className="sheet" role="dialog" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head">
              <strong>{editing.name}</strong>
              <button type="button" className="shop-del" aria-label={t('cancel')} onClick={() => setEditing(null)}>
                <Icon name="close" size={18} stroke={2.2} />
              </button>
            </div>
            <input className="input" value={fName} onChange={(e) => setFName(e.target.value)} aria-label={t('inv_name')} />
            <div className="inv-edit-row">
              <label className="stack-xs">
                <span className="muted small">{t('inv_qty')}</span>
                <input className="input" inputMode="decimal" value={fQty} onChange={(e) => setFQty(e.target.value)} />
              </label>
              <label className="stack-xs">
                <span className="muted small">{t('inv_price')}</span>
                <input className="input" inputMode="decimal" value={fPrice} onChange={(e) => setFPrice(e.target.value)} />
              </label>
            </div>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveLine()}>
              {t('save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
