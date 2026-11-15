import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenturesPage } from './VenturesPage';

const mocks = vi.hoisted(() => ({ api: vi.fn(), auth: vi.fn() }));
vi.mock('../../lib/api', () => ({ apiFetch: mocks.api }));
vi.mock('../auth/auth-context', () => ({ useAuth: mocks.auth }));
const venture = { id: '11111111-1111-4111-8111-111111111111', name: 'Parkey', shortLabel: 'PK', status: 'ACTIVE', parentId: null, description: null, canManage: true, canManageMembers: true, canGrantPermissions: true };
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><VenturesPage /></QueryClientProvider>); }
beforeEach(() => {
  mocks.api.mockReset();
  mocks.auth.mockReturnValue({ member: { id: 'actor', workspaceRole: 'ADMINISTRATOR' }, session: { access_token: 'test-token' } });
});
describe('VenturesPage', () => {
  it('shows an empty state and limits create to administrators', async () => {
    mocks.auth.mockReturnValue({ member: { id: 'actor', workspaceRole: 'MEMBER' }, session: { access_token: 'test-token' } });
    mocks.api.mockResolvedValue([]);
    mount();
    expect(await screen.findByText(/No ventures yet/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Create venture' })).not.toBeInTheDocument();
  });
  it('creates a venture with bounded form fields and optional parent', async () => {
    mocks.api.mockImplementation((path: string, _schema: unknown, options: { method?: string }) => Promise.resolve(options?.method ? { id: venture.id } : []));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Create venture' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Parkey' } });
    fireEvent.change(screen.getByLabelText('Short label'), { target: { value: 'PK' } });
    fireEvent.submit(screen.getByLabelText('Name').closest('form')!);
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/ventures', expect.anything(), expect.objectContaining({ method: 'POST', body: { name: 'Parkey', shortLabel: 'PK', description: null, parentId: null, status: 'ACTIVE' } })));
  });
  it('shows multiple roles and explicit history without implying issued shares', async () => {
    mocks.api.mockImplementation((path: string) => Promise.resolve(path === '/ventures' ? [venture] : { venture, candidates: [], history: [], members: [{ id: 'm', memberId: '22222222-2222-4222-8222-222222222222', fullName: 'Paul', roles: ['CEO', 'CTO'], founder: true, active: true, permissions: [], joinedAt: '2026-11-15T00:00:00Z', endedAt: null, memberStatus: 'ACTIVE' }] }));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Parkey' }));
    expect(await screen.findByText('CEO, CTO')).toBeVisible();
    expect(screen.getByText(/does not issue shares/)).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: /^Member$/ }), { target: { value: '22222222-2222-4222-8222-222222222222' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save membership' }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith(`/ventures/${venture.id}/members`, expect.anything(), expect.objectContaining({ method: 'POST', body: expect.objectContaining({ memberId: '22222222-2222-4222-8222-222222222222', roles: ['CEO', 'CTO'] }) })));
  });
  it('shows a readable request failure and retry', async () => {
    mocks.api.mockRejectedValue(new Error('offline'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Ventures could not be loaded');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
