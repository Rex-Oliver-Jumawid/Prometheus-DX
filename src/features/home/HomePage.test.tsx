import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { HomeDashboardResponse } from '../../../shared/contracts/home';
import type { CurrentMember } from '../../../shared/contracts/member';
import { AuthContext } from '../auth/auth-context';
import { HomeDashboardView, HomePage } from './HomePage';

const member: CurrentMember = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'rex@example.com',
  fullName: 'Rex Jumawid',
  workspaceRole: 'ADMINISTRATOR',
  status: 'ACTIVE',
  position: 'Founder',
  nickname: 'Rex',
  phoneNumber: null,
  about: null,
  profileImagePath: null,
  department: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'X Team',
    shortLabel: 'X Team',
  },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const data: HomeDashboardResponse = {
  timezone: 'Asia/Manila',
  asOf: '2026-09-22T07:00:00.000Z',
  summary: {
    workingNow: 2,
    activeProjects: 2,
    totalProjects: 3,
    awaitingReview: 1,
    revisionRequests: 1,
    actualWorkedSeconds: 66_960,
    plannedMinutes: 1_020,
  },
  projects: {
    leading: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Client Management System',
        status: 'IN_PROGRESS',
        progressPercentage: 53,
        relationship: 'LEAD',
        accessLevel: null,
      },
    ],
    participating: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Customer Onboarding Launch',
        status: 'PLANNING',
        progressPercentage: 30,
        relationship: 'PARTICIPANT',
        accessLevel: 'CAN_EDIT',
      },
    ],
  },
  workingNow: [
    {
      id: member.id,
      fullName: member.fullName,
      department: member.department,
    },
  ],
  needsAttention: [
    {
      id: 'review:55555555-5555-4555-8555-555555555555',
      kind: 'REVIEW',
      projectId: '33333333-3333-4333-8333-333333333333',
      outcomeId: '55555555-5555-4555-8555-555555555555',
      title: 'Approved application UI/UX',
      projectName: 'Client Management System',
      stageName: 'Experience Design',
      detail: null,
    },
  ],
};

describe('HomeDashboardView', () => {
  it('renders Leading and Participating groups with real project relationships and summaries', () => {
    render(
      <MemoryRouter>
        <HomeDashboardView data={data} member={member} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Leading' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Participating' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Client Management System')).toBeInTheDocument();
    expect(screen.getByText('Customer Onboarding Launch')).toBeInTheDocument();
    expect(screen.getByText('18.6h')).toBeInTheDocument();
    expect(screen.getByText('17h planned commitment')).toBeInTheDocument();
  });

  it('uses intentional empty states and does not create a Reports route', () => {
    const emptyData: HomeDashboardResponse = {
      ...data,
      projects: { leading: [], participating: [] },
      workingNow: [],
      needsAttention: [],
    };

    render(
      <MemoryRouter>
        <HomeDashboardView data={emptyData} member={member} />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('You are not leading a project right now.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No active work sessions.')).toBeInTheDocument();
    expect(screen.getByText('Nothing needs attention.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reports/ })).toBeDisabled();
  });

  it('links project, attention, and implemented quick-access destinations', () => {
    render(
      <MemoryRouter>
        <HomeDashboardView data={data} member={member} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Client Management System Lead/ })).toHaveAttribute(
      'href',
      '/projects/33333333-3333-4333-8333-333333333333',
    );
    expect(screen.getByRole('link', { name: /Approved application UI\/UX/ })).toHaveAttribute(
      'href',
      '/projects/33333333-3333-4333-8333-333333333333/outcomes/55555555-5555-4555-8555-555555555555',
    );
    expect(screen.getByRole('link', { name: /Schedule/ })).toHaveAttribute(
      'href',
      '/schedule',
    );
    expect(screen.getByRole('link', { name: /Team/ })).toHaveAttribute(
      'href',
      '/team',
    );
  });
});

describe('HomePage request states', () => {
  it('shows an error and retry action instead of fake statistics when the dashboard request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            session: { access_token: 'token' } as never,
            member,
            memberPending: false,
            memberError: null,
            retryAuthorization: vi.fn(),
            signOut: vi.fn(),
          }}
        >
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Home could not be loaded' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
