import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n';
import { Icon } from './Icon';
import { LogoGlyph } from './LogoGlyph';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

interface Props {
  title: string;
  subtitle?: string;
  error?: string | null;
  /** Return false to shake and clear the dots (wrong PIN); true keeps them filled while the parent moves on. */
  onComplete: (pin: string) => Promise<boolean>;
  onCancel?: () => void;
}

/** A 4-digit PIN entry: app logo, title, four dots and a round keypad. */
export function PinPad({ title, subtitle, error, onComplete, onCancel }: Props) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function press(digit: string) {
    if (busy || value.length >= 4) return;
    const next = value + digit;
    setValue(next);
    if (next.length < 4) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 160));
    const ok = await onComplete(next);
    if (!alive.current) return;
    if (!ok) {
      setShake(true);
      await new Promise((r) => setTimeout(r, 380));
      if (!alive.current) return;
      setShake(false);
      setValue('');
    }
    setBusy(false);
  }

  const key = (label: string) => (
    <button key={label} type="button" className="pin-key" disabled={busy} onClick={() => void press(label)}>
      {label}
    </button>
  );

  return (
    <div className="pin">
      <span className="logo logo-lg pin-logo">
        <LogoGlyph />
      </span>
      <h1 className="pin-title">{title}</h1>
      <p className="pin-sub">{subtitle ?? ' '}</p>
      <div className={`pin-dots ${shake ? 'shake' : ''}`} aria-label={`${value.length}/4`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`pin-dot ${i < value.length ? 'on' : ''}`} />
        ))}
      </div>
      <p className="pin-error" role="alert">
        {error ?? ' '}
      </p>
      <div className="pin-grid">
        {KEYS.map(key)}
        {onCancel ? (
          <button type="button" className="pin-side" onClick={onCancel}>
            {t('pin_cancel')}
          </button>
        ) : (
          <span />
        )}
        {key('0')}
        <button
          type="button"
          className="pin-side"
          aria-label={t('delete')}
          disabled={busy || value.length === 0}
          onClick={() => setValue(value.slice(0, -1))}
        >
          <Icon name="close" size={22} stroke={1.8} />
        </button>
      </div>
    </div>
  );
}
