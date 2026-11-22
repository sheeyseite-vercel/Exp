import { Icon } from './Icon';
import { t } from '../lib/i18n';

/** Two ways to add a photo: take one now, or choose from the gallery. */
export function PhotoPick({ file, onFile }: { file: Blob | null; onFile: (f: Blob | null) => void | Promise<void> }) {
  const handle = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFile(event.target.files?.[0] ?? null);
    event.target.value = '';
  };
  return (
    <div className="photo-pick-row">
      <label className="photo-pick">
        <Icon name="camera" size={18} />
        <span>{t('photo_take')}</span>
        <input type="file" accept="image/*" capture="environment" hidden onChange={handle} />
      </label>
      <label className="photo-pick">
        <Icon name="layers" size={18} />
        <span>{t('photo_gallery')}</span>
        <input type="file" accept="image/*" hidden onChange={handle} />
      </label>
      {file && (
        <span className="photo-ok">
          <Icon name="check" size={16} stroke={2.8} />
          {t('photo_ready')}
        </span>
      )}
    </div>
  );
}
