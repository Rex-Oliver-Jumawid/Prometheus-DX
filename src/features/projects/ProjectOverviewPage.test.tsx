import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../../shared/contracts/project';
import { apiFetch } from '../../lib/api';
import { ProjectOverviewPage } from './ProjectOverviewPage';

const projectId = '11111111-1111-4111-8111-111111111111';
const projectMemberId = '44444444-4444-4444-8444-444444444444';
const projectMembersResponse = {
  projectId,
  canManageAccess: true,
  members: [
    {
      member: {
        id: projectMemberId,
        fullName: 'Project Member',
        email: 'member@example.com',
      },
      accessLevel: 'CAN_VIEW' as const,
      outcomes: [],
    },
  ],
};

const project: Project = {
  id: projectId,
  name: 'Fast Project',
  description: 'Performance regression fixture.',
  status: 'PLANNING',
  lead: {
    id: '22222222-2222-4222-8222-222222222222',
    fullName: 'Project Lead',
    email: 'lead@example.com',
  },
  creator: {
    id: '33333333-3333-4333-8333-333333333333',
    fullName: 'Project Creator',
    email: 'creator@example.com',
  },
  departments: [],
  isParticipating: false,
  currentMemberAccess: null,
  canChangeStatus: true,
  doneAt: null,
  archivedAt: null,
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
  metrics: {
    totalOutcomes: 0,
    openOutcomes: 0,
    acceptedOutcomes: 0,
    activeStagesCount: 0,
    activeStages: [],
    progressPercentage: 0,
  },
};

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    session: {
      access_token: 'token',
      user: { id: project.lead.id },
    },
  }),
}));

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/projects/${projectId}`]}>
        <Routes>
          <Route
            path="/projects/:projectId"
            element={<ProjectOverviewPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('ProjectOverviewPage status mutation', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path.endsWith('/workflow')) {
        return Promise.resolve({
          projectId,
          canManageStructure: false,
          stages: [],
        });
      }
      if (path === `/projects/${projectId}/members`) {
        return Promise.resolve(projectMembersResponse);
      }
      if (path === `/projects/${projectId}`) return Promise.resolve(project);
      return Promise.resolve({});
    });
  });

  it('loads the Project Members surface on the Project overview', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Project Members' }),
    ).toBeVisible();
    expect(
      await screen.findByLabelText('Project access for Project Member'),
    ).toHaveValue('CAN_VIEW');

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        `/projects/${projectId}/members`,
        expect.anything(),
        expect.objectContaining({ accessToken: 'token' }),
      ),
    );
  });

  it('updates status immediately and rolls back a failed request', async () => {
    let rejectStatus!: (error: Error) => void;
    const statusRequest = new Promise((_, reject) => {
      rejectStatus = reject;
    });
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path.endsWith('/workflow')) {
        return Promise.resolve({
          projectId,
          canManageStructure: false,
          stages: [],
        });
      }
      if (path === `/projects/${projectId}/members`) {
        return Promise.resolve(projectMembersResponse);
      }
      if (path.endsWith('/status')) return statusRequest;
      return Promise.resolve(project);
    });
    renderPage();

    const select = await screen.findByLabelText('Project status');
    fireEvent.change(select, { target: { value: 'IN_PROGRESS' } });

    await waitFor(() => expect(select).toHaveValue('IN_PROGRESS'));
    rejectStatus(new Error('Status could not be saved.'));

    await waitFor(() => expect(select).toHaveValue('PLANNING'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Status could not be saved.',
    );
  });
});
