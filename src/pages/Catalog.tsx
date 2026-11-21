import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PhotoTile } from '../components/PhotoTile';
import { BackButton, ErrorBanner } from '../components/ui';
import { useCatalog } from '../lib/catalog';
import { t } from '../lib/i18n';

function PhotoPick({ file, onFile }: { file: Blob | null; onFile: (f: Blob | null) => void }) {
  return (
    <label className={`photo-pick ${file ? 'has' : ''}`}>
      <Icon name={file ? 'check' : 'camera'} size={20} stroke={file ? 2.6 : 1.8} />
      <span>{t('prod_photo')}</span>
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          onFile(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
    </label>
  );
}

export default function Catalog() {
  const { cat } = useParams();
  const navigate = useNavigate();
  const { categories, products, loaded, error, addCategory, deleteCategory, addProduct, deleteProduct } = useCatalog();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const category = categories.find((c) => c.id === cat);
  const suggestions = t('cat_suggestions')
    .split('|')
    .filter((s) => !categories.some((c) => c.name === s));

  async function submitCategory(value: string, file?: Blob | null) {
    if (!value.trim()) return;
    setBusy(true);
    await addCategory(value, file);
    setBusy(false);
    setName('');
    setPhoto(null);
  }

  // ---- list of categories ------------------------------------------------------------------
  if (!cat) {
    return (
      <div className="page page-narrow">
        <header className="form-head">
          <BackButton to="/profile" />
          <h1>{t('catalog_title')}</h1>
        </header>
        <p className="muted">{t('catalog_hint')}</p>
        <ErrorBanner message={error} />
        <form
          className="cat-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCategory(name, photo);
          }}
        >
          <input
            type="text"
            value={name}
            maxLength={60}
            placeholder={t('cat_name_ph')}
            aria-label={t('cat_name_ph')}
            onChange={(event) => setName(event.target.value)}
          />
          <PhotoPick file={photo} onFile={setPhoto} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy} aria-label={t('cat_add')}>
            <Icon name="plus" size={18} stroke={2.4} />
          </button>
        </form>
        {suggestions.length > 0 && (
          <div className="stack-xs">
            <span className="muted small">{t('cat_suggest')}</span>
            <div className="pills">
              {suggestions.map((s) => (
                <button key={s} type="button" className="pill" disabled={busy} onClick={() => void submitCategory(s)}>
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="pick-grid">
          {categories.map((c, i) => (
            <Link key={c.id} to={`/catalog/${c.id}`} className="pick-card">
              <PhotoTile path={c.photo_path} label={c.name} index={i} className="pick-photo" />
              <strong>{c.name}</strong>
              <span className="muted small">{t('prod_count', { n: products.filter((p) => p.category_id === c.id).length })}</span>
            </Link>
          ))}
        </div>
        {!loaded && <p className="muted center">{t('loading')}</p>}
      </div>
    );
  }

  // ---- one category: its products -------------------------------------------------------------
  const list = products.filter((p) => p.category_id === cat);
  return (
    <div className="page page-narrow">
      <header className="form-head">
        <BackButton to="/catalog" />
        <h1>{category?.name ?? t('catalog_title')}</h1>
      </header>
      <ErrorBanner message={error} />
      <form
        className="cat-form cat-form-col"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          await addProduct(cat, name, brand, photo);
          setBusy(false);
          setName('');
          setBrand('');
          setPhoto(null);
        }}
      >
        <input type="text" value={name} maxLength={120} placeholder={t('prod_name_ph')} aria-label={t('prod_name_ph')} onChange={(e) => setName(e.target.value)} />
        <input type="text" value={brand} maxLength={60} placeholder={t('prod_brand_ph')} aria-label={t('prod_brand_ph')} onChange={(e) => setBrand(e.target.value)} />
        <div className="cat-form-actions">
          <PhotoPick file={photo} onFile={setPhoto} />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <Icon name="plus" size={18} stroke={2.4} />
            {t('add_product')}
          </button>
        </div>
      </form>
      <div className="pick-grid">
        {list.map((p, i) => (
          <div key={p.id} className="pick-card">
            <PhotoTile path={p.photo_path} label={p.name} index={i} className="pick-photo" />
            <strong>{p.name}</strong>
            {p.brand && <span className="muted small">{p.brand}</span>}
            <button type="button" className="shop-del pick-del" aria-label={t('delete')} onClick={() => void deleteProduct(p.id)}>
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-danger-soft"
        onClick={async () => {
          if (!confirming) {
            setConfirming(true);
            return;
          }
          await deleteCategory(cat);
          navigate('/catalog', { replace: true });
        }}
      >
        <Icon name="trash" size={18} />
        {confirming ? t('confirm_again') : t('cat_delete')}
      </button>
    </div>
  );
}
