import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '../../../shared/contracts/notification';
import { NotificationsPage } from './NotificationsPage';
import { notificationKeys } from './notification-queries';

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({ session: { access_token: 'fake-token' } }),
}));

vi.mock('../../lib/api', () => ({ apiFetch: mocks.apiFetch }));

const projectId = '11111111-1111-4111-8111-111111111111';
const outcomeId = '22222222-2222-4222-8222-222222222222';
const unreadId = '33333333-3333-4333-8333-333333333333';
const readId = '44444444-4444-4444-8444-444444444444';
const readAt = '2026-09-22T00:05:00.000Z';

const sampleNotifications: Notification[] = [
  {
    id: unreadId,
    type: 'SUBMISSION_CREATED',
    actor: {
      id: '55555555-5555-4555-8555-555555555555',
      fullName: 'Bea Santos',
    },
    project: { id: projectId, name: 'Brand Refresh Q4' },
    outcome: { id: outcomeId, title: 'Campaign Direction' },
    newAccessLevel: null,
    createdAt: '2026-09-22T00:04:00.000Z',
    readAt: null,
  },
  {
    id: readId,
    type: 'PROJECT_LEAD_ASSIGNED',
    actor: {
      id: '66666666-6666-4666-8666-666666666666',
      fullName: 'Rex Jumawid',
    },
    project: { id: projectId, name: 'Brand Refresh Q4' },
    outcome: null,
    newAccessLevel: null,
    createdAt: '2026-09-22T00:00:00.000Z',
    readAt,
  },
];

let records: Notification[];
let listRequest: Promise<{ items: Notification[] }> | null;
let listFailures: number;
let readFails: boolean;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/notifications']}>
        <Routes>
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route
            path="/projects/:projectId/outcomes/:outcomeId"
            element={<h1>Outcome context</h1>}
          />
          <Route
            path="/projects/:projectId"
            element={<h1>Project context</h1>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    records = sampleNotifications.map((item) => ({ ...item }));
    listRequest = null;
    listFailures = 0;
    readFails = false;
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockImplementation(
      (path: string, _schema: unknown, options?: { method?: string }) => {
        if (path === '/notifications?filter=all') {
          if (listFailures > 0) {
            listFailures -= 1;
            return Promise.reject(new Error('Inbox unavailable.'));
          }
          return listRequest ?? Promise.resolve({ items: [...records] });
        }
        if (path === '/notifications?filter=unread') {
          return Promise.resolve({
            items: records.filter((item) => !item.readAt),
          });
        }
        if (path === '/notifications?filter=mentions') {
          return Promise.resolve({
            items: records.filter((item) => item.type === 'VISIWORK_MENTION'),
          });
        }
        if (path === '/notifications?filter=projects') {
          return Promise.resolve({
            items: records.filter((item) => item.type !== 'VISIWORK_MENTION'),
          });
        }
        if (path === '/notifications/unread-count') {
          return Promise.resolve({
            count: records.filter((item) => !item.readAt).length,
          });
        }
        if (
          path === `/notifications/${unreadId}/read` &&
          options?.method === 'PUT'
        ) {
          if (readFails)
            return Promise.reject(new Error('Could not mark read.'));
          records = records.map((item) =>
            item.id === unreadId ? { ...item, readAt } : item,
          );
          return Promise.resolve({ id: unreadId, readAt });
        }
        if (path === '/notifications/read-all' && options?.method === 'PUT') {
          const updatedCount = records.filter((item) => !item.readAt).length;
          records = records.map((item) => ({
            ...item,
            readAt: item.readAt ?? readAt,
          }));
          return Promise.resolve({ updatedCount, readAt });
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );
  });

  it('shows loading without flashing an empty inbox', async () => {
    let resolveList: (value: { items: Notification[] }) => void = () => {};
    listRequest = new Promise((resolve) => {
      resolveList = resolve;
    });
    const { container } = renderPage();

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading notifications',
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.notification-skeleton-row')).toHaveLength(
      4,
    );
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument();

    resolveList({ items: [...records] });
    expect(
      await screen.findByText('Output ready for your review'),
    ).toBeInTheDocument();
    expect(container.querySelector('.notification-skeleton-row')).toBeNull();
  });

  it('shows distinct empty inbox and filtered-empty states', async () => {
    records = [];
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mark all as read' }),
    ).toBeDisabled();

    await user.click(screen.getByRole('tab', { name: /Unread/ }));
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'View all notifications' }),
    );
    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
  });

  it('keeps older unread history reachable after an empty cached first page', async () => {
    const olderUnread = { ...sampleNotifications[1], readAt: null };
    records = [sampleNotifications[0], olderUnread];
    const original = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path: string, ...args: unknown[]) => {
      if (path === '/notifications?filter=unread')
        return Promise.resolve({ items: [], nextCursor: unreadId });
      if (path === `/notifications?filter=unread&cursor=${unreadId}`)
        return Promise.resolve({ items: [olderUnread], nextCursor: null });
      return original(path, ...args);
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: /Output ready for your review/ });
    await user.click(screen.getByRole('tab', { name: /Unread/ }));

    const loadOlder = await screen.findByRole('button', { name: 'Load older notifications' });
    expect(loadOlder).toBeVisible();
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
    await user.click(loadOlder);
    expect(await screen.findByRole('button', { name: /You were assigned as Project Lead/ })).toBeVisible();
  });

  it('filters populated All and Unread lists with distinct unread styling', async () => {
    const user = userEvent.setup();
    renderPage();

    const unreadRow = await screen.findByRole('button', {
      name: /Output ready for your review/,
    });
    expect(unreadRow).toHaveAttribute('data-state', 'unread');
    expect(
      screen.getByRole('button', { name: /You were assigned as Project Lead/ }),
    ).toHaveAttribute('data-state', 'read');
    expect(screen.getByText('1 unread')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Unread/ }));
    expect(
      await screen.findByRole('button', {
        name: /Output ready for your review/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /You were assigned as Project Lead/,
      }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /All/ }));
    expect(
      screen.getByRole('button', { name: /You were assigned as Project Lead/ }),
    ).toBeInTheDocument();
  });

  it('separates Mentions and Projects using the Notifications design tabs', async () => {
    records = [
      ...records,
      {
        id: '77777777-7777-4777-8777-777777777777',
        type: 'VISIWORK_MENTION',
        actor: {
          id: '88888888-8888-4888-8888-888888888888',
          fullName: 'Rex Jumawid',
        },
        project: null,
        outcome: null,
        newAccessLevel: null,
        visiworkMention: {
          messageId: '99999999-9999-4999-8999-999999999999',
          departmentId: null,
          roomLabel: 'General Chat',
          preview: 'Can @Oliver review this?',
        },
        createdAt: '2026-09-22T00:06:00.000Z',
        readAt: null,
      },
    ];
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('button', { name: /You were mentioned in VisiWork/ });

    await user.click(screen.getByRole('tab', { name: /Mentions/ }));
    expect(
      await screen.findByRole('button', { name: /You were mentioned in VisiWork/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Output ready for your review/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Projects/ }));
    expect(
      await screen.findByRole('button', { name: /Output ready for your review/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /You were mentioned in VisiWork/ }),
    ).not.toBeInTheDocument();
  });

  it('marks a notification read and opens its canonical Outcome route', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: /Output ready for your review/,
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Outcome context' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        `/notifications/${unreadId}/read`,
        expect.anything(),
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(records[0].readAt).toBe(readAt);
      expect(
        queryClient
          .getQueryData<{ pages: Array<{ items: Notification[] }> }>(notificationKeys.list('all'))
          ?.pages.flatMap((page) => page.items).find((item) => item.id === unreadId)?.readAt,
      ).toBeTruthy();
    });
  });

  it('loads older notification pages only when requested', async () => {
    const firstPage = { items: [sampleNotifications[0]], nextCursor: unreadId };
    const secondPage = { items: [sampleNotifications[1]], nextCursor: null };
    const old = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path: string, ...args: unknown[]) => {
      if (path === '/notifications?filter=all') return Promise.resolve(firstPage);
      if (path === `/notifications?filter=all&cursor=${unreadId}`)
        return Promise.resolve(secondPage);
      return old(path, ...args);
    });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('button', { name: /Output ready for your review/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /You were assigned as Project Lead/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load older notifications' }));
    expect(await screen.findByRole('button', { name: /You were assigned as Project Lead/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Load older notifications' })).not.toBeInTheDocument();
  });

  it('opens a Project-level notification on the existing Project route', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: /You were assigned as Project Lead/,
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Project context' }),
    ).toBeInTheDocument();
    expect(mocks.apiFetch).not.toHaveBeenCalledWith(
      `/notifications/${readId}/read`,
      expect.anything(),
      expect.anything(),
    );
  });

  it('marks all unread notifications and keeps the full list visible', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('button', { name: /Output ready for your review/ });
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));

    await waitFor(() => {
      expect(screen.getByText('0 unread')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Output ready for your review/ }),
      ).toHaveAttribute('data-state', 'read');
    });
    expect(
      screen.getByRole('button', { name: /You were assigned as Project Lead/ }),
    ).toBeInTheDocument();
  });

  it('keeps a missing linked context visible and allows marking it read', async () => {
    records = [{ ...sampleNotifications[0], project: null, outcome: null }];
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByText('Linked context unavailable'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark as read' }));
    await waitFor(() => {
      expect(screen.getByText('0 unread')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Mark as read' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText('Linked context unavailable')).toBeInTheDocument();
  });

  it('rolls back a failed read and keeps the linked row in the inbox', async () => {
    readFails = true;
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: /Output ready for your review/,
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not mark read.',
    );
    expect(
      screen.getByRole('heading', { name: 'Notifications' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 unread')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Output ready for your review/ }),
    ).toHaveAttribute('data-state', 'unread');
  });

  it('retries after the inbox fails to load', async () => {
    listFailures = 1;
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Inbox unavailable.',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText('Output ready for your review'),
    ).toBeInTheDocument();
  });
});
