import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { NavIcon } from './Icons';
import { breadcrumbsForPath, navigationForRole } from './navigation';
import { Avatar, ProfileDrawer } from './ProfileDrawer';
import { useShellStore } from './shell-store';

export function AppShell() {
  const { member } = useAuth();
  const location = useLocation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const collapsed = useShellStore((state) => state.sidebarCollapsed);
  const mobileOpen = useShellStore((state) => state.mobileNavigationOpen);
  const setMobileOpen = useShellStore((state) => state.setMobileNavigationOpen);
  const setProfileOpen = useShellStore((state) => state.setProfileOpen);
  const toggleSidebar = useShellStore((state) => state.toggleSidebar);
  if (!member) return null;
  const breadcrumbs = breadcrumbsForPath(location.pathname);

  return (
    <div className={`workspace-shell${collapsed ? ' sidebar-collapsed' : ''}${mobileOpen ? ' mobile-nav-open' : ''}`}>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className="app-sidebar">
        <div className="shell-brand"><img src="/auth/prometheus-mark.png" alt="" /><div><strong>Prometheus</strong><span>VIRTUAL OFFICE</span></div></div>
        <nav className="shell-nav" aria-label="Primary navigation">
          {navigationForRole(member.workspaceRole).map((item) => <NavLink key={item.path} to={item.path} end={item.path === '/'} title={collapsed ? item.label : undefined} onClick={() => setMobileOpen(false)} className={({ isActive }) => `shell-nav-item${isActive ? ' active' : ''}`}><span className="nav-icon"><NavIcon name={item.icon} /></span><span className="nav-label">{item.label}</span></NavLink>)}
        </nav>
        <div className="sidebar-bottom">
          <button type="button" className="collapse-button" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={collapsed ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'} /></svg><span>{collapsed ? 'Expand' : 'Collapse sidebar'}</span></button>
          <div className="sidebar-divider" />
          <button className="account-card" type="button" onClick={() => setProfileOpen(true)} aria-label="Open profile and account"><Avatar member={member} /><span className="account-copy"><strong title={member.fullName}>{member.fullName}</strong><small>{member.position || (member.workspaceRole === 'ADMINISTRATOR' ? 'Administrator' : 'Member')}</small></span><span className="account-more">•••</span></button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="top-navigation">
          <button className="mobile-menu" type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
          <nav className={`breadcrumbs${breadcrumbs.length ? '' : ' root'}`} aria-label="Breadcrumb">{breadcrumbs.map((crumb, index) => <span key={crumb}>{index > 0 && <i>/</i>}{crumb}</span>)}</nav>
          <div className="top-actions">
            <div className="notification-control"><button type="button" className="top-icon-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((value) => !value)}><NavIcon name="notifications" /></button>{notificationsOpen && <section className="notification-popover"><div><strong>Notifications</strong><span>Phase 1</span></div><p>You’re all caught up.</p><small>Notification delivery arrives in Phase 7.</small><NavLink to="/notifications" onClick={() => setNotificationsOpen(false)}>Open notifications</NavLink></section>}</div>
            <button type="button" className="top-profile" aria-label="Open profile and account" onClick={() => setProfileOpen(true)}><Avatar member={member} /></button>
          </div>
        </header>
        <main className="workspace-content"><Outlet /></main>
      </div>
      <ProfileDrawer member={member} />
    </div>
  );
}
