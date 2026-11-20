import { Link, NavLink, Outlet } from 'react-router-dom';
import { t } from '../lib/i18n';
import { useData } from '../state/DataProvider';
import { Icon, type IconName } from './Icon';

type Tab = { to: string; label: string; icon: IconName; end?: boolean };

function tabs(): Tab[] {
  return [
    { to: '/', label: t('nav_home'), icon: 'home', end: true },
    { to: '/products', label: t('nav_products'), icon: 'cube' },
    { to: '/alerts', label: t('nav_alerts'), icon: 'bell' },
    { to: '/profile', label: t('nav_profile'), icon: 'user' },
  ];
}

export function userDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string } | null): string {
  const meta = user?.user_metadata ?? {};
  const name = (meta.display_name ?? meta.full_name ?? meta.name) as string | undefined;
  return name?.trim() || user?.email?.split('@')[0] || t('nav_profile');
}

function BottomTab({ tab }: { tab: Tab }) {
  return (
    <NavLink to={tab.to} end={tab.end} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
      <span className="tab-icon">
        <Icon name={tab.icon} />
      </span>
      {tab.label}
    </NavLink>
  );
}

export function AppShell() {
  const { user } = useData();
  const name = userDisplayName(user);
  const TABS = tabs();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">
            <Icon name="star" />
          </span>
          <span className="brand-name">{t('app_name')}</span>
        </div>
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
          >
            <Icon name={tab.icon} size={22} />
            {tab.label}
          </NavLink>
        ))}
        <span className="grow" />
        <Link to="/scan" className="btn btn-primary">
          <Icon name="plus" size={20} stroke={2.2} />
          {t('add_product')}
        </Link>
        <div className="side-user">
          <span className="avatar avatar-sm">{name.slice(0, 1)}</span>
          <span className="side-user-text">
            <span className="side-user-name">{name}</span>
            <span className="side-user-mail">{user?.email}</span>
          </span>
        </div>
      </aside>

      <main className="shell-main">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label={t('nav_aria')}>
        <BottomTab tab={TABS[0]} />
        <BottomTab tab={TABS[1]} />
        <Link to="/scan" className="fab" aria-label={t('add_product')}>
          <Icon name="plus" size={26} stroke={2} />
        </Link>
        <BottomTab tab={TABS[2]} />
        <BottomTab tab={TABS[3]} />
      </nav>
    </div>
  );
}
