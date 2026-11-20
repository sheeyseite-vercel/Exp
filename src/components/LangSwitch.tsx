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
