import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamPage } from './TeamPage';

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({ session: { access_token: 'fake-token' } }),
}));
vi.mock('../../lib/api', () => ({ apiFetch: mocks.apiFetch }));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TeamPage', () => {
  beforeEach(() => mocks.apiFetch.mockReset());

  it('renders Registry identity, Working Now, and separate scheduled/actual totals', async () => {
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
          todaySchedule: [],
        },
      ],
    });
    renderPage();

    expect(await screen.findByText('Member One')).toBeInTheDocument();
    expect(screen.getByText('Designer')).toBeInTheDocument();
    expect(screen.getByText('Creative')).toBeInTheDocument();
    expect(screen.getByText('Working Now')).toBeInTheDocument();
    expect(screen.getAllByText('6h').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5h').length).toBeGreaterThan(0);
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
  });
});
