import { useState } from 'react';
import { userDisplayName } from '../components/AppShell';
import { GoogleLogo, Icon, type IconName } from '../components/Icon';
import { LangSwitch } from '../components/LangSwitch';
import { ErrorBanner, Switch } from '../components/ui';
import { t } from '../lib/i18n';
import { sendTestNotification } from '../lib/notifications';
import { useData } from '../state/DataProvider';

function syncText(lastSync: Date | null): string {
  if (!lastSync) return t('sync_never');
  const minutes = Math.floor((Date.now() - lastSync.getTime()) / 60_000);
  if (minutes < 1) return t('sync_now');
  if (minutes === 1) return t('sync_1');
  if (minutes === 2) return t('sync_2');
  if (minutes <= 10) return t('sync_few', { n: minutes });
  if (minutes < 60) return t('sync_many', { n: minutes });
  return t('sync_at', { time: lastSync.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) });
}

function SettingRow({ icon, title, hint, children }: { icon: IconName; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="set-row">
      <span className="set-icon">
        <Icon name={icon} size={20} />
      </span>
      <span className="set-text">
        <strong>{title}</strong>
        {hint && <span className="muted small">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

export default function Profile() {
  const {
    user,
    products,
    consumedCount,
    settings,
    lastSync,
    error,
    loading,
    refresh,
    signOut,
    updateSettings,
    updateDisplayName,
  } = useData();
  const name = userDisplayName(user);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testNote, setTestNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName() {
    const value = draft.trim();
    if (!value) return;
    setNameError(null);
    try {
      await updateDisplayName(value);
      setEditing(false);
    } catch {
      setNameError(t('profile_name_fail'));
    }
  }

  async function runTest() {
    setTesting(true);
    setTestNote(null);
    try {
      const result = await sendTestNotification();
      if (result === 'sent') setTestNote({ ok: true, text: t('test_sent') });
      else if (result === 'denied') setTestNote({ ok: false, text: t('test_denied') });
      else setTestNote({ ok: false, text: t('test_web') });
    } catch {
      setTestNote({ ok: false, text: t('test_fail') });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="page page-narrow">
      <ErrorBanner message={error} />

      <section className="card profile-hero">
        <span className="avatar avatar-xl">{name.slice(0, 1).toUpperCase()}</span>
        {editing ? (
          <form
            className="name-edit"
            onSubmit={(event) => {
              event.preventDefault();
              void saveName();
            }}
          >
            <label className="field-label" htmlFor="display-name">
              {t('profile_name_field')}
            </label>
            <input
              id="display-name"
              type="text"
              value={draft}
              maxLength={40}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
            />
            <span className="name-edit-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={!draft.trim()}>
                {t('save')}
              </button>
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={() => {
                  setEditing(false);
                  setNameError(null);
                }}
              >
                {t('cancel')}
              </button>
            </span>
            {nameError && <span className="small error-text">{nameError}</span>}
          </form>
        ) : (
          <>
            <span className="profile-name">
              <strong>{name}</strong>
              <button
                type="button"
                className="round-btn round-btn-ghost round-btn-sm"
                aria-label={t('profile_edit_name')}
                onClick={() => {
                  setDraft(name);
                  setEditing(true);
                }}
              >
                <Icon name="pencil" size={18} />
              </button>
            </span>
            <span className="muted small ltr">{user?.email}</span>
            <span className="chip chip-mint chip-icon">
              <GoogleLogo size={14} />
              Google
            </span>
          </>
        )}
        <div className="profile-stats">
          <span>
            <strong>{products.length}</strong>
            <span className="muted small">{t('stat_tracked')}</span>
          </span>
          <span>
            <strong>{consumedCount}</strong>
            <span className="muted small">{t('stat_consumed')}</span>
          </span>
        </div>
      </section>

      <span className="section-label">{t('profile_language')}</span>
      <div className="card set-card">
        <SettingRow icon="globe" title={t('profile_language')}>
          <span className="grow" />
        </SettingRow>
        <LangSwitch tone="dark" />
      </div>

      <span className="section-label">{t('profile_data')}</span>
      <div className="card set-card">
        <SettingRow icon="refresh" title={t('sync_title')} hint={loading ? t('sync_busy') : syncText(lastSync)}>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => void refresh()} disabled={loading}>
            <Icon name="refresh" size={16} stroke={2} />
          </button>
        </SettingRow>
        <SettingRow icon="trash" title={t('auto_delete')} hint={t('auto_delete_hint')}>
          <Switch
            checked={settings.auto_delete_expired}
            label={t('auto_delete')}
            onChange={(value) => void updateSettings({ auto_delete_expired: value })}
          />
        </SettingRow>
      </div>

      <span className="section-label">{t('profile_notifications')}</span>
      <div className="card set-card">
        <SettingRow icon="bell" title={t('test_title')} hint={t('test_hint')}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void runTest()} disabled={testing}>
            <Icon name="send" size={16} stroke={2} />
            {t('test_btn')}
          </button>
        </SettingRow>
        {testNote && (
          <div className={`banner ${testNote.ok ? 'banner-mint' : 'banner-peach'}`} role="status">
            {testNote.text}
          </div>
        )}
      </div>

      <button type="button" className="btn btn-danger-soft" onClick={() => void signOut()}>
        <Icon name="logout" size={20} stroke={1.9} />
        {t('sign_out')}
      </button>
    </div>
  );
}
