import { useState } from 'react';
import { Icon } from '../components/Icon';
import { PhotoPick } from '../components/PhotoPick';
import { BackButton, ErrorBanner } from '../components/ui';
import { t } from '../lib/i18n';
import { errText, useReceipts, type ShopReceipt } from '../lib/shop';
import { usePhotoUrl } from '../state/usePhotoUrl';
import { invoiceDate } from './Shop';

function Thumb({ receipt }: { receipt: ShopReceipt }) {
  const url = usePhotoUrl(receipt.photo_path);
  return <span className="rec-thumb">{url ? <img src={url} alt="" /> : <Icon name="receipt" size={30} />}</span>;
}

function Viewer({ receipt, onClose, onDelete }: { receipt: ShopReceipt; onClose: () => void; onDelete: () => Promise<void> }) {
  const url = usePhotoUrl(receipt.photo_path);
  const [armed, setArmed] = useState(false);
  return (
    <div className="rec-viewer" role="dialog" aria-label={receipt.title}>
      <div className="rec-viewer-top">
        <button type="button" className="round-btn round-btn-glass" aria-label={t('close')} onClick={onClose}>
          <Icon name="close" size={22} stroke={2} />
        </button>
        <span className="rec-viewer-title">
          <strong>{receipt.title}</strong>
          <small>{invoiceDate(receipt.created_at)}</small>
        </span>
        <button
          type="button"
          className={`pick-del-btn static ${armed ? 'armed' : ''}`}
          aria-label={t('delete')}
          onClick={async () => {
            if (!armed) {
              setArmed(true);
              return;
            }
            await onDelete();
          }}
        >
          <Icon name="trash" size={22} />
          {armed && <span>{t('confirm_word')}</span>}
        </button>
      </div>
      <div className="rec-viewer-img">{url && <img src={url} alt={receipt.title} />}</div>
    </div>
  );
}

/** Photos of paper receipts, saved with a title. */
export default function ShopReceipts() {
  const { receipts, loaded, error, add, remove } = useReceipts();
  const [title, setTitle] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [open, setOpen] = useState<ShopReceipt | null>(null);

  async function save() {
    if (!title.trim() || !photo) {
      setFailure(t('rec_need'));
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await add(title, photo);
      setTitle('');
      setPhoto(null);
    } catch (e) {
      setFailure(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page-narrow">
      <header className="form-head">
        <BackButton to="/shop" />
        <h1>{t('shop_receipts_t')}</h1>
      </header>
      <ErrorBanner message={error ?? failure} />

      <div className="card inv-form">
        <input
          type="text"
          value={title}
          maxLength={80}
          placeholder={t('rec_title_ph')}
          aria-label={t('rec_title_ph')}
          onChange={(e) => setTitle(e.target.value)}
        />
        <PhotoPick file={photo} onFile={setPhoto} />
        <button type="button" className="btn btn-primary" disabled={busy || !title.trim() || !photo} onClick={() => void save()}>
          <Icon name="check" size={18} stroke={2.4} />
          {t('rec_save')}
        </button>
      </div>

      {loaded && receipts.length === 0 && <div className="card empty muted">{t('rec_empty')}</div>}
      <div className="rec-grid">
        {receipts.map((r) => (
          <button key={r.id} type="button" className="rec-card" onClick={() => setOpen(r)}>
            <Thumb receipt={r} />
            <strong>{r.title}</strong>
            <span className="muted small">{invoiceDate(r.created_at)}</span>
          </button>
        ))}
      </div>

      {open && (
        <Viewer
          receipt={open}
          onClose={() => setOpen(null)}
          onDelete={async () => {
            try {
              await remove(open);
              setOpen(null);
            } catch (e) {
              setFailure(errText(e));
              setOpen(null);
            }
          }}
        />
      )}
    </div>
  );
}
