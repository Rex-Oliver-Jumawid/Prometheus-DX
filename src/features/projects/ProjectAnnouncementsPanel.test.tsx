import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../../lib/api';
import { ProjectAnnouncementsPanel } from './ProjectAnnouncementsPanel';

const projectId = '11111111-1111-4111-8111-111111111111';
const announcementId = '22222222-2222-4222-8222-222222222222';
const author = {
  id: '33333333-3333-4333-8333-333333333333',
  fullName: 'Project Lead',
  email: 'lead@example.com',
};

const announcement = {
  id: announcementId,
  projectId,
  author,
  title: 'Keep output notes specific',
  body: 'Include what changed and what the reviewer should verify.',
  pinnedAt: null,
  createdAt: '2026-09-24T11:00:00.000Z',
  updatedAt: '2026-09-24T11:00:00.000Z',
};

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProjectAnnouncementsPanel projectId={projectId} accessToken="token" />
    </QueryClientProvider>,
  );
}

describe('ProjectAnnouncementsPanel', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it('lets the Project Lead post an announcement', async () => {
    vi.mocked(apiFetch).mockImplementation((path, _schema, options) => {
      if (options?.method === 'POST')
        return Promise.resolve(announcement);
      if (path.endsWith('/announcements'))
        return Promise.resolve({ items: [], canManage: true });
      return Promise.reject(new Error('Unexpected API request'));
    });

    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Announce' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Announcement title' }), {
      target: { value: announcement.title },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Announcement details' }), {
      target: { value: announcement.body },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      '/projects/' + projectId + '/announcements',
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        body: {
          title: announcement.title,
          body: announcement.body,
        },
      }),
    ));
  });

  it('pins and unpins announcements from the rail', async () => {
    vi.mocked(apiFetch).mockImplementation((path, _schema, options) => {
      if (options?.method === 'PATCH')
        return Promise.resolve({
          ...announcement,
          pinnedAt: '2026-09-24T11:05:00.000Z',
        });
      if (path.endsWith('/announcements'))
        return Promise.resolve({ items: [announcement], canManage: true });
      return Promise.reject(new Error('Unexpected API request'));
    });

    renderPanel();
    expect(await screen.findByText(announcement.title)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Pin announcement' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      '/projects/' + projectId + '/announcements/' + announcementId + '/pin',
      expect.anything(),
      expect.objectContaining({
        method: 'PATCH',
        body: { pinned: true },
      }),
    ));
  });

  it('keeps announcement management hidden from non-leads', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      items: [{ ...announcement, pinnedAt: '2026-09-24T11:05:00.000Z' }],
      canManage: false,
    });

    renderPanel();
    expect(await screen.findByText(announcement.title)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Announce' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unpin announcement' })).not.toBeInTheDocument();
  });
});
