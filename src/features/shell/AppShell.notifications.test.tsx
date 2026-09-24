import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '../../../shared/contracts/notification';
import { NotificationsPage } from '../notifications/NotificationsPage';
import { notificationKeys } from '../notifications/notification-queries';
import { AppShell } from './AppShell';
import { useShellStore } from './shell-store';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  role: 'MEMBER' as 'MEMBER' | 'ADMINISTRATOR',
}));

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    member: {
      id: '11111111-1111-4111-8111-111111111111',
      fullName: 'Rex Jumawid',
      department: { name: 'X Team' },
      workspaceRole: mocks.role,
    },
    session: { access_token: 'fake-token' },
    signOut: vi.fn(),
  }),
}));

vi.mock('../../lib/api', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('./ProfileDrawer', () => ({
  Avatar: () => null,
  ProfileDrawer: () => null,
}));
vi.mock('../work-sessions/WorkAttendanceControl', () => ({
  WorkAttendanceControl: () => null,
}));

const projectId = '22222222-2222-4222-8222-222222222222';
const outcomeId = '33333333-3333-4333-8333-333333333333';
const firstId = '44444444-4444-4444-8444-444444444444';
const secondId = '55555555-5555-4555-8555-555555555555';
const readAt = '2026-09-22T01:00:00.000Z';

const sampleNotifications: Notification[] = [
  {
    id: firstId,
    type: 'SUBMISSION_CREATED',
    actor: {
      id: '66666666-6666-4666-8666-666666666666',
      fullName: 'Bea Santos',
    },
    project: { id: projectId, name: 'Brand Refresh Q4' },
    outcome: { id: outcomeId, title: 'Campaign Direction' },
    newAccessLevel: null,
    createdAt: '2026-09-22T00:04:00.000Z',
    readAt: null,
  },
  {
    id: secondId,
    type: 'PROJECT_MEMBER_ACCESS_CHANGED',
    actor: {
      id: '66666666-6666-4666-8666-666666666666',
      fullName: 'Bea Santos',
    },
    project: { id: projectId, name: 'Brand Refresh Q4' },
    outcome: null,
    newAccessLevel: 'CAN_EDIT',
    createdAt: '2026-09-22T00:00:00.000Z',
    readAt: null,
  },
];

let records: Notification[];

function renderShell() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<h1>Home placeholder</h1>} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route
              path="/projects/:projectId/outcomes/:outcomeId"
              element={<h1>Outcome context</h1>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

describe('AppShell notification utility badge', () => {
  beforeEach(() => {
    mocks.role = 'MEMBER';
    records = sampleNotifications.map((item) => ({ ...item }));
    useShellStore.setState({ mobileNavigationOpen: false, profileOpen: false });
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockImplementation(
      (path: string, _schema: unknown, options?: { method?: string }) => {
        if (path === '/notifications/unread-count') {
          return Promise.resolve({
            count: records.filter((item) => !item.readAt).length,
          });
        }
        if (path === '/notifications?filter=all') {
          return Promise.resolve({ items: [...records] });
        }
        if (path === '/notifications?filter=unread') {
          return Promise.resolve({
            items: records.filter((item) => !item.readAt),
          });
        }
        if (
          path === `/notifications/${firstId}/read` &&
          options?.method === 'PUT'
        ) {
          records = records.map((item) =>
            item.id === firstId ? { ...item, readAt } : item,
          );
          return Promise.resolve({ id: firstId, readAt });
        }
        if (path === '/notifications/read-all' && options?.method === 'PUT') {
          const updatedCount = records.filter((item) => !item.readAt).length;
          records = records.map((item) => ({
            ...item,
            readAt: item.readAt ?? readAt,
          }));
          return Promise.resolve({ updatedCount, readAt });
        }
        return Promise.resolve({});
      },
    );
  });

  it('hides the badge at zero and preserves Member utility visibility', async () => {
    records = [];
    const { queryClient } = renderShell();

    await waitFor(() =>
      expect(queryClient.getQueryData(notificationKeys.unreadCount)).toEqual({
        count: 0,
      }),
    );
    expect(screen.getAllByRole('link', { name: 'Notifications' })).toHaveLength(
      1,
    );
    expect(
      screen.queryByText('0', { selector: '.sidebar-unread-badge' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Registry' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /notification bell/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the count in the utility link and closes mobile navigation', async () => {
    mocks.role = 'ADMINISTRATOR';
    const user = userEvent.setup();
    renderShell();

    const link = await screen.findByRole('link', {
      name: 'Notifications, 2 unread',
    });
    expect(within(link).getByText('2')).toHaveClass('sidebar-unread-badge');
    expect(screen.getByRole('link', { name: 'Registry' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(
      screen.getByRole('button', { name: 'Close navigation' }),
    ).toBeInTheDocument();
    await user.click(link);
    expect(useShellStore.getState().mobileNavigationOpen).toBe(false);
    expect(
      await screen.findByRole('heading', { name: 'Notifications' }),
    ).toBeInTheDocument();
  });

  it('updates the badge after reading one notification in the inbox', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(
      await screen.findByRole('link', { name: 'Notifications, 2 unread' }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: /Output ready for your review/,
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Outcome context' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'Notifications, 1 unread' }),
    ).toBeInTheDocument();
  });

  it('hides the badge after Mark all as read without duplicating navigation', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(
      await screen.findByRole('link', { name: 'Notifications, 2 unread' }),
    );
    await screen.findByRole('button', { name: /Output ready for your review/ });
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));

    expect(
      await screen.findByRole('link', { name: 'Notifications' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Notifications' })).toHaveLength(
      1,
    );
    expect(screen.getByText('0 unread')).toBeInTheDocument();
  });
});
