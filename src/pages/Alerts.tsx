import { Icon } from '../components/Icon';
import { ErrorBanner, Switch } from '../components/ui';
import { addDays, daysUntil, toISO } from '../lib/dates';
import { notificationBody } from '../lib/planner';
import { useData } from '../state/DataProvider';

const PRESETS: { days: number; label: string }[] = [
  { days: 7, label: 'قبل 7 أيام' },
  { days: 3, label: 'قبل 3 أيام' },
  { days: 1, label: 'قبل يوم واحد' },
  { days: 0, label: 'يوم الانتهاء' },
];

function activeText(count: number): string {
  if (count === 0) return 'لا توجد تنبيهات مفعّلة';
  if (count === 1) return 'تنبيه واحد مفعّل';
  if (count === 2) return 'تنبيهان مفعّلان';
  return `${count} تنبيهات مفعّلة`;
}

export default function Alerts() {
  const { settings, products, permission, error, updateSettings } = useData();
  const rules = [...new Set(settings.default_remind_days)];
  const customIsPreset = PRESETS.some((p) => p.days === settings.custom_days);
  const customOn = !customIsPreset && rules.includes(settings.custom_days);

  function setRules(next: number[]) {
    void updateSettings({ default_remind_days: [...new Set(next)].sort((a, b) => b - a) });
  }

  function toggle(days: number, on: boolean) {
    setRules(on ? [...rules, days] : rules.filter((d) => d !== days));
  }

  function changeCustom(value: number) {
    const next = Math.max(1, Math.min(365, value));
    if (next === settings.custom_days) return;
    const wasOn = customOn;
    const withoutOld = rules.filter((d) => d !== settings.custom_days || customIsPreset);
    void updateSettings({
      custom_days: next,
      default_remind_days: [...new Set(wasOn ? [...withoutOld, next] : rules)].sort((a, b) => b - a),
    });
  }

  // Example notification built from the nearest real product, or a placeholder.
  const sample = products.find((p) => daysUntil(p.expiry_date) >= 0);
  const lead = [...rules].sort((a, b) => b - a)[0] ?? 3;
  const sampleName = sample?.name ?? 'اسم المنتج';
  const sampleExpiry = sample?.expiry_date ?? addDays(toISO(new Date()), lead);

  return (
    <div className="page page-narrow">
      <header className="stack-sm">
        <h1>التنبيهات</h1>
        <span className="muted">أنت تقرّر متى يصلك التذكير.</span>
      </header>

      <ErrorBanner message={error} />

      <div className="master">
        <span className="master-icon">
          <Icon name="bell" size={22} />
        </span>
        <span className="master-text">
          <strong>تفعيل التنبيهات</strong>
          <span className="small">{settings.notifications_enabled ? activeText(rules.length) : 'متوقفة'}</span>
        </span>
        <Switch
          checked={settings.notifications_enabled}
          label="تفعيل التنبيهات"
          tone="light"
          onChange={(value) => void updateSettings({ notifications_enabled: value })}
        />
      </div>

      {permission === 'denied' && settings.notifications_enabled && (
        <div className="banner banner-peach" role="alert">
          التنبيهات محجوبة من إعدادات الهاتف. فعّلها لهذا التطبيق حتى تصلك التذكيرات.
        </div>
      )}

      <span className="section-label">متى تنبّهني؟</span>
      <div className="card rules">
        {PRESETS.map((preset) => (
          <div className="rule" key={preset.days}>
            <span className="row-name">{preset.label}</span>
            <Switch
              checked={rules.includes(preset.days)}
              label={preset.label}
              disabled={!settings.notifications_enabled}
              onChange={(value) => toggle(preset.days, value)}
            />
          </div>
        ))}
      </div>

      <div className="card custom-card">
        <span className="stack-xs">
          <span className="row-name">تنبيه مخصص</span>
          <span className="muted small">
            {customIsPreset ? 'هذه القيمة موجودة في القائمة أعلاه' : 'اختر عدد الأيام بنفسك'}
          </span>
        </span>
        <span className="custom-controls">
          <span className="stepper">
            <button
              type="button"
              className="step-btn step-btn-sm"
              aria-label="إنقاص الأيام"
              onClick={() => changeCustom(settings.custom_days - 1)}
            >
              <Icon name="minus" size={16} stroke={2.4} />
            </button>
            <span className="step-value step-value-sm" aria-live="polite">
              {settings.custom_days}
            </span>
            <button
              type="button"
              className="step-btn step-btn-sm"
              aria-label="زيادة الأيام"
              onClick={() => changeCustom(settings.custom_days + 1)}
            >
              <Icon name="plus" size={16} stroke={2.4} />
            </button>
          </span>
          <Switch
            checked={customOn}
            label="تفعيل التنبيه المخصص"
            disabled={!settings.notifications_enabled || customIsPreset}
            onChange={(value) => toggle(settings.custom_days, value)}
          />
        </span>
      </div>

      <label className="card time-row" htmlFor="notify-time">
        <span className="time-label">
          <Icon name="clock" size={20} />
          وقت التنبيه
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

      <span className="section-label">هكذا يظهر التنبيه</span>
      <div className="card notif-preview">
        <span className="logo logo-sm">
          <Icon name="calendarCheck" size={22} />
        </span>
        <span className="notif-text">
          <span className="notif-top">
            <span>صلاحيتي</span>
            <span>الآن</span>
          </span>
          <span className="notif-body">{notificationBody(sampleName, lead, sampleExpiry)}</span>
        </span>
      </div>
    </div>
  );
}
