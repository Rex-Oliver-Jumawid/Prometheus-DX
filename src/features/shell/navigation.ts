import type { WorkspaceRole } from '../../../shared/contracts/member';

export interface NavigationItem {
  label: string;
  path: string;
  icon:
    | 'home'
    | 'projects'
    | 'visiwork'
    | 'schedule'
    | 'team'
    | 'reports'
    | 'notifications'
    | 'registry';
}

const navigation: NavigationItem[] = [
  { label: 'Home', path: '/', icon: 'home' },
  { label: 'Projects', path: '/projects', icon: 'projects' },
  { label: 'VisiWork', path: '/visiwork', icon: 'visiwork' },
  { label: 'Schedule', path: '/schedule', icon: 'schedule' },
  { label: 'Team', path: '/team', icon: 'team' },
  { label: 'Reports & Analytics', path: '/reports', icon: 'reports' },
];

export function navigationForRole(role: WorkspaceRole): NavigationItem[] {
  void role;
  return navigation;
}

export function utilityNavigationForRole(
  role: WorkspaceRole,
): NavigationItem[] {
  return [
    ...(role === 'ADMINISTRATOR'
      ? [{ label: 'Registry', path: '/registry', icon: 'registry' as const }]
      : []),
    {
      label: 'Notifications',
      path: '/notifications',
      icon: 'notifications',
    },
  ];
}

export function breadcrumbsForPath(pathname: string): string[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return [];
  return segments.map((segment) =>
    segment.replace(/-/g, ' ').replace(/^./, (value) => value.toUpperCase()),
  );
}
