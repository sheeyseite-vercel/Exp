import { useState } from 'react';
import { evaluate, toDecimal, toMoney } from '../lib/calc';
import { t } from '../lib/i18n';
import { Icon } from './Icon';

const ROWS: string[][] = [
  ['AC', '⌫', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
];

function readDark(): boolean {
  try {
    return localStorage.getItem('salahiyati:calc-dark') === '1';
  } catch {
    return false;
  }
}

/** A small exact calculator, e.g. to divide a whole line total by the number of units. */
export function Calculator({ onClose, onUse }: { onClose: () => void; onUse: (money: string) => void }) {
  const [text, setText] = useState('');
  const [dark, setDark] = useState(readDark);
  const value = evaluate(text);
  const shown = value ? toDecimal(value) : text === '' ? '0' : '…';

  function press(key: string) {
    if (key === 'AC') setText('');
    else if (key === '⌫') setText((s) => s.slice(0, -1));
    else if (key === '=') {
      if (value) setText(toDecimal(value));
    } else if ('+−×÷'.includes(key)) {
      setText((s) => (s === '' ? (key === '−' ? '−' : '') : /[+−×÷]$/.test(s) ? s.slice(0, -1) + key : s + key));
    } else if (key === '%') {
      setText((s) => (/[0-9%]$/.test(s) ? s + '%' : s));
    } else if (key === '.') {
      setText((s) => {
        const last = s.split(/[+−×÷]/).pop() ?? '';
        return last.includes('.') ? s : s + (last === '' ? '0.' : '.');
      });
    } else setText((s) => s + key);
  }

  function toggle() {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem('salahiyati:calc-dark', next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  const key = (k: string, cls = '') => (
    <button
      key={k}
      type="button"
      className={`ck ${cls}`}
      onPointerDown={(event) => {
        event.preventDefault();
        press(k);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          press(k);
        }
      }}
      aria-label={k === '⌫' ? t('delete') : k}
    >
      {k === '⌫' ? <Icon name="backspace" size={22} stroke={1.9} /> : k}
    </button>
  );

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`calc ${dark ? 'calc-dark' : ''}`} role="dialog" aria-label={t('calc_title')} onClick={(event) => event.stopPropagation()}>
        <div className="calc-top">
          <button type="button" className="calc-x" aria-label={t('cancel')} onClick={onClose}>
            <Icon name="close" size={18} stroke={2.2} />
          </button>
          <button type="button" className="calc-x" aria-label="theme" onClick={toggle}>
            <Icon name={dark ? 'sun' : 'moon'} size={18} />
          </button>
        </div>
        <div className="calc-screen" dir="ltr">
          <span className="calc-expr">{text || ' '}</span>
          <strong className="calc-res">{text === '' ? '0' : `=${shown}`}</strong>
        </div>
        <div className="calc-keys" dir="ltr">
          {ROWS.map((row) =>
            row.map((k) => key(k, '+−×÷'.includes(k) ? 'ck-op' : k === 'AC' || k === '⌫' || k === '%' ? 'ck-fn' : '')),
          )}
          {key('0', 'ck-zero')}
          {key('.')}
          {key('=', 'ck-eq')}
        </div>
        <button
          type="button"
          className="btn btn-primary calc-use"
          disabled={!value}
          onClick={() => {
            if (value) onUse(toMoney(value));
          }}
        >
          <Icon name="check" size={18} stroke={2.4} />
          {value ? t('calc_use', { v: toMoney(value) }) : t('calc_title')}
        </button>
      </div>
    </div>
  );
}
