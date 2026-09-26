import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkAttendanceControl } from './WorkAttendanceControl';

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({ session: { access_token: 'fake-token' } }),
}));

vi.mock('../../lib/api', () => ({ apiFetch: mocks.apiFetch }));

const activeResponse = {
  timezone: 'Asia/Manila' as const,
  asOf: '2026-09-18T04:00:00.000Z',
  session: {
    id: '22222222-2222-4222-8222-222222222222',
    memberId: '11111111-1111-4111-8111-111111111111',
    timeIn: '2026-09-18T03:00:00.000Z',
    timeOut: null,
    status: 'OPEN' as const,
    durationSeconds: 3_600,
    createdAt: '2026-09-18T03:00:00.000Z',
    updatedAt: '2026-09-18T03:00:00.000Z',
  },
};

function renderControl() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkAttendanceControl />
    </QueryClientProvider>,
  );
}

describe('WorkAttendanceControl', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/team') return Promise.resolve({
        timezone: 'Asia/Manila',
        asOf: '2026-09-18T04:00:00.000Z',
        weekStart: '2026-09-14T00:00:00.000Z',
        weekEnd: '2026-09-21T00:00:00.000Z',
        summary: { memberCount: 0, workingNowCount: 0, scheduledMinutes: 0, actualWorkedSeconds: 0 },
        members: [],
      });
      return Promise.resolve(activeResponse);
    });
  });

  it('keeps initial attendance loading silent and clipped', async () => {
    let resolveCurrent: (value: typeof activeResponse) => void = () => undefined;
    const currentPromise = new Promise<typeof activeResponse>((resolve) => {
      resolveCurrent = resolve;
    });
    mocks.apiFetch.mockReturnValue(currentPromise);
    renderControl();

    const attendance = screen.getByLabelText('Time attendance');
    expect(attendance).toHaveAttribute('aria-busy', 'true');
    expect(attendance).toHaveClass('pending');
    expect(screen.queryByText(/Loading attendance/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Time In|Time Out/i }),
    ).not.toBeInTheDocument();

    resolveCurrent(activeResponse);
    await screen.findByRole('button', { name: /Time Out/ });
  });

  it('renders the persisted active session and prevents duplicate action while pending', async () => {
    const user = userEvent.setup();
    let resolveTimeOut: (value: typeof activeResponse) => void = () =>
      undefined;
    mocks.apiFetch.mockImplementation((path: string) => {
      if (!path) return Promise.resolve(activeResponse);
      if (path === '/work-sessions/current')
        return Promise.resolve(activeResponse);
      if (path === '/work-sessions/time-out') {
        return new Promise((resolve) => {
          resolveTimeOut = resolve;
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    renderControl();

    const button = await screen.findByRole('button', { name: /Time Out/ });
    expect(screen.getByLabelText('Elapsed work session')).toBeInTheDocument();
    await user.click(button);
    expect(button).toBeDisabled();
    expect(
      mocks.apiFetch.mock.calls.filter(
        ([path]) => path === '/work-sessions/time-out',
      ),
    ).toHaveLength(1);
    resolveTimeOut(activeResponse);
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('times in from the no-active-session state', async () => {
    const user = userEvent.setup();
    mocks.apiFetch.mockImplementation((path: string) => {
      if (!path) return Promise.resolve(activeResponse);
      if (path === '/work-sessions/current') {
        return Promise.resolve({ ...activeResponse, session: null });
      }
      if (path === '/work-sessions/time-in')
        return Promise.resolve(activeResponse);
      throw new Error(`Unexpected request: ${path}`);
    });
    renderControl();

    await user.click(await screen.findByRole('button', { name: /Time In/ }));
    await waitFor(() =>
      expect(mocks.apiFetch).toHaveBeenCalledWith(
        '/work-sessions/time-in',
        expect.anything(),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Time In/ })).toBeEnabled(),
    );
  });

  it('shows the minimum self-correction workflow for stale sessions', async () => {
    mocks.apiFetch.mockResolvedValue({
      ...activeResponse,
      session: { ...activeResponse.session, status: 'NEEDS_CORRECTION' },
    });
    renderControl();

    expect(await screen.findByText('Correction required')).toBeInTheDocument();
    expect(screen.getByLabelText('Correct Time In')).toBeInTheDocument();
    expect(screen.getByLabelText('Correct Time Out')).toBeInTheDocument();
    expect(screen.getByLabelText('Reason')).toBeInTheDocument();
  });
  it('opens the live working-member list when the avatar group is tapped', async () => {
    const user = userEvent.setup();
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === '/team') return Promise.resolve({
        timezone: 'Asia/Manila',
        asOf: '2026-09-18T04:00:00.000Z',
        weekStart: '2026-09-14T00:00:00.000Z',
        weekEnd: '2026-09-21T00:00:00.000Z',
        summary: { memberCount: 2, workingNowCount: 1, scheduledMinutes: 0, actualWorkedSeconds: 0 },
        members: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            fullName: 'Rex Oliver',
            position: 'Developer',
            profileImagePath: null,
            department: { id: '22222222-2222-4222-8222-222222222222', name: 'Research', shortLabel: 'R&D' },
            visiworkDepartmentId: null,
            workingNow: true,
            scheduledMinutes: 0,
            actualWorkedSeconds: 300,
            todaySchedule: [],
          },
          {
            id: '33333333-3333-4333-8333-333333333333',
            fullName: 'Other Member',
            position: null,
            profileImagePath: null,
            department: { id: '22222222-2222-4222-8222-222222222222', name: 'Research', shortLabel: 'R&D' },
            visiworkDepartmentId: null,
            workingNow: false,
            scheduledMinutes: 0,
            actualWorkedSeconds: 0,
            todaySchedule: [],
          },
        ],
      });
      return Promise.resolve(activeResponse);
    });
    renderControl();
    const trigger = await screen.findByRole('button', { name: /View working members, 1 working now/ });
    await user.click(trigger);
    expect(screen.getByRole('region', { name: 'Working members' })).toHaveTextContent('Rex Oliver');
    expect(screen.getByRole('region', { name: 'Working members' })).not.toHaveTextContent('Other Member');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Working members' })).not.toBeInTheDocument();
  });

});
