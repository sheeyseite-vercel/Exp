import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { ErrorBanner, Switch } from '../components/ui';
import { addDays, daysPhrase, daysUntil, toISO } from '../lib/dates';
import { t, type TKey } from '../lib/i18n';
import { exactAlarmState, openExactAlarmSettings, type ExactAlarmState } from '../lib/notifications';
import { notificationBody } from '../lib/planner';
import { useData } from '../state/DataProvider';

const PRESETS: { days: number; title: TKey; text: TKey }[] = [
  { days: 7, title: 'opt_7', text: 'opt_7_d' },
  { days: 1, title: 'opt_1', text: 'opt_1_d' },
  { days: 0, title: 'opt_0', text: 'opt_0_d' },
];
const PRESET_DAYS = PRESETS.map((p) => p.days);

function activeText(count: number): string {
  if (count === 0) return t('alerts_active0');
  if (count === 1) return t('alerts_active1');
  if (count === 2) return t('alerts_active2');
  return t('alerts_activen', { n: count });
}

export default function Alerts() {
  const { settings, products, permission, error, updateSettings } = useData();
  const rules = [...new Set(settings.default_remind_days)];
  const extras = rules.filter((d) => !PRESET_DAYS.includes(d)).sort((a, b) => b - a);
  const enabled = settings.notifications_enabled;
  const [exact, setExact] = useState<ExactAlarmState>('unsupported');

  useEffect(() => {
    const check = () => void exactAlarmState().then(setExact);
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  function setRules(next: number[]) {
    void updateSettings({ default_remind_days: [...new Set(next)].sort((a, b) => b - a) });
  }

  function toggle(days: number) {
    setRules(rules.includes(days) ? rules.filter((d) => d !== days) : [...rules, days]);
  }

  function setCustom(value: number) {
    const next = Math.max(1, Math.min(365, value));
    if (next !== settings.custom_days) void updateSettings({ custom_days: next });
  }

  // Example notification built from the nearest real product, or a placeholder.
  const sample = products.find((p) => daysUntil(p.expiry_date) >= 0);
  const lead = [...rules].sort((a, b) => b - a)[0] ?? 3;
  const sampleName = sample?.name ?? t('sample_name');
  const sampleExpiry = sample?.expiry_date ?? addDays(toISO(new Date()), lead);

  return (
    <div className="page page-narrow">
      <p className="muted">{t('alerts_sub')}</p>

      <ErrorBanner message={error} />

      <div className="master">
        <span className="master-icon">
          <Icon name="bell" size={22} />
        </span>
        <span className="master-text">
          <strong>{t('alerts_master')}</strong>
          <span className="small">{enabled ? activeText(rules.length) : t('alerts_stopped')}</span>
        </span>
        <Switch
          checked={enabled}
          label={t('alerts_master')}
          tone="light"
          onChange={(value) => void updateSettings({ notifications_enabled: value })}
        />
      </div>

      {permission === 'denied' && enabled && (
        <div className="banner banner-peach" role="alert">
          {t('perm_denied')}
        </div>
      )}

      {exact === 'denied' && enabled && (
        <div className="banner banner-peach exact-banner" role="alert">
          <span>{t('exact_note')}</span>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => void openExactAlarmSettings()}>
            {t('exact_btn')}
          </button>
        </div>
      )}

      <div className="stack-xs">
        <span className="section-label">{t('when_title')}</span>
        <span className="muted small">{t('when_hint')}</span>
      </div>

      <div className={`options ${enabled ? '' : 'is-off'}`} role="group" aria-label={t('when_title')}>
        {PRESETS.map((preset) => {
          const on = rules.includes(preset.days);
          return (
            <button
              key={preset.days}
              type="button"
              aria-pressed={on}
              disabled={!enabled}
              className={`option ${on ? 'on' : ''}`}
              onClick={() => toggle(preset.days)}
            >
              <span className="option-check">{on && <Icon name="check" size={16} stroke={2.6} />}</span>
              <span className="option-text">
                <strong>{t(preset.title)}</strong>
                <span className="small">{t(preset.text)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className={`card custom-card ${enabled ? '' : 'is-off'}`}>
        <span className="stack-xs">
          <span className="row-name">{t('custom_title')}</span>
          <span className="muted small">{t('custom_hint')}</span>
        </span>
        <span className="custom-controls">
          <span className="stepper">
            <button
              type="button"
              className="step-btn step-btn-sm"
              aria-label={t('custom_dec')}
              disabled={!enabled}
              onClick={() => setCustom(settings.custom_days - 1)}
            >
              <Icon name="minus" size={16} stroke={2.4} />
            </button>
            <span className="step-value step-value-sm" aria-live="polite">
              {settings.custom_days}
            </span>
            <button
              type="button"
              className="step-btn step-btn-sm"
              aria-label={t('custom_inc')}
              disabled={!enabled}
              onClick={() => setCustom(settings.custom_days + 1)}
            >
              <Icon name="plus" size={16} stroke={2.4} />
            </button>
          </span>
          <button
            type="button"
            className="btn btn-soft btn-sm"
            disabled={!enabled || rules.includes(settings.custom_days)}
            onClick={() => setRules([...rules, settings.custom_days])}
          >
            {t('add')}
          </button>
        </span>
      </div>

      {extras.length > 0 && (
        <div className="stack">
          <span className="section-label">{t('custom_mine')}</span>
          <div className="pills">
            {extras.map((days) => (
              <button
                key={days}
                type="button"
                className="pill pill-check on"
                aria-label={`${t('remove')}: ${daysPhrase(days)}`}
                disabled={!enabled}
                onClick={() => toggle(days)}
              >
                {t('tl_before', { days: daysPhrase(days) })}
                <Icon name="close" size={14} stroke={2.4} />
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="card time-row" htmlFor="notify-time">
        <span className="time-label">
          <Icon name="clock" size={20} />
          {t('time_label')}
        </span>
        <input
          id="notify-time"
          type="time"
          className="time-input"
          value={settings.notify_time.slice(0, 5)}
          onChange={(event) => {
            if (event.target.value) void updateSettings({ notify_time: `${event.target.value}:00` });
          }}
        />
      </label>

      <span className="section-label">{t('preview_title')}</span>
      <div className="card notif-preview">
        <span className="logo logo-sm">
          <Icon name="star" size={22} />
        </span>
        <span className="notif-text">
          <span className="notif-top">
            <span>{t('app_name')}</span>
            <span>{t('now')}</span>
          </span>
          <span className="notif-body">{notificationBody(sampleName, lead, sampleExpiry)}</span>
        </span>
      </div>
    </div>
  );
}
