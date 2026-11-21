import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string; // "HH:MM" or "HH:MM:SS"
  label: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const QUICK = ['07:00', '09:00', '12:00', '18:00', '20:00'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Digital time entry: the person types hours and minutes; no analog dial. */
export function TimeEntry({ value, label, disabled, onChange }: Props) {
  const [h, m] = value.slice(0, 5).split(':');
  const [hh, setHh] = useState(h);
  const [mm, setMm] = useState(m);
  const minutesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHh(h);
    setMm(m);
  }, [h, m]);

  function commit(nextH: string, nextM: string) {
    const hours = Math.min(23, Math.max(0, Number(nextH) || 0));
    const minutes = Math.min(59, Math.max(0, Number(nextM) || 0));
    setHh(pad(hours));
    setMm(pad(minutes));
    onChange(`${pad(hours)}:${pad(minutes)}`);
  }

  // A third typed digit starts a fresh entry instead of needing the old text to be selected.
  const digits = (raw: string) => {
    const only = raw.replace(/\D/g, '');
    return only.length > 2 ? only.slice(-1) : only;
  };
  const current = `${h}:${m}`;

  return (
    <div className={`time-entry ${disabled ? 'is-off' : ''}`} role="group" aria-label={label}>
      <div className="time-digits" dir="ltr">
        <input
          className="time-seg"
          inputMode="numeric"
          aria-label={`${label} (hh)`}
          maxLength={2}
          disabled={disabled}
          value={hh}
          onFocus={(event) => {
            const el = event.target;
            window.setTimeout(() => el.setSelectionRange(el.value.length, el.value.length), 0);
          }}
          onContextMenu={(event) => event.preventDefault()}
          onChange={(event) => {
            const next = digits(event.target.value);
            setHh(next);
            if (next.length === 2) {
              commit(next, mm);
              minutesRef.current?.focus();
            }
          }}
          onBlur={() => commit(hh, mm)}
        />
        <span className="time-colon" aria-hidden="true">
          :
        </span>
        <input
          ref={minutesRef}
          className="time-seg"
          inputMode="numeric"
          aria-label={`${label} (mm)`}
          maxLength={2}
          disabled={disabled}
          value={mm}
          onFocus={(event) => {
            const el = event.target;
            window.setTimeout(() => el.setSelectionRange(el.value.length, el.value.length), 0);
          }}
          onContextMenu={(event) => event.preventDefault()}
          onChange={(event) => {
            const next = digits(event.target.value);
            setMm(next);
            if (next.length === 2) commit(hh, next);
          }}
          onBlur={() => commit(hh, mm)}
        />
      </div>
      <div className="time-quick" dir="ltr">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            disabled={disabled}
            className={`time-chip ${q === current ? 'on' : ''}`}
            onClick={() => commit(q.slice(0, 2), q.slice(3))}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
