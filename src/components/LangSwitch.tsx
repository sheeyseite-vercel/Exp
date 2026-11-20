import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { LANGS, setLang, useLang } from '../lib/i18n';

export function LangSwitch({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const lang = useLang();
  return (
    <div className={`lang-switch lang-${tone}`} role="group" aria-label="Language / اللغة / Langue">
      {LANGS.map((item) => (
        <button
          key={item.id}
          type="button"
          lang={item.id}
          aria-pressed={lang === item.id}
          className={lang === item.id ? 'active' : ''}
          onClick={() => setLang(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** One row showing the current language; tapping it opens a list. The list opens on the side the language reads from. */
export function LangMenu() {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const current = LANGS.find((item) => item.id === lang)?.label ?? '';
  return (
    <div className="lang-menu" ref={box}>
      <button
        type="button"
        className="lang-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {current}
        <Icon name="chevronDown" size={16} stroke={2.2} />
      </button>
      {open && (
        <ul className="lang-list" role="listbox">
          {LANGS.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="option"
                lang={item.id}
                aria-selected={item.id === lang}
                className={item.id === lang ? 'active' : ''}
                onClick={() => {
                  setOpen(false);
                  setLang(item.id);
                }}
              >
                {item.label}
                {item.id === lang && <Icon name="check" size={16} stroke={2.4} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
