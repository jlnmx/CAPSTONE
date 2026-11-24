import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, BarChart3, Building2, ChevronDown, ClipboardList,
  LayoutDashboard, LogOut, Map, Menu, Radio, Settings, ShieldCheck,
  Send,
} from 'lucide-react';
import { useAuth } from '../auth';
import { getUsers } from '../api';

const NEW_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const navigationGroups = [
  { label: 'Command', items: [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/map', label: 'Live map', icon: Map },
    { to: '/operations', label: 'Operations', icon: Activity },
    { to: '/dispatch', label: 'Dispatch', icon: Send },
  ] },
  { label: 'Resources', items: [
    { to: '/centers', label: 'Centers', icon: Building2 },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  ] },
  { label: 'Administration', items: [
    { to: '/users', label: 'Users', icon: ShieldCheck },
    { to: '/logs', label: 'Logs', icon: ClipboardList },
  ] },
];

const pageNames: Record<string, string> = {
  '/': 'Overview', '/map': 'Live map', '/operations': 'Operations', '/dispatch': 'Dispatch', '/centers': 'Centers',
  '/analytics': 'Analytics', '/users': 'Users', '/logs': 'Logs',
  '/system': 'System', '/settings': 'Settings',
};

export default function AdminShell({ children }: { children?: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia('(min-width: 821px) and (max-width: 1080px)').matches);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [newUserCount, setNewUserCount] = useState(0);
  const pageTitle = location.pathname.startsWith('/centers/') ? 'Center management' : pageNames[location.pathname] || 'Command Center';
  const initials = (user?.name || 'HA').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  useEffect(() => {
    if (!user?.isSuperAdmin) {
      setNewUserCount(0);
      return undefined;
    }

    let active = true;
    const refreshNewUserCount = async () => {
      try {
        const users = await getUsers();
        if (!active) return;
        const cutoff = Date.now() - NEW_USER_WINDOW_MS;
        setNewUserCount(users.filter((account) => {
          const createdAt = Date.parse(account.createdAt);
          return (account.role === 'Resident' || account.role === 'Responder')
            && (account.status === 'Active' || account.status === 'Pending')
            && Number.isFinite(createdAt)
            && createdAt >= cutoff
            && createdAt <= Date.now();
        }).length);
      } catch (error) {
        console.error('The new-user navigation count could not be refreshed:', error);
      }
    };

    void refreshNewUserCount();
    const interval = window.setInterval(() => { void refreshNewUserCount(); }, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.id, user?.isSuperAdmin]);

  useEffect(() => {
    const mobileBreakpoint = window.matchMedia('(max-width: 820px)');
    const compactBreakpoint = window.matchMedia('(min-width: 821px) and (max-width: 1080px)');
    const updateViewport = () => {
      setIsMobileViewport(mobileBreakpoint.matches);
      setSidebarCollapsed(compactBreakpoint.matches);
      if (mobileBreakpoint.matches) setMenuOpen(false);
    };
    updateViewport();
    mobileBreakpoint.addEventListener('change', updateViewport);
    compactBreakpoint.addEventListener('change', updateViewport);
    return () => {
      mobileBreakpoint.removeEventListener('change', updateViewport);
      compactBreakpoint.removeEventListener('change', updateViewport);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const toggleNavigation = () => {
    if (isMobileViewport) {
      setMenuOpen((open) => !open);
      return;
    }
    setSidebarCollapsed((collapsed) => !collapsed);
  };

  const leave = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`app-frame ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <button className={`sidebar-scrim ${menuOpen ? 'is-visible' : ''}`} onClick={() => setMenuOpen(false)} aria-label="Close navigation" tabIndex={menuOpen ? 0 : -1} />
      <aside id="command-center-sidebar" className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} aria-label="Command center navigation">
        <div className="brand-lockup">
          <div className="brand-emblem"><img src="/handa-logo.png" alt="HANDA logo" /></div>
          <div className="brand-copy"><strong>HANDA</strong><span>COMMAND CENTER</span></div>
        </div>

        <div className="sidebar-context">
          <span className="sidebar-context-mark"><Radio size={15} /></span>
          <div className="sidebar-context-copy"><strong>RESPONSE NETWORK</strong><small>Biñan City · Laguna</small></div>
        </div>

        <nav className="sidebar-navigation" aria-label="Command center">
          {navigationGroups.map((group) => {
            const items = group.items.filter(({ to }) => to !== '/users' || user?.isSuperAdmin);
            return items.length ? <section className="sidebar-nav-group" key={group.label}>
              <div className="sidebar-caption">{group.label}</div>
              <div className="primary-nav">
                {items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    title={to === '/users' && newUserCount > 0 ? `${newUserCount} new accounts in the last 7 days` : label}
                    data-label={label}
                    aria-label={to === '/users' && newUserCount > 0 ? `${label}, ${newUserCount} new accounts in the last 7 days` : label}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                  >
                    <Icon size={18} strokeWidth={1.9} />
                    <span className="nav-link-label">{label}</span>
                    {to === '/users' && newUserCount > 0 && <span className="nav-badge" aria-hidden="true">{newUserCount > 99 ? '99+' : newUserCount}</span>}
                  </NavLink>
                ))}
              </div>
            </section> : null;
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-caption">PREFERENCES</div>
          <NavLink to="/system" title="System status" data-label="System status" aria-label="System status" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`} onClick={() => setMenuOpen(false)}><Radio size={18} /><span className="nav-link-label">System status</span></NavLink>
          <NavLink to="/settings" title="Settings" data-label="Settings" aria-label="Settings" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`} onClick={() => setMenuOpen(false)}><Settings size={18} /><span className="nav-link-label">Settings</span></NavLink>
          <div className="sidebar-presence"><span className="presence-indicator" /><div><strong>Secure console</strong><small>Administrator session</small></div></div>
        </div>
      </aside>

      <main className="main-frame">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button menu-toggle"
              onClick={toggleNavigation}
              aria-label={isMobileViewport ? (menuOpen ? 'Close navigation' : 'Open navigation') : (sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation')}
              aria-controls="command-center-sidebar"
              aria-expanded={isMobileViewport ? menuOpen : !sidebarCollapsed}
              title={isMobileViewport ? 'Toggle navigation' : (sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation')}
              data-nav-toggle
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb"><span>HANDA</span><span className="breadcrumb-slash">/</span><strong>{pageTitle}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="connection-status"><span className="presence-indicator" /><span>Connected</span></div>
            <div className="topbar-divider" />
            <div className="account-wrap">
              <button className="account-button" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen}>
                <span className="avatar avatar-small">{initials}</span>
                <span className="account-copy"><strong>{user?.name || 'Administrator'}</strong><small>{user?.isSuperAdmin ? 'Superadmin' : 'Administrator'}</small></span>
                <ChevronDown size={15} className={accountOpen ? 'chevron-open' : ''} />
              </button>
              {accountOpen && <div className="account-menu"><button onClick={() => { setAccountOpen(false); navigate('/settings'); }}><Settings size={16} /> Account settings</button><button onClick={() => void leave()}><LogOut size={16} /> Sign out</button></div>}
            </div>
          </div>
        </header>
        <div className="page-viewport" key={location.pathname}>
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}