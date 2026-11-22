import { useSyncExternalStore } from 'react';

const KEY = 'salahiyati:pin';
const FAIL_KEY = 'salahiyati:pin-fail';

interface Stored {
  salt: string;
  hash: string;
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Stored;
      if (v.salt && v.hash) return v;
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

async function digest(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Very old WebViews without SubtleCrypto: a simple 53-bit hash is still better than storing the PIN.
  let h = 0xcbf29ce484222325n;
  for (const byte of data) h = ((h ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn;
  return h.toString(16);
}

interface PinState {
  enabled: boolean;
  locked: boolean;
}

let state: PinState = (() => {
  const enabled = readStored() !== null;
  return { enabled, locked: enabled };
})();
const listeners = new Set<() => void>();

function update(next: PinState) {
  state = next;
  listeners.forEach((l) => l());
}

export function usePinState(): PinState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export async function setPin(pin: string): Promise<void> {
  const salt = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
  const stored: Stored = { salt, hash: await digest(pin, salt) };
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
    localStorage.removeItem(FAIL_KEY);
  } catch {
    throw new Error('storage unavailable');
  }
  update({ enabled: true, locked: false });
}

export function removePin(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(FAIL_KEY);
  } catch {
    /* storage unavailable */
  }
  update({ enabled: false, locked: false });
}

function readFails(): { n: number; until: number } {
  try {
    const v = JSON.parse(localStorage.getItem(FAIL_KEY) ?? 'null') as { n: number; until: number } | null;
    if (v && typeof v.n === 'number') return v;
  } catch {
    /* storage unavailable */
  }
  return { n: 0, until: 0 };
}

export type VerifyResult = { ok: true } | { ok: false; wait: number };

/** Checks a PIN. After 5 wrong tries in a row the next tries are blocked for a growing delay. */
export async function verifyPin(pin: string): Promise<VerifyResult> {
  const fails = readFails();
  const remaining = Math.ceil((fails.until - Date.now()) / 1000);
  if (remaining > 0) return { ok: false, wait: remaining };
  const stored = readStored();
  if (!stored) return { ok: true };
  if ((await digest(pin, stored.salt)) === stored.hash) {
    try {
      localStorage.removeItem(FAIL_KEY);
    } catch {
      /* storage unavailable */
    }
    return { ok: true };
  }
  const n = fails.n + 1;
  const until = n % 5 === 0 ? Date.now() + 30_000 * (n / 5) : 0;
  try {
    localStorage.setItem(FAIL_KEY, JSON.stringify({ n, until }));
  } catch {
    /* storage unavailable */
  }
  return { ok: false, wait: until ? Math.ceil((until - Date.now()) / 1000) : 0 };
}

export function unlock(): void {
  if (state.locked) update({ ...state, locked: false });
}

export function lockNow(): void {
  if (state.enabled && !state.locked) update({ ...state, locked: true });
}
