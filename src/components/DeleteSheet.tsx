import { useState } from 'react';
import { t } from '../lib/i18n';
import { Icon } from './Icon';

/** Bottom sheet with one big trash button: first tap arms it (red "Confirm"), second tap deletes. */
export function DeleteSheet({ title, hint, onConfirm, onClose }: { title: string; hint?: string; onConfirm: () => Promise<void> | void; onClose: () => void }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="alertdialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <span className="stack-xs">
            <strong>{title}</strong>
            {hint && <span className="muted small">{hint}</span>}
          </span>
          <button type="button" className="shop-del" aria-label={t('cancel')} onClick={onClose}>
            <Icon name="close" size={18} stroke={2.2} />
          </button>
        </div>
        <button
          type="button"
          className={`btn ${armed ? 'btn-danger' : 'btn-danger-soft'}`}
          disabled={busy}
          onClick={async () => {
            if (!armed) {
              setArmed(true);
              return;
            }
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
              onClose();
            }
          }}
        >
          <Icon name="trash" size={22} />
          {armed ? t('confirm_word') : t('delete_forever')}
        </button>
      </div>
    </div>
  );
}
