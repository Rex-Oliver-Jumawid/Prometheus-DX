import { createBrowserRouter } from 'react-router-dom';
import { AccessDeniedPage } from '../features/auth/AccessDeniedPage';
import { AccountSetupPage } from '../features/auth/AccountSetupPage';
import { AuthGate } from '../features/auth/AuthGate';
import { LoginPage } from '../features/auth/LoginPage';
import { FoundationPage } from '../features/foundation/FoundationPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { NotFoundPage } from '../features/foundation/NotFoundPage';
import { AppShell } from '../features/shell/AppShell';
import { PlaceholderPage } from '../features/shell/PlaceholderPage';
import {
  loadProjectOverviewRoute,
  loadNotificationsRoute,
  loadRegistryRoute,
  loadScheduleRoute,
  loadTeamRoute,
} from './route-modules';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/account-setup', element: <AccountSetupPage /> },
  { path: '/access-denied', element: <AccessDeniedPage /> },
  {
    path: '/foundation',
    element: <FoundationPage />,
  },
  {
    element: <AuthGate />,
    hydrateFallbackElement: (
      <main className="route-loading" role="status">
        Loading Prometheus...
      </main>
    ),
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <PlaceholderPage title="Home" /> },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/projects/:projectId', lazy: loadProjectOverviewRoute },
          {
            path: '/projects/:projectId/outcomes/:outcomeId',
            lazy: loadProjectOverviewRoute,
          },
          { path: '/visiwork', element: <PlaceholderPage title="VisiWork" /> },
          { path: '/schedule', lazy: loadScheduleRoute },
          { path: '/team', lazy: loadTeamRoute },
          { path: '/notifications', lazy: loadNotificationsRoute },
          { path: '/registry', lazy: loadRegistryRoute },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
