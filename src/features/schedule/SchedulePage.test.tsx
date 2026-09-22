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

function mockExistingSchedule(schedule: MemberSchedule = savedSchedule) {
  mocks.apiFetch.mockImplementation(
    (
      path: string,
      _schema: unknown,
      options?: { method?: string; body?: unknown },
    ) => {
      if (path === '/schedule/team') return Promise.resolve(teamResponse(schedule));
      if (path === '/schedule/me' && options?.method === 'PUT') {
        return Promise.resolve({
          ...schedule,
          ...(options.body as object),
          blocks: (
            (options.body as { blocks: MemberSchedule['blocks'] }).blocks ?? []
          ).map((block, index) => ({
            ...block,
            id: `44444444-4444-4444-8444-${String(index + 1).padStart(12, '0')}`,
          })),
        });
      }
      if (path === '/schedule/me') return Promise.resolve({ schedule });
      throw new Error(`Unexpected request: ${path}`);
    },
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
        if (path === '/work-sessions/history') {
          return Promise.resolve({
            timezone: 'Asia/Manila',
            weekStart: '2026-09-13T16:00:00.000Z',
            weekEnd: '2026-09-20T16:00:00.000Z',
            totalDurationSeconds: 18_000,
            sessions: [
              {
                id: '55555555-5555-4555-8555-555555555555',
                memberId: '11111111-1111-4111-8111-111111111111',
                timeIn: '2026-09-18T00:00:00.000Z',
                timeOut: '2026-09-18T05:00:00.000Z',
                status: 'COMPLETED',
                durationSeconds: 18_000,
                createdAt: '2026-09-18T00:00:00.000Z',
                updatedAt: '2026-09-18T05:00:00.000Z',
              },
            ],
          });
        }
        if (path === '/team') {
          return Promise.resolve({
            timezone: 'Asia/Manila',
            asOf: '2026-09-18T05:00:00.000Z',
            weekStart: '2026-09-13T16:00:00.000Z',
            weekEnd: '2026-09-20T16:00:00.000Z',
            summary: {
              memberCount: 2,
              workingNowCount: 0,
              scheduledMinutes: 960,
              actualWorkedSeconds: 18_000,
            },
            members: teamResponse(null).members.map((item, index) => ({
              id: item.id,
              fullName: item.fullName,
              position: item.position,
              department: item.department,
              workingNow: false,
              scheduledMinutes: item.schedule?.targetWeeklyMinutes ?? 0,
              actualWorkedSeconds: index === 0 ? 18_000 : 0,
              todaySchedule: [],
            })),
          });
        }
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
        if (path === '/schedule/me') return Promise.resolve({ schedule: null });
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

  it('filters the merged calendar by people and department', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', {
      name: 'Your schedule is ready to configure',
    });
    expect(screen.getByText('Member Two')).toBeInTheDocument();

    await user.click(screen.getByText('All 2 members'));
    await user.click(screen.getByRole('checkbox', { name: 'Member Two' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.queryByText('Member Two')).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Department' }),
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    );
    expect(
      screen.getByText('No schedule blocks match these filters.'),
    ).toBeInTheDocument();
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
    expect(await screen.findByText('Weekly work history')).toBeInTheDocument();
    expect(screen.getAllByText('5h').length).toBeGreaterThan(0);

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
        if (path === '/schedule/me') return Promise.resolve({ schedule: null });
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

  it('rejects a button adjustment that would overlap another own block', async () => {
    const user = userEvent.setup();
    const twoBlockSchedule: MemberSchedule = {
      ...savedSchedule,
      targetWeeklyMinutes: 420,
      blocks: [
        { ...savedSchedule.blocks[0], startTime: '09:00', endTime: '12:00' },
        {
          id: '66666666-6666-4666-8666-666666666666',
          weekday: 'MONDAY',
          startTime: '13:00',
          endTime: '17:00',
        },
      ],
    };
    mockExistingSchedule(twoBlockSchedule);
    renderPage();

    await screen.findByRole('heading', { name: 'Schedule' });
    await user.click(screen.getByRole('button', { name: 'Configure My Schedule' }));
    await user.click(
      screen.getByRole('button', {
        name: /Select Monday schedule block, 9:00 AM to 12:00 PM/,
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.getByText(/Monday · 10:00 AM.*1:00 PM · 3h/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Later' }));

    expect(
      screen.getByText(
        'Cannot move or resize this block: it would overlap another of your blocks.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Monday · 10:00 AM.*1:00 PM · 3h/)).toBeInTheDocument();
  });


  it('generates a weekly draft, selects a block, adjusts it and cancels without saving', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Your schedule is ready to configure' });
    await user.click(screen.getAllByRole('button', { name: 'Configure My Schedule' })[0]);
    expect(screen.getByText('Select one of your schedule blocks.')).toBeInTheDocument();
    await user.clear(screen.getByRole('spinbutton', { name: 'Hours per week' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Hours per week' }), '20');
    await user.click(screen.getByRole('button', { name: 'Generate initial schedule' }));
    expect(screen.getByText('Scheduled 20h / Target 20h')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Select Monday schedule block/ }));
    await user.click(screen.getByRole('button', { name: 'Earlier' }));
    expect(screen.getByRole('button', { name: /Select Monday schedule block, 1:00 PM/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '− 1 hour' }));
    expect(screen.getByText('Scheduled 19h / Target 20h')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Configure My Schedule' })).not.toBeInTheDocument();
    expect(mocks.apiFetch.mock.calls.some(([p, , options]) =>
      p === '/schedule/me' && options?.method === 'PUT')).toBe(false);
  });

  it('toggles rest days and rejects exceeding the configured limit', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Your schedule is ready to configure' });
    await user.click(screen.getAllByRole('button', { name: 'Configure My Schedule' })[0]);
    await user.clear(screen.getByRole('spinbutton', { name: 'Hours per week' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Hours per week' }), '20');
    await user.click(screen.getByRole('button', { name: 'Generate initial schedule' }));
    await user.click(screen.getByRole('button', { name: /Saturday: rest day, make workday/ }));
    expect(screen.getByText('Scheduled 24h / Target 20h')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Monday: workday, make rest day/ }));
    expect(screen.getByText('Scheduled 20h / Target 20h')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tuesday: workday, make rest day/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Unmark another rest day');
    expect(screen.getByText('Scheduled 20h / Target 20h')).toBeInTheDocument();
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
      if (path === '/schedule/me') return Promise.resolve({ schedule: null });
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

  it('drags an own block across days and time, then resizes it from the bottom handle', async () => {
    mockExistingSchedule();
    const { container } = renderPage();

    await screen.findByRole('heading', { name: 'Schedule' });
    fireEvent.click(screen.getByRole('button', { name: 'Configure My Schedule' }));

    const original = screen.getByRole('button', {
      name: /Select Monday schedule block, 9:00 AM to 5:00 PM/,
    });
    const stage = container.querySelector('.schedule-calendar-stage');
    expect(stage).not.toBeNull();

    fireEvent.pointerDown(original, {
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(stage!, {
      pointerId: 1,
      clientX: 230,
      clientY: 144,
    });
    fireEvent.pointerUp(stage!, { pointerId: 1, clientX: 230, clientY: 144 });

    const moved = screen.getByRole('button', {
      name: /Select Tuesday schedule block, 10:00 AM to 6:00 PM/,
    });
    expect(moved).toHaveAttribute('aria-pressed', 'true');

    const handle = moved.querySelector('[aria-label="Resize selected schedule block"]');
    expect(handle).not.toBeNull();
    fireEvent.pointerDown(handle!, {
      pointerId: 2,
      button: 0,
      clientX: 230,
      clientY: 144,
    });
    fireEvent.pointerMove(stage!, {
      pointerId: 2,
      clientX: 230,
      clientY: 188,
    });
    fireEvent.pointerUp(stage!, { pointerId: 2, clientX: 230, clientY: 188 });

    expect(
      screen.getByRole('button', {
        name: /Select Tuesday schedule block, 10:00 AM to 7:00 PM/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tuesday · 10:00 AM.*7:00 PM · 9h/)).toBeInTheDocument();
  });

  it('swaps the rest day when an own block is dragged onto a rest day', async () => {
    mockExistingSchedule();
    const { container } = renderPage();

    await screen.findByRole('heading', { name: 'Schedule' });
    fireEvent.click(screen.getByRole('button', { name: 'Configure My Schedule' }));

    const original = screen.getByRole('button', {
      name: /Select Monday schedule block, 9:00 AM to 5:00 PM/,
    });
    const stage = container.querySelector('.schedule-calendar-stage');
    expect(stage).not.toBeNull();

    fireEvent.pointerDown(original, {
      pointerId: 3,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(stage!, {
      pointerId: 3,
      clientX: 735,
      clientY: 100,
    });
    fireEvent.pointerUp(stage!, { pointerId: 3, clientX: 735, clientY: 100 });

    expect(
      screen.getByRole('button', {
        name: /Select Saturday schedule block, 9:00 AM to 5:00 PM/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Monday: rest day, make workday' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Saturday: workday, make rest day' }),
    ).toBeInTheDocument();
  });

  it('rolls back an invalid pointer move that would overlap another own block', async () => {
    const twoBlockSchedule: MemberSchedule = {
      ...savedSchedule,
      targetWeeklyMinutes: 420,
      blocks: [
        { ...savedSchedule.blocks[0], startTime: '09:00', endTime: '12:00' },
        {
          id: '66666666-6666-4666-8666-666666666666',
          weekday: 'MONDAY',
          startTime: '13:00',
          endTime: '17:00',
        },
      ],
    };
    mockExistingSchedule(twoBlockSchedule);
    const { container } = renderPage();

    await screen.findByRole('heading', { name: 'Schedule' });
    fireEvent.click(screen.getByRole('button', { name: 'Configure My Schedule' }));

    const original = screen.getByRole('button', {
      name: /Select Monday schedule block, 9:00 AM to 12:00 PM/,
    });
    const stage = container.querySelector('.schedule-calendar-stage');
    expect(stage).not.toBeNull();

    fireEvent.pointerDown(original, {
      pointerId: 4,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(stage!, {
      pointerId: 4,
      clientX: 100,
      clientY: 276,
    });
    fireEvent.pointerUp(stage!, { pointerId: 4, clientX: 100, clientY: 276 });

    expect(
      screen.getByRole('button', {
        name: /Select Monday schedule block, 9:00 AM to 12:00 PM/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'That placement is unavailable. Avoid overlapping your own blocks, or free the source day before swapping onto a rest day.',
      ),
    ).toBeInTheDocument();
  });

  it('keeps overlapping team schedules in separate visual lanes', async () => {
    mockExistingSchedule();
    const { container } = renderPage();

    await screen.findByRole('heading', { name: 'Schedule' });
    const mondayBlocks = container.querySelectorAll(
      '.schedule-calendar-day[aria-label="Monday"] .schedule-calendar-block',
    );

    expect(mondayBlocks).toHaveLength(2);
    expect((mondayBlocks[0] as HTMLElement).style.width).toContain('50%');
    expect((mondayBlocks[1] as HTMLElement).style.width).toContain('50%');
  });

});
