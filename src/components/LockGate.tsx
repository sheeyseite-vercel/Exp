import { App as CapApp } from '@capacitor/app';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { t } from '../lib/i18n';
import { lockNow, unlock, usePinState, verifyPin } from '../lib/pin';
import { PinPad } from './PinPad';
import { useState } from 'react';

const RELOCK_AFTER_MS = 30_000;

function LockScreen() {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="lock" role="dialog" aria-label={t('pin_unlock')}>
      <PinPad
        title={t('pin_unlock')}
        subtitle={t('pin_unlock_sub')}
        error={error}
        onComplete={async (pin) => {
          const res = await verifyPin(pin);
          if (res.ok) {
            setError(null);
            unlock();
            return true;
          }
          setError(res.wait > 0 ? t('pin_wait', { s: res.wait }) : t('pin_wrong'));
          return false;
        }}
      />
    </div>
  );
}

/** Shows the PIN screen over the app on launch, and again after the app was in the background for a while. */
export function LockGate({ children }: { children: ReactNode }) {
  const { enabled, locked } = usePinState();

  useEffect(() => {
    if (!enabled) return;
    let hiddenAt: number | null = null;
    const away = () => {
      if (hiddenAt === null) hiddenAt = Date.now();
    };
    const back = () => {
      if (hiddenAt !== null && Date.now() - hiddenAt > RELOCK_AFTER_MS) lockNow();
      hiddenAt = null;
    };
    const onVisibility = () => (document.hidden ? away() : back());
    document.addEventListener('visibilitychange', onVisibility);
    const handle = CapApp.addListener('appStateChange', ({ isActive }) => (isActive ? back() : away()));
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void handle.then((h) => h.remove()).catch(() => undefined);
    };
  }, [enabled]);

  return (
    <>
      {children}
      {enabled && locked && <LockScreen />}
    </>
  );
}
