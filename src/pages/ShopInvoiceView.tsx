import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { BackButton, ErrorBanner } from '../components/ui';
import { t } from '../lib/i18n';
import { formatMoney, formatMoneyCur, formatQty, lineTotal, reconcile } from '../lib/money';
import { deleteInvoice, errText, loadInvoice, type ShopInvoice, type ShopLine } from '../lib/shop';
import { dayText } from './Shop';

export default function ShopInvoiceView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<{ invoice: ShopInvoice; lines: ShopLine[] } | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

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
                <span className="inv-line-main static">
                  <span className="inv-line-no">{i + 1}</span>
                  <span className="inv-line-text">
                    <strong>{l.name}</strong>
                    <span className="muted small">
                      {formatQty(l.qty_milli)} × {formatMoney(l.unit_cents)}
                      {l.barcode ? ` · ${l.barcode}` : ''}
                    </span>
                  </span>
                  <strong className="inv-line-total">{formatMoney(lineTotal(l.qty_milli, l.unit_cents))}</strong>
                </span>
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
    </div>
  );
}
