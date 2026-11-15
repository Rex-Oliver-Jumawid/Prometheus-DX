import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistryGate } from './RegistryGate';

const mocks = vi.hoisted(() => ({ role: 'ADMINISTRATOR', api: vi.fn() }));
vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    member: { id: 'actor', workspaceRole: mocks.role },
    session: { access_token: 'test' },
  }),
}));
vi.mock('../../lib/api', () => ({ apiFetch: mocks.api }));
vi.mock('../registry/RegistryPage', () => ({
  RegistryPage: () => <div>Workspace directory</div>,
}));
vi.mock('../ventures/VenturesPage', () => ({
  VenturesPage: ({ managementOnly }: { managementOnly: boolean }) => (
    <div>
      {managementOnly
        ? 'Scoped venture configuration'
        : 'All venture configuration'}
    </div>
  ),
}));

function mount(path = '/registry') {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <RegistryGate />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  mocks.role = 'ADMINISTRATOR';
  mocks.api.mockReset();
  mocks.api.mockResolvedValue([]);
});
describe('unified Registry', () => {
  it('keeps venture configuration and workspace members behind one Registry entry', async () => {
    mount();
    expect(screen.getAllByRole('heading', { name: 'Registry' })).toHaveLength(
      1,
    );
    expect(screen.getByText('All venture configuration')).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Workspace members' }));
    expect(await screen.findByText('Workspace directory')).toBeVisible();
    expect(
      screen.queryByText('All venture configuration'),
    ).not.toBeInTheDocument();
  });
  it('lets scoped venture managers open Registry without loading workspace member administration', async () => {
    mocks.role = 'MEMBER';
    mocks.api.mockResolvedValue([{ canManage: true, canManageMembers: false }]);
    mount('/registry?tab=members');
    expect(
      await screen.findByText('Scoped venture configuration'),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Workspace members' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Workspace directory')).not.toBeInTheDocument();
    expect(mocks.api.mock.calls.every((call) => call[0] === '/ventures')).toBe(
      true,
    );
  });
  it('does not treat ordinary membership as configuration permission', async () => {
    mocks.role = 'MEMBER';
    mocks.api.mockResolvedValue([
      { canManage: false, canManageMembers: false },
    ]);
    mount();
    expect(
      await screen.findByRole('heading', { name: 'Registry access required' }),
    ).toBeVisible();
    expect(screen.queryByText('Workspace directory')).not.toBeInTheDocument();
  });
  it('does not turn a failed permission lookup into an administrative view', async () => {
    mocks.role = 'MEMBER';
    mocks.api.mockRejectedValue(new Error('Offline'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Registry access could not be checked',
    );
    expect(screen.queryByText('Workspace directory')).not.toBeInTheDocument();
  });
});
