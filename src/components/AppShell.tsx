import { Link, NavLink, Outlet } from 'react-router-dom';
import { useData } from '../state/DataProvider';
import { Icon, type IconName } from './Icon';

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'الرئيسية', icon: 'home', end: true },
  { to: '/products', label: 'المنتجات', icon: 'cube' },
  { to: '/alerts', label: 'التنبيهات', icon: 'bell' },
  { to: '/profile', label: 'حسابي', icon: 'user' },
];

export function userDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string } | null): string {
  const meta = user?.user_metadata ?? {};
  const name = (meta.full_name ?? meta.name) as string | undefined;
  return name?.trim() || user?.email?.split('@')[0] || 'حسابي';
}

function BottomTab({ tab }: { tab: (typeof TABS)[number] }) {
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

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">
            <Icon name="calendarCheck" />
          </span>
          <span className="brand-name">صلاحيتي</span>
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
          إضافة منتج
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

      <nav className="bottom-nav" aria-label="التنقل الرئيسي">
        <BottomTab tab={TABS[0]} />
        <BottomTab tab={TABS[1]} />
        <Link to="/scan" className="fab" aria-label="إضافة منتج">
          <Icon name="plus" size={26} stroke={2} />
        </Link>
        <BottomTab tab={TABS[2]} />
        <BottomTab tab={TABS[3]} />
      </nav>
    </div>
  );
}
