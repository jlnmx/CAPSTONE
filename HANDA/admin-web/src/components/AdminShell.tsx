import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, BarChart3, Building2, ChevronDown, ClipboardList,
  Command, LayoutDashboard, LogOut, Map, Menu, Radio, Settings, ShieldCheck,
  Siren, Users, X,
} from 'lucide-react';
import { useAuth } from '../auth';

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/map', label: 'Live map', icon: Map },
  { to: '/operations', label: 'Operations', icon: Activity },
  { to: '/evacuees', label: 'Evacuees', icon: Users },
  { to: '/centers', label: 'Centers', icon: Building2 },
  { to: '/disasters', label: 'Disasters', icon: Siren },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/users', label: 'Users', icon: ShieldCheck },
  { to: '/logs', label: 'Logs', icon: ClipboardList },
];

const pageNames: Record<string, string> = {
  '/': 'Overview', '/map': 'Live map', '/operations': 'Operations', '/evacuees': 'Evacuees', '/centers': 'Centers',
  '/disasters': 'Disasters', '/analytics': 'Analytics', '/users': 'Users', '/logs': 'Logs',
  '/system': 'System', '/settings': 'Settings',
};

export default function AdminShell({ children }: { children?: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const pageTitle = pageNames[location.pathname] || 'Command Center';
  const initials = (user?.name || 'HA').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  const leave = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-frame">
      <div className={`sidebar-scrim ${menuOpen ? 'is-visible' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-emblem"><Command size={20} strokeWidth={2.2} /></div>
          <div className="brand-copy"><strong>HANDA</strong><span>COMMAND CENTER</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <div className="sidebar-caption">RESPONSE</div>
        <nav className="primary-nav" aria-label="Command center">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
              {to === '/disasters' && <span className="nav-live-dot" title="Live response" />}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-caption">PREFERENCES</div>
          <NavLink to="/system" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`} onClick={() => setMenuOpen(false)}><Radio size={18} /><span>System status</span></NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`} onClick={() => setMenuOpen(false)}><Settings size={18} /><span>Settings</span></NavLink>
          <div className="sidebar-presence"><span className="presence-indicator" /><div><strong>Secure console</strong><small>Administrator session</small></div></div>
        </div>
      </aside>

      <main className="main-frame">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div className="breadcrumb"><span>HANDA</span><span className="breadcrumb-slash">/</span><strong>{pageTitle}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="connection-status"><span className="presence-indicator" /><span>Connected</span></div>
            <div className="topbar-divider" />
            <div className="account-wrap">
              <button className="account-button" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen}>
                <span className="avatar avatar-small">{initials}</span>
                <span className="account-copy"><strong>{user?.name || 'Administrator'}</strong><small>Administrator</small></span>
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