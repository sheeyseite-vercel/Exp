import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n';
import { todayISO } from '../pages/Shop';
import { Icon } from './Icon';

/** "2019-05-23" -> "23052019" */
function toDigits(iso: string): string {
  const [y, m, d] = (iso || todayISO()).split('-');
  return `${d}${m}${y}`;
}

/** "23052019" -> "23.05.2019" (partial input shows partial text) */
function format(digits: string): string {
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  return [d, m, y].filter((_, i) => digits.length > i * 2 || i === 0).join('.');
}

function toISO(digits: string): string | null {
  if (digits.length !== 8) return null;
  const d = Number(digits.slice(0, 2));
  const m = Number(digits.slice(2, 4));
  const y = Number(digits.slice(4, 8));
  if (m < 1 || m > 12 || d < 1 || y < 1990 || y > 2100) return null;
  if (d > new Date(y, m, 0).getDate()) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** One field that shows the whole date as 23.05.2019. Tap it and type the digits; the dots are added for you. */
export function DateEntry({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [digits, setDigits] = useState(() => toDigits(value));
  const fresh = useRef(false);

  // Follow the value when it changes from outside (for example when an invoice finishes loading).
  useEffect(() => {
    setDigits((cur) => (toISO(cur) === value ? cur : toDigits(value)));
  }, [value]);

  const complete = digits.length === 8;
  const bad = complete && toISO(digits) === null;

  function handle(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    let next = input.value.replace(/\D/g, '');
    const typedMore = next.length > digits.length;
    if (fresh.current && typedMore) {
      // The first key after tapping starts a new date.
      const ch = input.value[(input.selectionStart ?? input.value.length) - 1];
      next = /\d/.test(ch ?? '') ? (ch as string) : next.slice(-1);
    } else if (next === digits && input.value.length < format(digits).length) {
      // Backspace over a dot removes the digit before it.
      next = digits.slice(0, -1);
    }
    fresh.current = false;
    next = next.slice(0, 8);
    setDigits(next);
    const iso = toISO(next);
    if (iso) onChange(iso);
  }

  return (
    <div className={`de ${bad ? 'bad' : ''}`}>
      <label className="de-box">
        <Icon name="calendar" size={22} />
        <span className="de-col">
          <small>{label}</small>
          <input
            className="de-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="DD.MM.YYYY"
            aria-label={label}
            maxLength={10}
            value={format(digits)}
            onFocus={() => {
              fresh.current = true;
            }}
            onChange={handle}
            onBlur={() => {
              fresh.current = false;
              if (toISO(digits) === null) setDigits(toDigits(value));
            }}
          />
        </span>
        <button
          type="button"
          className="de-today"
          onClick={() => {
            const today = todayISO();
            setDigits(toDigits(today));
            onChange(today);
          }}
        >
          {t('dp_today')}
        </button>
      </label>
      {bad && <span className="form-error">{t('de_invalid')}</span>}
    </div>
  );
}
