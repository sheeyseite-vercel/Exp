import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { BackButton, Empty, ErrorBanner } from '../components/ui';
import { PhotoTile } from '../components/PhotoTile';
import { qtyLabel } from '../lib/catalog';
import { Link } from 'react-router-dom';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import type { ShoppingItem } from '../lib/types';

export default function Shopping() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data, error: failure } = await supabase
      .from('shopping_items')
      .select('id,name,done,created_at,qty,unit,brand,photo_path')
      .order('created_at', { ascending: false });
    if (failure) setError(failure.message);
    else setItems(data as ShoppingItem[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    const name = text.trim();
    if (!name) return;
    setText('');
    const { data, error: failure } = await supabase.from('shopping_items').insert({ name }).select().single();
    if (failure) setError(failure.message);
    else setItems((current) => [data as ShoppingItem, ...current]);
  }

  async function toggle(item: ShoppingItem) {
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    const { error: failure } = await supabase.from('shopping_items').update({ done: !item.done }).eq('id', item.id);
    if (failure) setError(failure.message);
  }

  async function remove(item: ShoppingItem) {
    setItems((current) => current.filter((i) => i.id !== item.id));
    await supabase.from('shopping_items').delete().eq('id', item.id);
  }

  async function clearDone() {
    const ids = items.filter((i) => i.done).map((i) => i.id);
    if (ids.length === 0) return;
    setItems((current) => current.filter((i) => !i.done));
    await supabase.from('shopping_items').delete().in('id', ids);
  }

  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <div className="page page-narrow">
      <header className="form-head">
        <BackButton />
        <h1>{t('shop_title')}</h1>
      </header>
      <ErrorBanner message={error} />
      <Link to="/shopping/add" className="btn btn-primary">
        <Icon name="layers" size={20} />
        {t('shop_pick')}
      </Link>
      <form
        className="shop-add"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <input
          type="text"
          value={text}
          maxLength={120}
          placeholder={t('shop_placeholder')}
          aria-label={t('shop_placeholder')}
          enterKeyHint="done"
          onChange={(event) => setText(event.target.value)}
        />
      </form>

      {loaded && items.length === 0 && <Empty title={t('shop_empty')} text={t('shop_hint')} />}

      <ul className="shop-list">
        {[...pending, ...done].map((item) => (
          <li key={item.id} className={item.done ? 'done' : ''}>
            <button type="button" className="shop-check" aria-pressed={item.done} onClick={() => void toggle(item)}>
              {item.done && <Icon name="check" size={14} stroke={3} />}
            </button>
            {(item.photo_path || item.brand) && <PhotoTile path={item.photo_path} label={item.name} className="shop-photo" />}
            <span className="shop-name">
              {item.name}
              <span className="muted small shop-sub">
                {[item.brand, item.unit === 'piece' && item.qty === 1 ? '' : qtyLabel(item)].filter(Boolean).join(' · ')}
              </span>
            </span>
            <button type="button" className="shop-del" aria-label={t('delete')} onClick={() => void remove(item)}>
              <Icon name="close" size={16} stroke={2.2} />
            </button>
          </li>
        ))}
      </ul>

      {done.length > 0 && (
        <button type="button" className="btn btn-soft" onClick={() => void clearDone()}>
          {t('shop_clear')}
        </button>
      )}
    </div>
  );
}
