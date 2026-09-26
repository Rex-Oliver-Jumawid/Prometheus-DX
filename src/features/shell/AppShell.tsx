import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { notificationUnreadCountQuery } from '../notifications/notification-queries';
import {
  projectCreateOptionsQuery,
  projectsListQuery,
} from '../projects/project-queries';
import { registryOverviewQuery } from '../registry/registry-queries';
import { teamScheduleQuery } from '../schedule/schedule-queries';
import { WorkAttendanceControl } from '../work-sessions/WorkAttendanceControl';
import { teamWorkSummaryQuery } from '../work-sessions/work-session-queries';
import {
  loadRegistryRoute,
  loadReportsAnalyticsRoute,
  loadScheduleRoute,
  loadTeamRoute,
} from '../../routes/route-modules';
import { NavIcon } from './Icons';
import {
  breadcrumbsForPath,
  navigationForRole,
  utilityNavigationForRole,
} from './navigation';
import { Avatar, ProfileDrawer } from './ProfileDrawer';
import { useShellStore } from './shell-store';
import { installZoomPan } from './zoom-pan';

export function AppShell() {
  const { member, session, signOut } = useAuth();
  const queryClient = useQueryClient();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const location = useLocation();
  const mobileOpen = useShellStore((state) => state.mobileNavigationOpen);
  const setMobileOpen = useShellStore((state) => state.setMobileNavigationOpen);
  const setProfileOpen = useShellStore((state) => state.setProfileOpen);
  const accessToken = session?.access_token;
  const workspaceRole = member?.workspaceRole;
  const unreadNotifications = useQuery({
    ...notificationUnreadCountQuery(accessToken),
    enabled: Boolean(accessToken && member),
  });
  const unreadCount = unreadNotifications.data?.count ?? 0;

  useEffect(() => installZoomPan(), []);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;

    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        accountMenuRef.current &&
        !accountMenuRef.current.contains(target)
      ) {
        setAccountMenuOpen(false);
      }
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromEscape);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromEscape);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accessToken || !workspaceRole) return;

    const warmup = window.setTimeout(() => {
      void queryClient.prefetchQuery(projectsListQuery(accessToken));
      void queryClient.prefetchQuery(projectCreateOptionsQuery(accessToken));

      void Promise.all([
        loadScheduleRoute(),
        queryClient.prefetchQuery(teamScheduleQuery(accessToken)),
      ]);
      void Promise.all([
        loadTeamRoute(),
        queryClient.prefetchQuery(teamWorkSummaryQuery(accessToken)),
      ]);

      if (workspaceRole === 'ADMINISTRATOR') {
        void Promise.all([
          loadRegistryRoute(),
          queryClient.prefetchQuery(registryOverviewQuery(accessToken)),
        ]);
      }
    }, 200);

    return () => window.clearTimeout(warmup);
  }, [accessToken, queryClient, workspaceRole]);

  if (!member) return null;

  const isProjectSection = location.pathname.startsWith('/projects/');
  const isReportsSection = location.pathname === '/reports';
  const breadcrumbs = isProjectSection
    ? []
    : breadcrumbsForPath(location.pathname);

  const prefetchNavigation = (path: string) => {
    if (path === '/projects') {
      void queryClient.prefetchQuery(projectsListQuery(accessToken));
    } else if (path === '/registry') {
      void Promise.all([
        loadRegistryRoute(),
        queryClient.prefetchQuery(registryOverviewQuery(accessToken)),
      ]);
    } else if (path === '/reports') {
      void Promise.all([
        loadReportsAnalyticsRoute(),
        queryClient.prefetchQuery(projectsListQuery(accessToken)),
        queryClient.prefetchQuery(teamWorkSummaryQuery(accessToken)),
      ]);
    } else if (path === '/schedule') {
      void Promise.all([
        loadScheduleRoute(),
        queryClient.prefetchQuery(teamScheduleQuery(accessToken)),
      ]);
    } else if (path === '/team') {
      void Promise.all([
        loadTeamRoute(),
        queryClient.prefetchQuery(teamWorkSummaryQuery(accessToken)),
      ]);
    }
  };

  return (
    <div className={`workspace-shell${mobileOpen ? ' mobile-nav-open' : ''}`}>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className="app-sidebar">
        <div className="shell-brand">
          <img src="/auth/prometheus-mark.png" alt="" />
          <div>
            <strong>Prometheus</strong>
            <span>VIRTUAL OFFICE</span>
          </div>
        </div>
        <nav className="shell-nav" aria-label="Primary navigation">
          {navigationForRole(member.workspaceRole).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => setMobileOpen(false)}
              onMouseEnter={() => prefetchNavigation(item.path)}
              onFocus={() => prefetchNavigation(item.path)}
              onPointerDown={() => prefetchNavigation(item.path)}
              className={({ isActive }) =>
                `shell-nav-item${isActive ? ' active' : ''}`
              }
            >
              <span className="nav-icon">
                <NavIcon name={item.icon} />
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <nav className="sidebar-utilities" aria-label="Workspace utilities">
            {utilityNavigationForRole(member.workspaceRole).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                aria-label={
                  item.icon === 'notifications' && unreadCount > 0
                    ? `Notifications, ${unreadCount} unread`
                    : item.label
                }
                onClick={() => setMobileOpen(false)}
                onMouseEnter={() => prefetchNavigation(item.path)}
                onFocus={() => prefetchNavigation(item.path)}
                className={({ isActive }) =>
                  `sidebar-utility${isActive ? ' active' : ''}${item.icon === 'notifications' ? ' notification-utility' : ''}`
                }
              >
                <span className="nav-icon">
                  <NavIcon name={item.icon} />
                </span>
                <span className="utility-label">{item.label}</span>
                {item.icon === 'notifications' && unreadCount > 0 && (
                  <span className="sidebar-unread-badge" aria-hidden="true">
                    {unreadCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-divider" />
          <div className="account-area" ref={accountMenuRef}>
            {accountMenuOpen && (
              <div className="account-menu" role="menu" aria-label="Account menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setProfileOpen(true);
                  }}
                >
                  <span className="account-menu-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="8" r="3" />
                      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
                      <path d="M18.5 5.5 20 4m0 0 1.5 1.5M20 4v3m-1.5-1.5h3" />
                    </svg>
                  </span>
                  <span>Profile settings</span>
                </button>
                <div className="account-menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  className="account-menu-signout"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setMobileOpen(false);
                    void signOut();
                  }}
                >
                  <span className="account-menu-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
                      <path d="M14 8l4 4-4 4M18 12H9" />
                    </svg>
                  </span>
                  <span>Sign out</span>
                </button>
              </div>
            )}
            <div className="account-card">
              <button
                className="account-profile-button"
                type="button"
                onClick={() => {
                  setAccountMenuOpen(false);
                  setProfileOpen(true);
                }}
                aria-label="Open profile settings"
              >
                <Avatar member={member} />
                <span className="account-copy">
                  <strong title={member.fullName}>{member.fullName}</strong>
                  <small title={member.department.name}>
                    {member.department.name}
                  </small>
                </span>
              </button>
              <button
                className="account-menu-trigger"
                type="button"
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen((current) => !current)}
              >
                <span aria-hidden="true">•••</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="top-navigation">
          <button
            className="mobile-menu"
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <nav
            className={`breadcrumbs${breadcrumbs.length ? '' : ' root'}`}
            aria-label="Breadcrumb"
          >
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb}>
                {index > 0 && <i>/</i>}
                {crumb}
              </span>
            ))}
          </nav>
        </header>
        <main className="workspace-content">
          <div className="workspace-content-scroll">
            <div
              className={`workspace-content-inner${isReportsSection ? ' reports-content-inner' : ''}`}
            >
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <ProfileDrawer member={member} />
      <WorkAttendanceControl />
    </div>
  );
}
