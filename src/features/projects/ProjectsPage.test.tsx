import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../../shared/contracts/project';
import { ProjectsPage } from './ProjectsPage';

const mockMember = {
  id: 'member-1',
  fullName: 'Rex Jumawid',
  email: 'rex@example.com',
  workspaceRole: 'ADMINISTRATOR',
};

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    member: mockMember,
    session: { access_token: 'fake-token' },
  }),
}));

const sampleProjects: Project[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'First 10 Customers',
    description: 'Build and qualify a repeatable pipeline.',
    status: 'PLANNING',
    lead: {
      id: 'member-1',
      fullName: 'Rex Jumawid',
      email: 'rex@example.com',
    },
    creator: {
      id: 'member-1',
      fullName: 'Rex Jumawid',
      email: 'rex@example.com',
    },
    departments: [
      { id: 'dept-1', name: 'Sales & Marketing', shortLabel: 'Sales' },
      { id: 'dept-2', name: 'X Team', shortLabel: 'X' },
    ],
    isParticipating: true,
    currentMemberAccess: 'CAN_EDIT',
    canChangeStatus: true,
    doneAt: null,
    archivedAt: null,
    createdAt: '2026-09-16T00:00:00.000Z',
    updatedAt: '2026-09-16T00:00:00.000Z',
    metrics: {
      totalOutcomes: 2,
      openOutcomes: 2,
      acceptedOutcomes: 0,
      activeStagesCount: 1,
      activeStages: [{ id: 'stage-1', name: 'Market Learning', openOutcomesCount: 2 }],
      progressPercentage: 30,
    },
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Client Management System',
    description: 'Client-facing management platform.',
    status: 'IN_PROGRESS',
    lead: {
      id: 'member-2',
      fullName: 'Lead Two',
      email: 'two@example.com',
    },
    creator: {
      id: 'member-2',
      fullName: 'Lead Two',
      email: 'two@example.com',
    },
    departments: [
      { id: 'dept-3', name: 'R&D', shortLabel: 'R&D' },
    ],
    isParticipating: false,
    currentMemberAccess: null,
    canChangeStatus: false,
    doneAt: null,
    archivedAt: null,
    createdAt: '2026-09-16T00:00:00.000Z',
    updatedAt: '2026-09-16T00:00:00.000Z',
    metrics: {
      totalOutcomes: 17,
      openOutcomes: 14,
      acceptedOutcomes: 3,
      activeStagesCount: 3,
      activeStages: [{ id: 'stage-2', name: 'Core Dev', openOutcomesCount: 6 }],
      progressPercentage: 54,
    },
  },
];

vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn((url: string) => {
    if (url === '/projects') {
      return Promise.resolve(sampleProjects);
    }
    if (url === '/projects/create-options') {
      return Promise.resolve({ leads: [], departments: [] });
    }
    return Promise.resolve({});
  }),
}));

function renderProjectsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders status groups: Planning, In Progress, Done with counts and cards', async () => {
    renderProjectsPage();

    expect(await screen.findByText('First 10 Customers')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByText('Planning')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();

    expect(screen.getByText('Client Management System')).toBeInTheDocument();

    // Done group has 0 projects, so empty text should be visible
    expect(screen.getByText('No done projects yet.')).toBeInTheDocument();
  });

  it('displays card metrics, department tags, workers, and workspace link', async () => {
    renderProjectsPage();

    expect(await screen.findByText('First 10 Customers')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('2 / 2 outcomes')).toBeInTheDocument();
    expect(screen.getByText('1 stage')).toBeInTheDocument();
    expect(screen.getByText('Sales & Marketing')).toBeInTheDocument();
    expect(screen.getByText('X Team')).toBeInTheDocument();
    expect(screen.getAllByText('No one currently working on this project').length).toBeGreaterThanOrEqual(1);

    const openWorkspaceLinks = screen.getAllByRole('link', { name: 'Open Workspace →' });
    expect(openWorkspaceLinks[0]).toHaveAttribute(
      'href',
      '/projects/11111111-1111-4111-8111-111111111111',
    );
  });

  it('filters projects by search term', async () => {
    const user = userEvent.setup();
    renderProjectsPage();

    expect(await screen.findByText('First 10 Customers')).toBeInTheDocument();
    expect(screen.getByText('Client Management System')).toBeInTheDocument();

    const searchInput = screen.getByLabelText('Search projects');
    await user.type(searchInput, 'Client');

    expect(screen.queryByText('First 10 Customers')).not.toBeInTheDocument();
    expect(screen.getByText('Client Management System')).toBeInTheDocument();
  });

  it('switches between All Projects and My Projects', async () => {
    const user = userEvent.setup();
    renderProjectsPage();

    expect(await screen.findByText('First 10 Customers')).toBeInTheDocument();
    expect(screen.getByText('Client Management System')).toBeInTheDocument();

    const myProjectsTab = screen.getByRole('tab', { name: 'My Projects' });
    await user.click(myProjectsTab);

    // Rex is lead/participating in First 10 Customers, but NOT Client Management System
    expect(screen.getByText('First 10 Customers')).toBeInTheDocument();
    expect(screen.queryByText('Client Management System')).not.toBeInTheDocument();

    const allProjectsTab = screen.getByRole('tab', { name: 'All Projects' });
    await user.click(allProjectsTab);
    expect(screen.getByText('Client Management System')).toBeInTheDocument();
  });

  it('collapses and expands a status group', async () => {
    renderProjectsPage();

    expect(await screen.findByText('First 10 Customers')).toBeInTheDocument();

    const planningToggle = screen.getByRole('button', { name: /Planning/i });
    expect(planningToggle).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    fireEvent.click(planningToggle);
    expect(planningToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('First 10 Customers')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(planningToggle);
    expect(planningToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('First 10 Customers')).toBeInTheDocument();
  });

  it('opens Add Project dialog when + Add Project is clicked', async () => {
    const user = userEvent.setup();
    renderProjectsPage();

    await screen.findByText('First 10 Customers');
    const addButton = screen.getByRole('button', { name: '+ Add Project' });
    await user.click(addButton);

    expect(screen.getByRole('dialog', { name: 'Add Project' })).toBeInTheDocument();
  });
});
