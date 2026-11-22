import { useState } from 'react';
import { t } from '../lib/i18n';
import { removePin, setPin, verifyPin } from '../lib/pin';
import { PinPad } from './PinPad';

export type PinMode = 'set' | 'change' | 'remove';
type Step = 'current' | 'choose' | 'confirm';

/** Full-screen flow to turn the lock on, change the PIN, or remove it. */
export function PinSetup({ mode, onClose }: { mode: PinMode; onClose: (message?: string) => void }) {
  const [step, setStep] = useState<Step>(mode === 'set' ? 'choose' : 'current');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Changing the step remounts the keypad so the dots start empty.
  const [round, setRound] = useState(0);

  const go = (next: Step) => {
    setStep(next);
    setRound((r) => r + 1);
  };

  async function onComplete(pin: string): Promise<boolean> {
    if (step === 'current') {
      const res = await verifyPin(pin);
      if (!res.ok) {
        setError(res.wait > 0 ? t('pin_wait', { s: res.wait }) : t('pin_wrong'));
        return false;
      }
      setError(null);
      if (mode === 'remove') {
        removePin();
        onClose(t('pin_removed'));
        return true;
      }
      go('choose');
      return true;
    }
    if (step === 'choose') {
      setFirst(pin);
      setError(null);
      go('confirm');
      return true;
    }
    if (pin !== first) {
      setError(t('pin_mismatch'));
      go('choose');
      return true;
    }
    await setPin(pin);
    onClose(mode === 'change' ? t('pin_changed') : t('pin_enabled'));
    return true;
  }

  const title = step === 'current' ? t('pin_current') : step === 'choose' ? t('pin_choose') : t('pin_reenter');
  const subtitle = step === 'choose' ? t('pin_choose_sub') : undefined;

  return (
    <div className="lock" role="dialog" aria-label={title}>
      <PinPad key={round} title={title} subtitle={subtitle} error={error} onComplete={onComplete} onCancel={() => onClose()} />
    </div>
  );
}
