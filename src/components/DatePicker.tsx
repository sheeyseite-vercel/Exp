import { useState } from 'react';
import { MONTHS, getLang, t, type Lang } from '../lib/i18n';
import { dayText, todayISO } from '../pages/Shop';
import { Icon } from './Icon';

/** Short weekday labels, Sunday first. */
const DOW: Record<Lang, string[]> = {
  ar: ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
  fr: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
};

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parts(value: string): { y: number; m: number; d: number } {
  const [y, m, d] = (value || todayISO()).split('-').map(Number);
  return { y, m: m - 1, d };
}

/** A calendar that opens right under the field, in the app's own style. */
export function DatePicker({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const lang = getLang();
  const [open, setOpen] = useState(false);
  const sel = parts(value);
  const [view, setView] = useState({ y: sel.y, m: sel.m });

  const weekStart = lang === 'ar' ? 0 : 1;
  const first = new Date(view.y, view.m, 1).getDay();
  const blanks = (first - weekStart + 7) % 7;
  const count = new Date(view.y, view.m + 1, 0).getDate();
  const today = todayISO();
  const heads = [...DOW[lang].slice(weekStart), ...DOW[lang].slice(0, weekStart)];

  function shift(delta: number) {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  }

  return (
    <div className={`dp ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="dp-field"
        aria-expanded={open}
        onClick={() => {
          if (!open) setView({ y: sel.y, m: sel.m });
          setOpen(!open);
        }}
      >
        <Icon name="calendar" size={20} />
        <span className="dp-text">
          <small>{label}</small>
          <strong>{value ? dayText(value) : '—'}</strong>
        </span>
        <Icon name="chevronDown" size={18} />
      </button>

      {open && (
        <div className="dp-pop">
          <div className="dp-head">
            <strong>
              {MONTHS[lang][view.m]} {view.y}
            </strong>
            <span className="dp-nav">
              <button type="button" aria-label="previous month" onClick={() => shift(-1)}>
                <Icon name="chevronDown" size={18} stroke={2.2} />
              </button>
              <button type="button" aria-label="next month" onClick={() => shift(1)}>
                <Icon name="chevronDown" size={18} stroke={2.2} />
              </button>
            </span>
          </div>
          <div className="dp-grid dp-dow">
            {heads.map((h, i) => (
              <span key={i}>{h}</span>
            ))}
          </div>
          <div className="dp-grid">
            {Array.from({ length: blanks }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: count }, (_, i) => {
              const day = iso(view.y, view.m, i + 1);
              return (
                <button
                  key={day}
                  type="button"
                  className={`dp-day ${day === value ? 'sel' : ''} ${day === today ? 'today' : ''}`}
                  onClick={() => onChange(day)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="dp-actions">
            <button
              type="button"
              className="dp-btn dp-btn-grey"
              onClick={() => {
                onChange(today);
                const n = parts(today);
                setView({ y: n.y, m: n.m });
              }}
            >
              {t('dp_today')}
            </button>
            <button type="button" className="dp-btn dp-btn-main" onClick={() => setOpen(false)}>
              {t('dp_done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
