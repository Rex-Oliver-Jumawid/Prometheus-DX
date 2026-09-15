import type { NavigationItem } from './navigation';

export function NavIcon({ name }: { name: NavigationItem['icon'] }) {
  const content = {
    home: (
      <>
        <path d="M3 10.8 12 3l9 7.8" />
        <path d="M5.5 9.7V21h13V9.7M9.5 21v-6h5v6" />
      </>
    ),
    projects: (
      <>
        <path d="M3.5 6.5h6l1.7 2h9.3v10a2 2 0 0 1-2 2h-15z" />
        <path d="M3.5 6.5V5a2 2 0 0 1 2-2H9l1.6 2H18a2 2 0 0 1 2 2v1.5" />
      </>
    ),
    visiwork: (
      <>
        <path d="M2.5 12s3.4-5.5 9.5-5.5S21.5 12 21.5 12 18.1 17.5 12 17.5 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    schedule: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 9h18M8 13h3v3H8z" />
      </>
    ),
    team: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20v-1.5A5.5 5.5 0 0 1 9 13a5.5 5.5 0 0 1 5.5 5.5V20" />
        <circle cx="17.5" cy="9" r="2.3" />
        <path d="M15.5 14.2a4.4 4.4 0 0 1 5 4.3V20" />
      </>
    ),
    notifications: (
      <>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    registry: (
      <>
        <rect x="5" y="4" width="15" height="16" rx="2" />
        <circle cx="10" cy="10" r="2" />
        <path d="M7 16c.6-1.8 1.6-2.7 3-2.7s2.4.9 3 2.7M15 9h2M15 12h2M15 15h2" />
      </>
    ),
  }[name];
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {content}
    </svg>
  );
}
