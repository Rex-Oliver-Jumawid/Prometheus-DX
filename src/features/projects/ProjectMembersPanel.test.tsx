import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../../lib/api';
import { ProjectMembersPanel } from './ProjectMembersPanel';

const projectId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const response = {
  projectId,
  canManageAccess: true,
  members: [
    {
      member: {
        id: memberId,
        fullName: 'Project Member',
        email: 'member@example.com',
      },
      accessLevel: 'CAN_VIEW' as const,
      outcomes: [],
    },
  ],
};

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ProjectMembersPanel projectId={projectId} accessToken="token" />
    </QueryClientProvider>,
  );
}

describe('ProjectMembersPanel access mutation', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockResolvedValue(response);
  });

  it('updates access immediately and rolls back a failed request', async () => {
    let rejectUpdate!: (error: Error) => void;
    const updateRequest = new Promise((_, reject) => {
      rejectUpdate = reject;
    });
    vi.mocked(apiFetch).mockImplementation((path: string) =>
      path.endsWith('/access') ? updateRequest : Promise.resolve(response),
    );
    renderPanel();

    const select = await screen.findByLabelText(
      'Project access for Project Member',
    );
    fireEvent.change(select, { target: { value: 'CAN_EDIT' } });

    await waitFor(() => expect(select).toHaveValue('CAN_EDIT'));
    rejectUpdate(new Error('Access could not be saved.'));

    await waitFor(() => expect(select).toHaveValue('CAN_VIEW'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Access could not be saved.',
    );
  });
});
