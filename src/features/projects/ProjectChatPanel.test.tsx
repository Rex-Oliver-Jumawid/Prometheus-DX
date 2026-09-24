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
const projectLead = {
  id: '22222222-2222-4222-8222-222222222222',
  fullName: 'Project Lead',
  email: 'lead@example.com',
};

const existing = {
  id: messageId,
  projectId,
  author,
  parentMessageId: null,
  replyTo: null,
  body: 'Initial update',
  mentions: [],
  deletedAt: null,
  createdAt: '2026-09-23T01:00:00.000Z',
  editedAt: null,
  canEdit: true,
  canDelete: true,
};

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));

function renderChat(initialMessageId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProjectChatPanel
        projectId={projectId}
        projectName="Example Project"
        projectLead={projectLead}
        accessToken="token"
        initialMessageId={initialMessageId}
      />
    </QueryClientProvider>,
  );
}

describe('ProjectChatPanel interactions', () => {
  beforeEach(() => { vi.mocked(apiFetch).mockReset(); });

  it('sends replies with their original Project message ID', async () => {
    vi.mocked(apiFetch).mockImplementation((path, _schema, options) => {
      if (options?.method === 'POST') return Promise.resolve({
        ...existing,
        id: olderId,
        parentMessageId: messageId,
      });
      if (typeof path === 'string' && path.endsWith('/messages'))
        return Promise.resolve({ items: [existing], nextCursor: null, canWrite: true });
      if (typeof path === 'string' && path.endsWith('/members'))
        return Promise.resolve({ projectId, members: [], canManageAccess: false });
      return Promise.reject(new Error('Unexpected API request: ' + path + '\n' + new Error().stack));
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
        body: { body: 'Please review', parentMessageId: messageId, mentionMemberIds: [] },
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
      if (typeof path === 'string' && path.endsWith('/messages'))
        return Promise.resolve({ items: [existing], nextCursor: null, canWrite: true });
      if (typeof path === 'string' && path.endsWith('/members'))
        return Promise.resolve({ projectId, members: [], canManageAccess: false });
      return Promise.reject(new Error('Unexpected API request: ' + path + '\n' + new Error().stack));
    });
    renderChat();
    fireEvent.click(await screen.findByRole('button', { name: 'Message options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit message' }), {
      target: { value: 'Revised update' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      '/projects/' + projectId + '/messages/' + messageId,
      expect.anything(),
      expect.objectContaining({ method: 'PATCH', body: { body: 'Revised update', expectedEditedAt: null, mentionMemberIds: [] } }),
    ));
  });

  it('refreshes a conflicting edit and lets the author reopen the latest revision', async () => {
    let reads = 0;
    vi.mocked(apiFetch).mockImplementation((path, _schema, options) => {
      if (options?.method === 'PATCH')
        return Promise.reject(new Error('This message was edited elsewhere.'));
      if (typeof path === 'string' && path.endsWith('/messages')) {
        const latest = reads++ > 0;
        return Promise.resolve({
          items: [{
            ...existing,
            body: latest ? 'Updated in another tab' : existing.body,
            editedAt: latest ? '2026-09-23T02:00:00.000Z' : null,
          }],
          nextCursor: null,
          canWrite: true,
        });
      }
      if (typeof path === 'string' && path.endsWith('/members'))
        return Promise.resolve({ projectId, members: [], canManageAccess: false });
      return Promise.reject(new Error('Unexpected API request: ' + path + '\n' + new Error().stack));
    });
    renderChat();
    fireEvent.click(await screen.findByRole('button', { name: 'Message options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit message' }), {
      target: { value: 'My stale change' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('edited elsewhere');
    await waitFor(() => expect(reads).toBeGreaterThan(1));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Updated in another tab')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Message options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
    expect(screen.getByRole('textbox', { name: 'Edit message' }))
      .toHaveValue('Updated in another tab');
  });

  it('loads earlier messages using the returned pagination cursor', async () => {
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (typeof path === 'string' && path.endsWith('?cursor=' + messageId))
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
    expect(screen.queryByRole('button', { name: 'Message options' })).not.toBeInTheDocument();
  });

  it('opens an older message directly from a Project Chat notification link', async () => {
    const contextualId = '66666666-6666-4666-8666-666666666666';
    const target = { ...existing, id: contextualId, body: 'Older mentioned message' };
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (typeof path === 'string' && path.endsWith('/messages/' + contextualId + '/context'))
        return Promise.resolve({ targetMessageId: contextualId, items: [target] });
      if (typeof path === 'string' && path.endsWith('/messages'))
        return Promise.resolve({ items: [existing], nextCursor: null, canWrite: true });
      if (typeof path === 'string' && path.endsWith('/members'))
        return Promise.resolve({ projectId, members: [], canManageAccess: false });
      return Promise.reject(new Error('Unexpected API request: ' + path));
    });

    renderChat(contextualId);
    expect(await screen.findByText('Older mentioned message')).toBeVisible();
    expect(screen.getByText('Older mentioned message').closest('li'))
      .toHaveClass('pw-chat-message--targeted');
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      '/projects/' + projectId + '/messages/' + contextualId + '/context',
      expect.anything(),
      expect.anything(),
    ));
  });

  it('searches project chat and loads context for the selected result', async () => {
    const contextualId = '66666666-6666-4666-8666-666666666666';
    const result = { ...existing, id: contextualId, body: 'Launch checklist' };
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (typeof path === 'string' && path.includes('/messages/search?q=Launch'))
        return Promise.resolve({ items: [result] });
      if (typeof path === 'string' && path.endsWith('/messages/' + contextualId + '/context'))
        return Promise.resolve({ targetMessageId: contextualId, items: [result] });
      if (typeof path === 'string' && path.endsWith('/messages'))
        return Promise.resolve({ items: [existing], nextCursor: null, canWrite: true });
      if (typeof path === 'string' && path.endsWith('/members'))
        return Promise.resolve({ projectId, members: [], canManageAccess: false });
      return Promise.reject(new Error('Unexpected API request: ' + path + '\n' + new Error().stack));
    });

    renderChat();
    fireEvent.click(await screen.findByRole('button', { name: 'Search project conversation' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search project messages' }), {
      target: { value: 'Launch' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Project Member/ }));
    expect(await screen.findByText('Launch checklist')).toBeVisible();
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      '/projects/' + projectId + '/messages/' + contextualId + '/context',
      expect.anything(),
      expect.anything(),
    ));
  });

  it('mentions a project member from the composer', async () => {
    vi.mocked(apiFetch).mockImplementation((path, _schema, options) => {
      if (options?.method === 'POST') return Promise.resolve(existing);
      if (typeof path === 'string' && path.endsWith('/messages'))
        return Promise.resolve({ items: [existing], nextCursor: null, canWrite: true });
      if (typeof path === 'string' && path.endsWith('/members'))
        return Promise.resolve({
          projectId,
          canManageAccess: false,
          members: [{
            member: author,
            accessLevel: 'CAN_EDIT',
            outcomes: [],
          }],
        });
      return Promise.reject(new Error('Unexpected API request: ' + path + '\n' + new Error().stack));
    });

    renderChat();
    const input = await screen.findByRole('textbox', { name: 'Message' });
    fireEvent.change(input, { target: { value: '@Project L' } });
    fireEvent.click(await screen.findByRole('option', { name: /Project Lead/ }));
    expect(input).toHaveValue('@Project Lead ');
    fireEvent.change(input, { target: { value: '@Project Lead please review' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      '/projects/' + projectId + '/messages',
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        body: {
          body: '@Project Lead please review',
          parentMessageId: null,
          mentionMemberIds: [projectLead.id],
        },
      }),
    ));
  });

  it('shows delete in the message menu and confirms tombstone deletion', async () => {
    vi.mocked(apiFetch).mockImplementation((path, _schema, options) => {
      if (options?.method === 'DELETE')
        return Promise.resolve({ ...existing, body: '[Message deleted]', deletedAt: '2026-09-23T03:00:00.000Z', canEdit: false, canDelete: false });
      if (typeof path === 'string' && path.endsWith('/messages'))
        return Promise.resolve({ items: [existing], nextCursor: null, canWrite: true });
      if (typeof path === 'string' && path.endsWith('/members'))
        return Promise.resolve({ projectId, members: [], canManageAccess: false });
      return Promise.reject(new Error('Unexpected API request: ' + path + '\n' + new Error().stack));
    });

    renderChat();
    fireEvent.click(await screen.findByRole('button', { name: 'Message options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete message' }));
    expect(screen.getByRole('dialog', { name: 'Delete message?' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      '/projects/' + projectId + '/messages/' + messageId,
      expect.anything(),
      expect.objectContaining({
        method: 'DELETE',
        body: { expectedEditedAt: null },
      }),
    ));
  });
});
