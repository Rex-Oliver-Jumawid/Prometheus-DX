import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../../lib/api';
import { ProjectChatPanel } from './ProjectChatPanel';

const projectId = '11111111-1111-4111-8111-111111111111';
const messageId = '55555555-5555-4555-8555-555555555555';
const olderId = '44444444-4444-4444-8444-444444444444';
const author = {
  id: '33333333-3333-4333-8333-333333333333',
  fullName: 'Project Member',
  email: 'member@example.com',
};
const existing = {
  id: messageId,
  projectId,
  author,
  parentMessageId: null,
  replyTo: null,
  body: 'Initial update',
  createdAt: '2026-09-23T01:00:00.000Z',
  editedAt: null,
  canEdit: true,
};

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));

function renderChat() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProjectChatPanel projectId={projectId} accessToken="token" />
    </QueryClientProvider>,
  );
}

describe('ProjectChatPanel interactions', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it('sends replies with their original Project message ID', async () => {
    vi.mocked(apiFetch).mockImplementation((path, _schema, options) => {
      if (options?.method === 'POST') return Promise.resolve({
        ...existing,
        id: olderId,
        parentMessageId: messageId,
      });
      if (path.endsWith('/messages'))
        return Promise.resolve({ items: [existing], nextCursor: null, canWrite: true });
      return Promise.reject(new Error('Unexpected API request'));
    });
    renderChat();
    fireEvent.click(await screen.findByRole('button', { name: 'Reply' }));
    expect(screen.getByText('Replying to Project Member')).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Please review' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      '/projects/' + projectId + '/messages',
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        body: { body: 'Please review', parentMessageId: messageId },
      }),
    ));
  });

  it('limits edits to messages the API permits the author to edit', async () => {
    vi.mocked(apiFetch).mockImplementation((path, _schema, options) => {
      if (options?.method === 'PATCH') return Promise.resolve({
        ...existing,
        body: 'Revised update',
        editedAt: '2026-09-23T02:00:00.000Z',
      });
      if (path.endsWith('/messages'))
        return Promise.resolve({ items: [existing], nextCursor: null, canWrite: true });
      return Promise.reject(new Error('Unexpected API request'));
    });
    renderChat();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit message' }), {
      target: { value: 'Revised update' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      '/projects/' + projectId + '/messages/' + messageId,
      expect.anything(),
      expect.objectContaining({ method: 'PATCH', body: { body: 'Revised update', expectedEditedAt: null } }),
    ));
  });

  it('loads earlier messages using the returned pagination cursor', async () => {
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (path.endsWith('?cursor=' + messageId))
        return Promise.resolve({
          items: [{ ...existing, id: olderId, body: 'Earlier update' }],
          nextCursor: null,
          canWrite: true,
        });
      return Promise.resolve({ items: [existing], nextCursor: messageId, canWrite: true });
    });
    renderChat();
    fireEvent.click(await screen.findByRole('button', { name: 'Load earlier messages' }));
    expect(await screen.findByText('Earlier update')).toBeVisible();
    expect(screen.getByText('Initial update')).toBeVisible();
    expect(apiFetch).toHaveBeenCalledWith(
      '/projects/' + projectId + '/messages?cursor=' + messageId,
      expect.anything(),
      expect.anything(),
    );
  });

  it('hides composer, replies and editing in a read-only Project', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      items: [existing],
      nextCursor: null,
      canWrite: false,
    });
    renderChat();
    expect(await screen.findByText('Initial update')).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});
