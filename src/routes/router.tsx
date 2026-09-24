import { createBrowserRouter } from 'react-router-dom';
import { AccessDeniedPage } from '../features/auth/AccessDeniedPage';
import { AccountSetupPage } from '../features/auth/AccountSetupPage';
import { AuthGate } from '../features/auth/AuthGate';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { LoginPage } from '../features/auth/LoginPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { FoundationPage } from '../features/foundation/FoundationPage';
import { HomePage } from '../features/home/HomePage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { NotFoundPage } from '../features/foundation/NotFoundPage';
import { AppShell } from '../features/shell/AppShell';
import { PlaceholderPage } from '../features/shell/PlaceholderPage';
import {
  loadProjectOverviewRoute,
  loadRegistryRoute,
  loadReportsAnalyticsRoute,
  loadScheduleRoute,
  loadTeamRoute,
  loadVisiWorkRoute,
} from './route-modules';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
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
          { path: '/', element: <HomePage /> },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/projects/:projectId', lazy: loadProjectOverviewRoute },
          {
            path: '/projects/:projectId/outcomes/:outcomeId',
            lazy: loadProjectOverviewRoute,
          },
          { path: '/visiwork', lazy: loadVisiWorkRoute },
          { path: '/schedule', lazy: loadScheduleRoute },
          { path: '/team', lazy: loadTeamRoute },
          { path: '/reports', lazy: loadReportsAnalyticsRoute },
          {
            path: '/notifications',
            element: <PlaceholderPage title="Notifications" />,
          },
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
