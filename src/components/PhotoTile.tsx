import { usePhotoUrl } from '../state/usePhotoUrl';

const TONES = ['sky', 'mint', 'peach', 'rose'];

/** Photo if there is one, otherwise a coloured tile with the first letter. */
export function PhotoTile({ path, label, index = 0, className = '' }: { path: string | null; label: string; index?: number; className?: string }) {
  const url = usePhotoUrl(path);
  return (
    <span className={`ptile tone-${TONES[index % TONES.length]} ${className} ${path?.endsWith('.png') ? 'ptile-cut' : ''}`}>
      {url ? <img src={url} alt="" /> : <span className="ptile-letter">{label.trim().charAt(0)}</span>}
    </span>
  );
}
