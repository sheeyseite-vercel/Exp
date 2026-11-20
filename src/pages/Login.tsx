import { useState } from 'react';
import { GoogleLogo, Icon } from '../components/Icon';
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
            <Icon name="calendarCheck" />
          </span>
          <span className="brand-name">صلاحيتي</span>
        </div>

        <div className="hero-bento" aria-hidden="true">
          <div className="tile tone-peach hero-big">
            <span className="tile-label">زبادي طبيعي</span>
            <span className="tile-num tile-num-xl">3</span>
            <span className="tile-sub">أيام حتى الانتهاء</span>
          </div>
          <div className="tile tone-mint">
            <span className="tile-label">عصير برتقال</span>
            <span className="tile-num">
              12 <small>يومًا</small>
            </span>
          </div>
          <div className="tile tone-lilac">
            <Icon name="bell" />
            <span className="tile-label">تنبيه قبل 7 أيام</span>
          </div>
        </div>

        <h1 className="login-title">اعرف متى تنتهي صلاحية كل منتج قبل أن يفسد</h1>
        <p className="muted login-text">
          امسح رمز QR أو صوّر المنتج أو أدخل بياناته بنفسك، وسنذكّرك في الوقت الذي تختاره.
        </p>

        <span className="grow" />

        {authError && (
          <div className="banner banner-rose" role="alert">
            {authError}
          </div>
        )}
        <button type="button" className="btn btn-google" onClick={() => void start()} disabled={busy}>
          <GoogleLogo />
          {busy ? 'جارٍ فتح Google…' : 'المتابعة باستخدام Google'}
        </button>
        <p className="muted small center">بياناتك محفوظة في حسابك وتتزامن تلقائيًا بين أجهزتك.</p>
      </div>
    </div>
  );
}
