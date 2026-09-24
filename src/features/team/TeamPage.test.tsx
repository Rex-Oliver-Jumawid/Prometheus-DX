import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamPage } from './TeamPage';

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({ session: { access_token: 'fake-token' } }),
}));
vi.mock('../../lib/api', () => ({ apiFetch: mocks.apiFetch }));

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname + location.search}
    </output>
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TeamPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TeamPage', () => {
  beforeEach(() => mocks.apiFetch.mockReset());

  it('renders the Figma Team hierarchy from Registry, Schedule, and WorkSession data', async () => {
    const user = userEvent.setup();
    mocks.apiFetch.mockResolvedValue({
      timezone: 'Asia/Manila',
      asOf: '2026-09-18T05:00:00.000Z',
      weekStart: '2026-09-13T16:00:00.000Z',
      weekEnd: '2026-09-20T16:00:00.000Z',
      summary: {
        memberCount: 1,
        workingNowCount: 1,
        scheduledMinutes: 360,
        actualWorkedSeconds: 18_000,
      },
      members: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          fullName: 'Member One',
          position: 'Designer',
          department: {
            id: '22222222-2222-4222-8222-222222222222',
            name: 'Creative',
            shortLabel: 'CRT',
          },
          workingNow: true,
          scheduledMinutes: 360,
          actualWorkedSeconds: 18_000,
          todaySchedule: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              weekday: 'FRIDAY',
              startTime: '09:00',
              endTime: '13:00',
            },
          ],
        },
      ],
    });

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Team' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'People, availability, current work status, and weekly commitment at a glance.',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('Member One')).toBeInTheDocument();
    expect(screen.getByText('Designer / Creative')).toBeInTheDocument();
    expect(screen.getByText('Working Now')).toBeInTheDocument();
    expect(screen.getByText(/9:00 AM.*1:00 PM/)).toBeInTheDocument();
    expect(screen.getAllByText('6h').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5h').length).toBeGreaterThan(0);
    const viewSchedule = screen.getByRole('button', { name: 'View Schedule' });
    expect(viewSchedule).toBeInTheDocument();

    await user.click(viewSchedule);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/schedule?view=shifts&member=11111111-1111-4111-8111-111111111111',
    );
  });

  it('renders a rest day when a member has no schedule blocks today', async () => {
    mocks.apiFetch.mockResolvedValue({
      timezone: 'Asia/Manila',
      asOf: '2026-09-18T05:00:00.000Z',
      weekStart: '2026-09-13T16:00:00.000Z',
      weekEnd: '2026-09-20T16:00:00.000Z',
      summary: {
        memberCount: 1,
        workingNowCount: 0,
        scheduledMinutes: 360,
        actualWorkedSeconds: 0,
      },
      members: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          fullName: 'Member One',
          position: null,
          department: {
            id: '22222222-2222-4222-8222-222222222222',
            name: 'Creative',
            shortLabel: 'CRT',
          },
          workingNow: false,
          scheduledMinutes: 360,
          actualWorkedSeconds: 0,
          todaySchedule: [],
        },
      ],
    });

    renderPage();

    expect(await screen.findByText('Member One')).toBeInTheDocument();
    expect(screen.getByText('Creative')).toBeInTheDocument();
    expect(screen.getByText('Timed Out')).toBeInTheDocument();
    expect(screen.getByText('Rest day / no schedule')).toBeInTheDocument();
  });

  it('renders an intentional empty state', async () => {
    mocks.apiFetch.mockResolvedValue({
      timezone: 'Asia/Manila',
      asOf: '2026-09-18T05:00:00.000Z',
      weekStart: '2026-09-13T16:00:00.000Z',
      weekEnd: '2026-09-20T16:00:00.000Z',
      summary: {
        memberCount: 0,
        workingNowCount: 0,
        scheduledMinutes: 0,
        actualWorkedSeconds: 0,
      },
      members: [],
    });

    renderPage();

    expect(
      await screen.findByText('No active Registry members.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Active members will appear here with their schedule and recorded work totals.',
      ),
    ).toBeInTheDocument();
  });
});
