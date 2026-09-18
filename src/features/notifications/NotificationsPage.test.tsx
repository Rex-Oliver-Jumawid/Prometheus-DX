import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  NotificationListResponse,
  NotificationView,
} from '../../../shared/contracts/notification';
import { NotificationBell } from './NotificationBell';
import { notificationKeys } from './notification-queries';
import { NotificationsPage } from './NotificationsPage';

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({ session: { access_token: 'fake-token' } }),
}));

vi.mock('../../lib/api', () => ({ apiFetch: mocks.apiFetch }));

const notification: NotificationView = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'SUBMISSION_CREATED' as const,
  project: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'A Project Name That Is Long Enough To Exercise Safe Wrapping',
  },
  outcome: {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Launch-ready Outcome',
  },
  actor: {
    id: '44444444-4444-4444-8444-444444444444',
    fullName: 'Bea Santos',
  },
  createdAt: '2026-09-18T04:00:00.000Z',
  readAt: null,
};

function Location() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}

function renderPage(initialEntries = ['/notifications']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="*" element={<Location />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
  });

  it('shows loading without flashing empty, then renders an intentional empty state', async () => {
    let resolveList: (value: NotificationListResponse) => void = () =>
      undefined;
    mocks.apiFetch.mockReturnValue(
      new Promise<NotificationListResponse>((resolve) => {
        resolveList = resolve;
      }),
    );

    renderPage();
    expect(screen.getByLabelText('Loading notifications')).toBeInTheDocument();
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument();

    resolveList({ notifications: [] });
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
  });

  it('optimistically marks a selected notification read and navigates to its Outcome', async () => {
    let resolveRead: (value: typeof notification) => void = () => undefined;
    mocks.apiFetch.mockImplementation(
      (path: string, _schema: unknown, options?: { method?: string }) => {
        if (path === '/notifications')
          return Promise.resolve({ notifications: [notification] });
        if (path.endsWith('/read') && options?.method === 'PUT')
          return new Promise((resolve) => {
            resolveRead = resolve;
          });
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    const { queryClient } = renderPage();
    queryClient.setQueryData(notificationKeys.unreadCount, { count: 1 });
    const user = userEvent.setup();

    const row = await screen.findByRole('button', {
      name: /Unread: Output ready for review/,
    });
    await user.click(row);

    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      '/projects/22222222-2222-4222-8222-222222222222/outcomes/33333333-3333-4333-8333-333333333333',
    );
    expect(queryClient.getQueryData(notificationKeys.unreadCount)).toEqual({
      count: 0,
    });
    resolveRead({ ...notification, readAt: '2026-09-18T05:00:00.000Z' });
  });

  it('marks all read and rolls the UI back when the mutation fails', async () => {
    mocks.apiFetch.mockImplementation(
      (path: string, _schema: unknown, options?: { method?: string }) => {
        if (path === '/notifications')
          return Promise.resolve({ notifications: [notification] });
        if (path === '/notifications/read-all' && options?.method === 'PUT')
          return Promise.reject(new Error('Read state could not be saved.'));
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    const { queryClient } = renderPage();
    queryClient.setQueryData(notificationKeys.unreadCount, { count: 1 });
    const user = userEvent.setup();

    await screen.findByRole('button', {
      name: /Unread: Output ready for review/,
    });
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Read state could not be saved.',
    );
    expect(
      screen.getByRole('button', { name: /Unread: Output ready for review/ }),
    ).toBeInTheDocument();
    expect(queryClient.getQueryData(notificationKeys.unreadCount)).toEqual({
      count: 1,
    });
  });

  it('marks every notification read and shows the caught-up state', async () => {
    let savedReadAt: string | null = null;
    mocks.apiFetch.mockImplementation(
      (path: string, _schema: unknown, options?: { method?: string }) => {
        if (path === '/notifications')
          return Promise.resolve({
            notifications: [{ ...notification, readAt: savedReadAt }],
          });
        if (path === '/notifications/read-all' && options?.method === 'PUT') {
          savedReadAt = '2026-09-18T05:00:00.000Z';
          return Promise.resolve({ count: 0 });
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    renderPage();
    const user = userEvent.setup();

    await screen.findByRole('button', {
      name: /Unread: Output ready for review/,
    });
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await user.click(screen.getByRole('tab', { name: /Unread/ }));

    expect(
      await screen.findByText('You are all caught up', { selector: 'strong' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('There are no unread notifications.'),
    ).toBeInTheDocument();
  });

  it('recovers from a failed inbox load through Retry', async () => {
    let attempts = 0;
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path !== '/notifications')
        throw new Error(`Unexpected request: ${path}`);
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error('Inbox unavailable.'))
        : Promise.resolve({ notifications: [] });
    });
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Inbox unavailable.',
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
  });
});

describe('NotificationBell', () => {
  beforeEach(() => mocks.apiFetch.mockReset());

  it('shows the real unread count and omits the badge when the count is zero', async () => {
    mocks.apiFetch.mockResolvedValueOnce({ count: 3 });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByLabelText('3 unread notifications'),
    ).toHaveTextContent('3');
    expect(
      screen.getByRole('link', {
        name: 'Open notifications, 3 unread notifications',
      }),
    ).toHaveAttribute('href', '/notifications');
    unmount();

    mocks.apiFetch.mockResolvedValueOnce({ count: 0 });
    const emptyClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={emptyClient}>
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open notifications' }),
    ).toBeInTheDocument();
  });
});
