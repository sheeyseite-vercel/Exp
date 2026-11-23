import { useState } from 'react';
import { catName } from '../lib/categories';
import { useCatalog } from '../lib/catalog';
import { t } from '../lib/i18n';
import { normalizeText } from '../lib/text';
import { Icon } from './Icon';
import { PhotoTile } from './PhotoTile';

interface Props {
  /** The chosen category name; null means "all" in filter mode. */
  value: string | null;
  onChange: (name: string | null) => void;
  /** Filter mode: adds an "All" row and never creates categories. */
  filter?: boolean;
  /** Extra names to list besides the person's own categories (for example ones already used by products). */
  extra?: string[];
  /** Icon-only button. */
  compact?: boolean;
}

/** One button; tapping it opens the list of categories to choose from, with a box to type a new one. */
export function CategoryPicker({ value, onChange, filter = false, extra = [], compact = false }: Props) {
  const { categories, addCategory } = useCatalog();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const same = (a: string, b: string) => normalizeText(catName(a)) === normalizeText(catName(b));
  const names = new Set<string>(categories.map((c) => c.name));
  const more = [...extra, ...(value && !filter ? [value] : [])].filter((n) => n && !categories.some((c) => same(c.name, n)));
  const rows = [
    ...categories.map((c) => ({ name: c.name, photo: c.photo_path })),
    ...[...new Set(more)].map((name) => ({ name, photo: null as string | null })),
  ];
  const needle = normalizeText(text);
  const shown = needle ? rows.filter((r) => normalizeText(catName(r.name)).includes(needle)) : rows;
  const exact = rows.some((r) => normalizeText(catName(r.name)) === needle);

  function pick(name: string | null) {
    onChange(name);
    setOpen(false);
    setText('');
  }

  async function create() {
    const name = text.trim().slice(0, 40);
    if (!name || busy) return;
    setBusy(true);
    if (!names.has(name)) await addCategory(name);
    setBusy(false);
    pick(name);
  }

  const label = value ? catName(value) : t('filter_all');

  return (
    <>
      <button
        type="button"
        className={compact ? 'cp-btn cp-compact' : 'cp-btn'}
        aria-label={t('category_label')}
        onClick={() => setOpen(true)}
      >
        <Icon name="layers" size={compact ? 22 : 20} />
        {!compact && (
          <span className="cp-text">
            <small>{t('category_label')}</small>
            <strong>{label}</strong>
          </span>
        )}
        {!compact && <Icon name="chevronDown" size={18} />}
        {compact && value && <span className="cp-dot" />}
      </button>

      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet sheet-tall" role="dialog" aria-label={t('category_label')} onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head">
              <strong>{t('category_label')}</strong>
              <button type="button" className="shop-del" aria-label={t('cancel')} onClick={() => setOpen(false)}>
                <Icon name="close" size={18} stroke={2.2} />
              </button>
            </div>
            {!filter && (
              <input
                className="cat-type"
                type="text"
                value={text}
                maxLength={40}
                placeholder={t('cat_type_ph')}
                aria-label={t('cat_type_ph')}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void create();
                  }
                }}
              />
            )}
            <div className="cp-list">
              {filter && (
                <button type="button" className={`cp-row ${value === null ? 'on' : ''}`} onClick={() => pick(null)}>
                  <span className="cp-ic">
                    <Icon name="layers" size={20} />
                  </span>
                  <strong>{t('filter_all')}</strong>
                </button>
              )}
              {shown.map((r, i) => (
                <button key={r.name} type="button" className={`cp-row ${value && same(value, r.name) ? 'on' : ''}`} onClick={() => pick(r.name)}>
                  <PhotoTile path={r.photo} label={catName(r.name)} index={i} className="cp-photo" />
                  <strong>{catName(r.name)}</strong>
                  {value && same(value, r.name) && <Icon name="check" size={18} stroke={2.6} />}
                </button>
              ))}
              {!filter && needle && !exact && (
                <button type="button" className="cp-row cp-new" disabled={busy} onClick={() => void create()}>
                  <span className="cp-ic">
                    <Icon name="plus" size={20} stroke={2.4} />
                  </span>
                  <strong>{t('cat_add_typed', { name: text.trim() })}</strong>
                </button>
              )}
              {!filter && !needle && (
                <button type="button" className={`cp-row ${value === 'other' ? 'on' : ''}`} onClick={() => pick('other')}>
                  <span className="cp-ic">
                    <Icon name="cube" size={20} />
                  </span>
                  <strong>{t('cat_other')}</strong>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
