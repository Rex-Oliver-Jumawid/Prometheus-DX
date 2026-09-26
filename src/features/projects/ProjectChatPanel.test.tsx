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

function renderChat(initialMessageId?: string, currentMemberId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProjectChatPanel
        projectId={projectId}
        projectName="Example Project"
        projectLead={projectLead}
        currentMemberId={currentMemberId}
        accessToken="token"
        initialMessageId={initialMessageId}
      />
    </QueryClientProvider>,
  );
}

describe('ProjectChatPanel interactions', () => {
  beforeEach(() => { vi.mocked(apiFetch).mockReset(); });

  it('renders the author profile picture and preserves initials fallback', async () => {
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (path.endsWith('/members'))
        return Promise.resolve({ projectId, members: [], canManageAccess: false });
      if (path.endsWith('/messages'))
        return Promise.resolve({
          items: [{ ...existing, author: { ...author, profileImagePath: '/profiles/project-member.png' } }],
          nextCursor: null,
          canWrite: true,
        });
      return Promise.reject(new Error('Unexpected API request'));
    });
    const { container } = renderChat();
    const avatar = await waitFor(() => {
      const node = container.querySelector('.pw-chat-avatar');
      expect(node?.querySelector('img')).toHaveAttribute('src', '/profiles/project-member.png');
      return node!;
    });
    fireEvent.error(avatar.querySelector('img')!);
    expect(avatar.querySelector('img')).toHaveAttribute('hidden');
    expect(avatar).toHaveTextContent('PM');
  });

  it('renders the conversation skeleton while the first message request is pending', () => {
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (path.endsWith('/members'))
        return Promise.resolve({ projectId, members: [], canManageAccess: false });
      if (path.endsWith('/messages')) return new Promise(() => {});
      return Promise.reject(new Error('Unexpected API request'));
    });
    const { container } = renderChat();
    expect(screen.getByRole('status', { name: 'Loading project messages' })).toBeVisible();
    expect(container.querySelectorAll('.pw-chat-skeleton-message')).toHaveLength(3);
    expect(container.querySelector('.pw-chat-skeleton-composer')).toBeInTheDocument();
  });

  it('offers a retry after the initial chat request fails and recovers without reloading', async () => {
    let reads = 0;
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (path.endsWith('/members'))
        return Promise.resolve({ projectId, members: [], canManageAccess: false });
      if (path.endsWith('/messages')) {
        reads += 1;
        return reads === 1
          ? Promise.reject(new Error('Simulated API failure'))
          : Promise.resolve({ items: [], nextCursor: null, canWrite: true });
      }
      return Promise.reject(new Error('Unexpected API request'));
    });
    renderChat();
    expect(await screen.findByText('Project chat could not be loaded.')).toBeVisible();
    expect(screen.getByText('Simulated API failure')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No messages yet. Start the conversation.')).toBeVisible();
    expect(reads).toBe(2);
  });

  it('sends on Enter but reserves Shift+Enter for composing multiline messages', async () => {
    vi.mocked(apiFetch).mockImplementation((path, _schema, options) => {
      if (options?.method === 'POST')
        return Promise.resolve({ ...existing, id: olderId, body: 'First line\nSecond line' });
      if (typeof path === 'string' && path.endsWith('/messages'))
        return Promise.resolve({ items: [existing], nextCursor: null, canWrite: true });
      if (typeof path === 'string' && path.endsWith('/members'))
        return Promise.resolve({ projectId, members: [], canManageAccess: false });
      return Promise.reject(new Error('Unexpected API request: ' + path));
    });
    renderChat();
    const input = await screen.findByRole('textbox', { name: 'Message' });
    fireEvent.change(input, { target: { value: 'First line' } });
    expect(fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })).toBe(true);
    expect(vi.mocked(apiFetch).mock.calls.filter(([, , opts]) => opts?.method === 'POST')).toHaveLength(0);
    fireEvent.change(input, { target: { value: 'First line\nSecond line' } });
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        '/projects/' + projectId + '/messages',
        expect.anything(),
        expect.objectContaining({
          method: 'POST',
          body: {
            body: 'First line\nSecond line',
            parentMessageId: null,
            mentionMemberIds: [],
          },
        }),
      ),
    );
    expect(vi.mocked(apiFetch).mock.calls.filter(([, , opts]) => opts?.method === 'POST')).toHaveLength(1);
  });

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
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(screen.getByRole('form', { name: 'Project chat composer' })).toBeVisible();
    expect(screen.queryByText('Project members and the Project Lead can send messages. You can read this conversation.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Message options' })).not.toBeInTheDocument();
  });

  it('shows a compact You and timestamp header on an own read-only message', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      items: [{ ...existing, canEdit: false, canDelete: false }],
      nextCursor: null,
      canWrite: false,
    });
    renderChat(undefined, author.id);
    const row = (await screen.findByText('Initial update')).closest('li');
    expect(row).toHaveClass('pw-chat-message--own');
    expect(row?.querySelector('.pw-chat-own-label')).toHaveTextContent(/You.*AM/);
    expect(row?.querySelector('.pw-chat-own-label time')).toHaveAttribute('datetime', existing.createdAt);
    expect(row?.querySelector('.pw-chat-message-meta strong')).toBeNull();
    expect(row?.querySelector(':scope > time.pw-chat-message-time')).toBeNull();
    expect(row?.querySelector('.pw-chat-actions')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
  });

  it('keeps sender message options without a redundant avatar, name, or Reply action', async () => {
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (path.endsWith('/members'))
        return Promise.resolve({ projectId, members: [], canManageAccess: false });
      if (path.endsWith('/messages'))
        return Promise.resolve({ items: [existing], nextCursor: null, canWrite: true });
      return Promise.reject(new Error('Unexpected API request: ' + path));
    });
    renderChat(undefined, author.id);
    const row = (await screen.findByText('Initial update')).closest('li');
    expect(row).toHaveClass('pw-chat-message--own');
    expect(row?.querySelector('.pw-chat-avatar')).toBeNull();
    expect(row?.querySelector('.pw-chat-message-meta strong')).toBeNull();
    expect(row?.querySelector('.pw-chat-own-label')).toHaveTextContent('You');
    expect(row?.querySelector('.pw-chat-message-time')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Message options' })).toBeVisible();
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
    const thread = await screen.findByRole('list', { name: 'Project messages' });
    Object.defineProperty(thread, 'clientHeight', { configurable: true, value: 200 });
    const defaultRect = HTMLElement.prototype.getBoundingClientRect;
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const bounds = defaultRect.call(this);
        if (this === thread) return { ...bounds, top: 100, height: 200 } as DOMRect;
        if (this.dataset.messageId === contextualId)
          return { ...bounds, top: 350, height: 40 } as DOMRect;
        return bounds;
      });
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
    await waitFor(() => expect(thread.scrollTop).toBe(170));
    expect(thread.querySelector('[data-message-id="' + contextualId + '"]'))
      .toHaveClass('pw-chat-message--targeted');
    rectSpy.mockRestore();
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
