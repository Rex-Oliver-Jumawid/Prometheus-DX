import { createBrowserRouter } from 'react-router-dom';
import { AccessDeniedPage } from '../features/auth/AccessDeniedPage';
import { AccountSetupPage } from '../features/auth/AccountSetupPage';
import { AuthGate } from '../features/auth/AuthGate';
import { LoginPage } from '../features/auth/LoginPage';
import { FoundationPage } from '../features/foundation/FoundationPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { ProjectOverviewPage } from '../features/projects/ProjectOverviewPage';
import { NotFoundPage } from '../features/foundation/NotFoundPage';
import { AppShell } from '../features/shell/AppShell';
import { PlaceholderPage } from '../features/shell/PlaceholderPage';
import { RegistryGate } from '../features/shell/RegistryGate';

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
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <PlaceholderPage title="Home" /> },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/projects/:projectId', element: <ProjectOverviewPage /> },
          { path: '/visiwork', element: <PlaceholderPage title="VisiWork" /> },
          { path: '/schedule', element: <PlaceholderPage title="Schedule" /> },
          { path: '/team', element: <PlaceholderPage title="Team" /> },
          {
            path: '/notifications',
            element: <PlaceholderPage title="Notifications" />,
          },
          { path: '/registry', element: <RegistryGate /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
