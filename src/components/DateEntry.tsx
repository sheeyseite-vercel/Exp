import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n';
import { dayText, todayISO } from '../pages/Shop';
import { Icon } from './Icon';

type Field = 'd' | 'm' | 'y';

function split(value: string): Record<Field, string> {
  const [y, m, d] = (value || todayISO()).split('-');
  return { d: String(Number(d)).padStart(2, '0'), m: String(Number(m)).padStart(2, '0'), y };
}

function valid(v: Record<Field, string>): string | null {
  if (!v.d || !v.m || v.y.length !== 4) return null;
  const d = Number(v.d);
  const m = Number(v.m);
  const y = Number(v.y);
  if (m < 1 || m > 12 || d < 1 || y < 1990 || y > 2100) return null;
  if (d > new Date(y, m, 0).getDate()) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Type the date field by field: day, month, year. Starts on today. */
export function DateEntry({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [vals, setVals] = useState(() => split(value));
  const refs = { d: useRef<HTMLInputElement>(null), m: useRef<HTMLInputElement>(null), y: useRef<HTMLInputElement>(null) };
  const fresh = useRef<Record<Field, boolean>>({ d: false, m: false, y: false });

  // Follow the value when it is changed from outside (for example when an invoice finishes loading).
  useEffect(() => {
    setVals((current) => (valid(current) === value ? current : split(value)));
  }, [value]);

  const iso = valid(vals);
  const complete = vals.d !== '' && vals.m !== '' && vals.y.length === 4;
  const bad = complete && iso === null;

  function update(field: Field, raw: string, input: HTMLInputElement) {
    let v = raw.replace(/\D/g, '');
    if (fresh.current[field] && v.length > vals[field].length) {
      // First key after tapping a field replaces what was there.
      const pos = input.selectionStart ?? v.length;
      const ch = input.value[pos - 1];
      v = /\d/.test(ch ?? '') ? (ch as string) : v.slice(-1);
    }
    fresh.current[field] = false;
    const max = field === 'y' ? 4 : 2;
    v = v.slice(0, max);
    const next = { ...vals, [field]: v };
    setVals(next);
    const ok = valid(next);
    if (ok) onChange(ok);
    if (field === 'd' && (v.length === 2 || (v.length === 1 && Number(v) > 3))) refs.m.current?.focus();
    if (field === 'm' && (v.length === 2 || (v.length === 1 && Number(v) > 1))) refs.y.current?.focus();
  }

  const input = (field: Field, placeholder: string) => (
    <input
      ref={refs[field]}
      className={`de-input de-${field}`}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      aria-label={placeholder}
      value={vals[field]}
      onFocus={() => {
        fresh.current[field] = true;
      }}
      onChange={(e) => update(field, e.target.value, e.target)}
      onBlur={() => {
        fresh.current[field] = false;
        // Pad a lone digit and fall back to the last good date when what was typed is not a real date.
        setVals((cur) => {
          const padded = field === 'y' ? cur : { ...cur, [field]: cur[field].length === 1 ? `0${cur[field]}` : cur[field] };
          return valid(padded) ? padded : split(value);
        });
      }}
    />
  );

  return (
    <div className={`de ${bad ? 'bad' : ''}`}>
      <span className="de-label">
        <Icon name="calendar" size={18} />
        {label}
      </span>
      <div className="de-row">
        {input('d', t('de_day'))}
        <span className="de-sep">/</span>
        {input('m', t('de_month'))}
        <span className="de-sep">/</span>
        {input('y', t('de_year'))}
        <button type="button" className="de-today" onClick={() => onChange(todayISO())}>
          {t('dp_today')}
        </button>
      </div>
      {bad && <span className="form-error">{t('de_invalid')}</span>}
      {!bad && iso && <span className="muted small de-preview">{dayText(iso)}</span>}
    </div>
  );
}
