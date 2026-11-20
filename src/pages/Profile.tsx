import { userDisplayName } from '../components/AppShell';
import { GoogleLogo, Icon } from '../components/Icon';
import { ErrorBanner, Switch } from '../components/ui';
import { useData } from '../state/DataProvider';

function syncText(lastSync: Date | null): string {
  if (!lastSync) return 'لم تتم المزامنة بعد';
  const minutes = Math.floor((Date.now() - lastSync.getTime()) / 60_000);
  if (minutes < 1) return 'آخر مزامنة الآن';
  if (minutes === 1) return 'آخر مزامنة قبل دقيقة';
  if (minutes === 2) return 'آخر مزامنة قبل دقيقتين';
  if (minutes <= 10) return `آخر مزامنة قبل ${minutes} دقائق`;
  if (minutes < 60) return `آخر مزامنة قبل ${minutes} دقيقة`;
  return `آخر مزامنة ${lastSync.toLocaleTimeString('ar-DZ-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function Profile() {
  const { user, products, consumedCount, settings, lastSync, error, loading, refresh, signOut, updateSettings } =
    useData();
  const name = userDisplayName(user);

  return (
    <div className="page page-narrow">
      <h1>حسابي</h1>

      <ErrorBanner message={error} />

      <div className="card profile-card">
        <span className="avatar">{name.slice(0, 1)}</span>
        <span className="profile-text">
          <strong>{name}</strong>
          <span className="muted small ltr">{user?.email}</span>
        </span>
        <span className="chip chip-mint chip-icon">
          <GoogleLogo size={14} />
          Google
        </span>
      </div>

      <div className="stats">
        <div className="tile tone-sky">
          <span className="tile-label">منتجات متتبَّعة</span>
          <span className="tile-num">{products.length}</span>
        </div>
        <div className="tile tone-mint">
          <span className="tile-label">تم استهلاكها</span>
          <span className="tile-num">{consumedCount}</span>
        </div>
      </div>

      <span className="section-label">البيانات</span>
      <div className="card rules">
        <div className="rule">
          <span className="row-name">المزامنة</span>
          <button type="button" className="chip chip-mint chip-btn" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'جارٍ التحديث…' : syncText(lastSync)}
          </button>
        </div>
        <div className="rule">
          <span className="row-name">حذف المنتجات المنتهية تلقائيًا</span>
          <Switch
            checked={settings.auto_delete_expired}
            label="حذف المنتجات المنتهية تلقائيًا"
            onChange={(value) => void updateSettings({ auto_delete_expired: value })}
          />
        </div>
      </div>

      <button type="button" className="btn btn-danger-soft" onClick={() => void signOut()}>
        <Icon name="logout" size={20} stroke={1.9} />
        تسجيل الخروج
      </button>
    </div>
  );
}
