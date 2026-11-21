import { useState } from 'react';
import { GoogleLogo, Icon } from '../components/Icon';
import { t } from '../lib/i18n';
import { useData } from '../state/DataProvider';

export default function Login() {
  const { signInWithGoogle, authError } = useData();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-inner">
        <div className="brand">
          <span className="logo">
            <Icon name="star" />
          </span>
          <span className="brand-name">{t('app_name')}</span>
        </div>

        <div className="hero-bento" aria-hidden="true">
          <div className="tile tone-peach hero-big">
            <span className="tile-label">{t('demo_yogurt')}</span>
            <span className="tile-num tile-num-xl">3</span>
            <span className="tile-sub">{t('demo_left')}</span>
          </div>
          <div className="tile tone-mint">
            <span className="tile-label">{t('demo_juice')}</span>
            <span className="tile-num">
              12 <small>{t('demo_days')}</small>
            </span>
          </div>
          <div className="tile tone-lilac">
            <Icon name="bell" />
            <span className="tile-label">{t('demo_alert')}</span>
          </div>
        </div>

        <h1 className="login-title">{t('login_title')}</h1>
        <p className="muted login-text">
          {t('login_text')}
        </p>

        <span className="grow" />

        {authError && (
          <div className="banner banner-rose" role="alert">
            {authError}
          </div>
        )}
        <button type="button" className="btn btn-google" onClick={() => void start()} disabled={busy}>
          <GoogleLogo />
          {busy ? t('login_btn_busy') : t('login_btn')}
        </button>
        <p className="muted small center">{t('login_note')}</p>
      </div>
    </div>
  );
}
