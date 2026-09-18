import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemberSchedule } from '../../../shared/contracts/schedule';
import { SchedulePage } from './SchedulePage';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    member: {
      id: '11111111-1111-4111-8111-111111111111',
      fullName: 'Member One',
      email: 'one@example.com',
      workspaceRole: 'MEMBER',
    },
    session: { access_token: 'fake-token' },
  }),
}));

vi.mock('../../lib/api', () => ({
  apiFetch: mocks.apiFetch,
}));

const savedSchedule: MemberSchedule = {
  id: '33333333-3333-4333-8333-333333333333',
  memberId: '11111111-1111-4111-8111-111111111111',
  targetWeeklyMinutes: 480,
  blocks: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      weekday: 'MONDAY',
      startTime: '09:00',
      endTime: '17:00',
    },
  ],
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
};

function teamResponse(schedule: MemberSchedule | null) {
  return {
    timezone: 'Asia/Manila' as const,
    members: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        fullName: 'Member One',
        position: 'Designer',
        department: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Creatives',
          shortLabel: 'Creative',
        },
        schedule,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        fullName: 'Member Two',
        position: 'Developer',
        department: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          name: 'Research and Development',
          shortLabel: 'R&D',
        },
        schedule: {
          ...savedSchedule,
          memberId: '22222222-2222-4222-8222-222222222222',
        },
      },
    ],
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SchedulePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SchedulePage', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockImplementation(
      (
        path: string,
        _schema: unknown,
        options?: { method?: string; body?: unknown },
      ) => {
        if (path === '/schedule/team')
          return Promise.resolve(teamResponse(null));
        if (path === '/schedule/me' && options?.method === 'PUT') {
          return Promise.resolve({
            ...savedSchedule,
            ...(options.body as object),
            blocks: (
              (options.body as { blocks: MemberSchedule['blocks'] }).blocks ??
              []
            ).map((block, index) => ({
              ...block,
              id: `44444444-4444-4444-8444-${String(index + 1).padStart(12, '0')}`,
            })),
          });
        }
        if (path === '/schedule/me') return Promise.resolve(null);
        throw new Error(`Unexpected request: ${path}`);
      },
    );
  });

  it('shows an intentional empty state and permitted teammate availability', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Your schedule is ready to configure',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Member Two')).toBeInTheDocument();
    expect(screen.getByText('9:00 AM - 5:00 PM')).toBeInTheDocument();
  });

  it('moves from Shifts into Team Schedule configuration and saves a block', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: 'Schedule' });
    await user.click(screen.getByRole('tab', { name: 'Shifts' }));
    expect(screen.getByRole('tab', { name: 'Shifts' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(
      screen.getByRole('button', { name: 'Configure My Schedule' }),
    );
    expect(screen.getByRole('tab', { name: 'Team Schedule' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('heading', { name: 'Configure My Schedule' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Block' }));
    fireEvent.change(screen.getByLabelText('Start'), {
      target: { value: '08:00' },
    });
    fireEvent.change(screen.getByLabelText('End'), {
      target: { value: '12:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        '/schedule/me',
        expect.anything(),
        expect.objectContaining({
          method: 'PUT',
          body: expect.objectContaining({
            blocks: [
              { weekday: 'MONDAY', startTime: '08:00', endTime: '12:00' },
            ],
          }),
        }),
      ),
    );
  });

  it('clears a failed save message when configuration is reopened', async () => {
    const user = userEvent.setup();
    mocks.apiFetch.mockImplementation(
      (path: string, _schema: unknown, options?: { method?: string }) => {
        if (path === '/schedule/team')
          return Promise.resolve(teamResponse(null));
        if (path === '/schedule/me' && options?.method === 'PUT')
          return Promise.reject(new Error('Schedule save failed.'));
        if (path === '/schedule/me') return Promise.resolve(null);
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    renderPage();

    await screen.findByRole('heading', {
      name: 'Your schedule is ready to configure',
    });
    await user.click(
      screen.getAllByRole('button', { name: 'Configure My Schedule' })[0],
    );
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));
    expect(
      await screen.findByText('Schedule save failed.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(
      screen.getAllByRole('button', { name: 'Configure My Schedule' })[0],
    );

    expect(screen.queryByText('Schedule save failed.')).not.toBeInTheDocument();
  });

  it('shows overlap validation without sending an invalid update', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', {
      name: 'Your schedule is ready to configure',
    });
    await user.click(
      screen.getAllByRole('button', { name: 'Configure My Schedule' })[0],
    );
    await user.click(screen.getByRole('button', { name: 'Add Block' }));
    await user.click(screen.getByRole('button', { name: 'Add Block' }));
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    expect(
      await screen.findByText(
        'Schedule blocks on the same day cannot overlap.',
      ),
    ).toBeInTheDocument();
    expect(
      mocks.apiFetch.mock.calls.some(
        ([path, , options]) =>
          path === '/schedule/me' && options?.method === 'PUT',
      ),
    ).toBe(false);
  });

  it('recovers from a load error through the retry action', async () => {
    const user = userEvent.setup();
    let failTeamRequest = true;
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/schedule/team') {
        return failTeamRequest
          ? Promise.reject(new Error('Team Schedule unavailable.'))
          : Promise.resolve(teamResponse(null));
      }
      if (path === '/schedule/me') return Promise.resolve(null);
      throw new Error(`Unexpected request: ${path}`);
    });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Team Schedule unavailable.',
    );
    failTeamRequest = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { name: 'Schedule' }),
    ).toBeInTheDocument();
  });
});
