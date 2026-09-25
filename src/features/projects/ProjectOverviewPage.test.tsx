import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../../shared/contracts/project';
import { apiFetch } from '../../lib/api';
import { ProjectOverviewPage } from './ProjectOverviewPage';

const projectId = '11111111-1111-4111-8111-111111111111';
const auth = vi.hoisted(() => ({
  memberId: '22222222-2222-4222-8222-222222222222',
  workspaceRole: 'MEMBER' as 'MEMBER' | 'ADMINISTRATOR',
}));
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
    member: {
      id: auth.memberId,
      workspaceRole: auth.workspaceRole,
      fullName: project.lead.fullName,
      email: project.lead.email,
    },
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

function renderPage(initialPath = `/projects/${projectId}`) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
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
    auth.memberId = project.lead.id;
    auth.workspaceRole = 'MEMBER';
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
      if (path === `/projects/${projectId}/messages`) {
        return Promise.resolve({ items: [], nextCursor: null, canWrite: true });
      }
      if (path === `/projects/${projectId}/announcements`) {
        return Promise.resolve({ items: [], canManage: true });
      }
      if (path === `/projects/${projectId}`) return Promise.resolve(project);
      return Promise.resolve({});
    });
  });

  it('shows the Project Members sidebar only on Project Chat', async () => {
    renderPage();

    expect(screen.queryByRole('heading', { name: 'Project Members' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('tab', { name: 'Chat' }));

    expect(
      await screen.findByRole('heading', { name: 'Project Members' }),
    ).toBeVisible();
    expect(await screen.findByLabelText('Project access for Project Member')).toHaveValue('CAN_VIEW');
    expect(screen.getByText('Project Lead', { selector: '.pw-chat-member-role' })).toBeVisible();
    expect(screen.getByText('Project Member')).toBeVisible();

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        `/projects/${projectId}/members`,
        expect.anything(),
        expect.objectContaining({ accessToken: 'token' }),
      ),
    );
    fireEvent.click(screen.getByRole('link', { name: 'Fast Project' }));
    expect(await screen.findByRole('tab', { name: 'Content' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('heading', { name: 'Project Members' })).not.toBeInTheDocument();
  });

  it('retains the project summary and reuses cached chat when returning from Content', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Fast Project' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Project status' })).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    expect(await screen.findByRole('heading', { name: 'Project chat' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Fast Project' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Project status' })).toBeVisible();
    expect(await screen.findByText('No messages yet. Start the conversation.')).toBeVisible();

    const messageReads = () => vi.mocked(apiFetch).mock.calls.filter(
      ([path]) => path === `/projects/${projectId}/messages`,
    ).length;
    expect(messageReads()).toBe(1);

    fireEvent.click(screen.getByRole('tab', { name: 'Content' }));
    expect(screen.getByRole('heading', { name: 'Fast Project' })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    expect(screen.getByRole('heading', { name: 'Fast Project' })).toBeVisible();
    expect(await screen.findByText('No messages yet. Start the conversation.')).toBeVisible();
    expect(messageReads()).toBe(1);
  });

  it('opens the Project Activity tab and loads persisted events', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path.endsWith('/workflow'))
        return Promise.resolve({ projectId, canManageStructure: false, stages: [] });
      if (path === `/projects/${projectId}/members`)
        return Promise.resolve(projectMembersResponse);
      if (path === `/projects/${projectId}/activity`)
        return Promise.resolve({
          items: [{
            id: '55555555-5555-4555-8555-555555555555',
            actor: { id: projectMemberId, fullName: 'Project Member' },
            outcomeId: null,
            entityType: 'Feature',
            entityId: '66666666-6666-4666-8666-666666666666',
            action: 'FEATURE_CREATED',
            metadata: { title: 'Design mockups' },
            createdAt: '2026-09-19T13:00:00.000Z',
          }],
          nextCursor: null,
        });
      if (path === `/projects/${projectId}`) return Promise.resolve(project);
      return Promise.resolve({});
    });

    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Activity' }));

    expect(await screen.findByRole('heading', { name: 'Project Activity' })).toBeVisible();
    expect(await screen.findByText(/created a feature/)).toBeVisible();
    expect(screen.getByText(/Design mockups/)).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Content' }));
    expect(screen.getByRole('tab', { name: 'Content' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('heading', { name: 'Project Activity' })).not.toBeInTheDocument();
  });

  it('shows other participants\' events to ordinary Project Members', async () => {
    auth.memberId = projectMemberId;
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path.endsWith('/workflow')) return Promise.resolve({ projectId, canManageStructure: false, stages: [] });
      if (path === `/projects/${projectId}/activity`) return Promise.resolve({
        items: [{
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          actor: { id: project.lead.id, fullName: 'Project Lead' },
          outcomeId: null, entityType: 'Stage', entityId: projectId,
          action: 'STAGE_CREATED', metadata: { name: 'Review' },
          createdAt: '2026-09-19T13:00:00.000Z',
        }], nextCursor: null, scope: 'PROJECT',
      });
      if (path === `/projects/${projectId}`) return Promise.resolve({
        ...project, isParticipating: true, currentMemberAccess: 'CAN_VIEW',
      });
      return Promise.resolve({});
    });
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Activity' }));
    expect(await screen.findByText(/created a stage/)).toBeVisible();
    expect(screen.getByText(/Project Lead/)).toBeVisible();
  });

  it('hides Activity from nonmembers, including direct activity links', async () => {
    auth.memberId = '77777777-7777-4777-8777-777777777777';
    renderPage(`/projects/${projectId}?tab=activity`);
    expect(await screen.findByText('Project Activity is available to Project Members and Leads.')).toBeVisible();
    expect(screen.queryByRole('tab', { name: 'Activity' })).not.toBeInTheDocument();
    expect(vi.mocked(apiFetch).mock.calls.some(([path]) => path === `/projects/${projectId}/activity`)).toBe(false);
  });

  it('shows persistent Project Chat and sends a message for a writable member', async () => {
    const existing = {
      id: '55555555-5555-4555-8555-555555555555',
      projectId,
      author: { id: projectMemberId, fullName: 'Project Member', email: 'member@example.com' },
      parentMessageId: null,
      replyTo: null,
      body: 'Initial project update',
      createdAt: '2026-09-23T01:00:00.000Z',
      editedAt: null,
      canEdit: false,
    };
    vi.mocked(apiFetch).mockImplementation((path: string, _schema, options) => {
      if (path.endsWith('/workflow'))
        return Promise.resolve({ projectId, canManageStructure: false, stages: [] });
      if (path === `/projects/${projectId}/members`)
        return Promise.resolve(projectMembersResponse);
      if (path === `/projects/${projectId}/messages` && options?.method === 'POST')
        return Promise.resolve({
          ...existing,
          body: 'Hello project team',
          id: '66666666-6666-4666-8666-666666666666',
        });
      if (path === `/projects/${projectId}/messages`)
        return Promise.resolve({ items: [existing], nextCursor: null, canWrite: true });
      if (path === `/projects/${projectId}/announcements`)
        return Promise.resolve({ items: [], canManage: true });
      if (path === `/projects/${projectId}`) return Promise.resolve(project);
      return Promise.resolve({});
    });

    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Chat' }));

    expect(await screen.findByRole('heading', { name: 'Project chat' })).toBeVisible();
    expect(await screen.findByText('Initial project update')).toBeVisible();

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Hello project team' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        `/projects/${projectId}/messages`,
        expect.anything(),
        expect.objectContaining({
          accessToken: 'token',
          method: 'POST',
          body: { body: 'Hello project team', parentMessageId: null, mentionMemberIds: [] },
        }),
      ),
    );
  });

  it('resets unsent Chat drafts when navigating directly between Projects', async () => {
    const otherProjectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path.endsWith('/workflow'))
        return Promise.resolve({ projectId, canManageStructure: false, stages: [] });
      if (path.endsWith('/members'))
        return Promise.resolve(projectMembersResponse);
      if (path.endsWith('/messages'))
        return Promise.resolve({ items: [], nextCursor: null, canWrite: true });
      if (path.endsWith('/announcements'))
        return Promise.resolve({ items: [], canManage: true });
      if (path === `/projects/${otherProjectId}`)
        return Promise.resolve({ ...project, id: otherProjectId, name: 'Other Project' });
      if (path === `/projects/${projectId}`) return Promise.resolve(project);
      return Promise.resolve({});
    });
    function NavigateBetweenProjects() {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() =>
          navigate(`/projects/${otherProjectId}?tab=chat`)
        }>
          Switch Project
        </button>
      );
    }
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/projects/${projectId}?tab=chat`]}>
          <Routes>
            <Route path="/projects/:projectId" element={
              <>
                <NavigateBetweenProjects />
                <ProjectOverviewPage />
              </>
            } />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const input = await screen.findByRole('textbox', { name: 'Message' });
    fireEvent.change(input, { target: { value: 'Unsent previous Project draft' } });
    expect(input).toHaveValue('Unsent previous Project draft');
    fireEvent.click(screen.getByRole('button', { name: 'Switch Project' }));
    expect(await screen.findByRole('link', { name: 'Other Project' })).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue(''),
    );
    expect(screen.queryByText('Unsent previous Project draft')).not.toBeInTheDocument();
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
