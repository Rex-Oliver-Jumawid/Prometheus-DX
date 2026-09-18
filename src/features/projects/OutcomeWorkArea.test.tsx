import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectWorkflowResponse } from '../../../shared/contracts/project-workflow';
import { apiFetch } from '../../lib/api';
import { ProjectWorkflow } from './ProjectWorkflow';

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));

const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const outcomeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const prereqOutcomeId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const baseOutcome = {
  id: outcomeId,
  stageId,
  title: 'Launch MVP',
  description: '' as string | null,
  position: 0,
  lifecycleStatus: 'OPEN' as const,
  isJoined: true,
  isLocked: false,
  hasForReview: false,
  departments: [{ id: 'dep1', name: 'Engineering', shortLabel: 'Eng' }],
  acceptanceCriteria: [{ id: 'crit1', position: 0, description: 'All tests pass' }],
  prerequisites: [] as Array<{ id: string; title: string; lifecycleStatus: 'OPEN' | 'NEEDS_REVISION' | 'ACCEPTED'; resolved: boolean }>,
  members: [],
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
};

const workflowFixture: ProjectWorkflowResponse = {
  projectId,
  canManageStructure: false,
  stages: [
    {
      id: stageId,
      projectId,
      name: 'Alpha',
      description: '',
      position: 0,
      outcomes: [baseOutcome],
      createdAt: '2026-09-18T00:00:00.000Z',
      updatedAt: '2026-09-18T00:00:00.000Z',
    },
  ],
};

const emptyWorkData = {
  features: [] as Array<Record<string, unknown>>,
  completedTasks: 0,
  totalTasks: 0,
  progress: 0,
  canPlan: true,
  canExecute: true,
};

const emptyDeliveryData = {
  submissions: [] as Array<Record<string, unknown>>,
  revisions: [] as Array<Record<string, unknown>>,
  acceptances: [] as Array<Record<string, unknown>>,
  dependencies: [] as Array<Record<string, unknown>>,
  activity: [] as Array<Record<string, unknown>>,
  canSubmit: true,
  isLead: false,
  hasForReview: false,
  lifecycleStatus: 'OPEN',
  outcomeUpdatedAt: '2026-09-18T00:00:00.000Z',
  draft: null,
};

function renderWorkspace(
  options: {
    outcomeOverride?: Record<string, unknown>;
    workData?: unknown;
    workPromise?: Promise<unknown>;
    deliveryData?: unknown;
    deliveryPromise?: Promise<unknown>;
    isLead?: boolean;
  } = {},
) {
  const {
    outcomeOverride = {},
    workData = emptyWorkData,
    workPromise,
    deliveryData = emptyDeliveryData,
    deliveryPromise,
    isLead = false,
  } = options;

  const fixture = {
    ...workflowFixture,
    stages: workflowFixture.stages.map((stage) => ({
      ...stage,
      outcomes: stage.outcomes.map((o) =>
        o.id === outcomeId ? ({ ...o, ...outcomeOverride } as unknown as typeof o) : o,
      ),
    })),
  } as ProjectWorkflowResponse;

  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path === `/projects/${projectId}/workflow`) {
      return Promise.resolve(fixture);
    }
    if (path === `/projects/${projectId}/outcomes/${outcomeId}/work`) {
      return workPromise ?? Promise.resolve(workData);
    }
    if (path.startsWith(`/projects/${projectId}/outcomes/${outcomeId}/delivery`)) {
      return deliveryPromise ?? Promise.resolve(deliveryData);
    }
    return Promise.resolve({ success: true });
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/projects/${projectId}`]}>
        <ProjectWorkflow
          projectId={projectId}
          outcomeId={outcomeId}
          isLead={isLead}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return queryClient;
}

describe('Outcome Workspace - Empty State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty features state when zero features exist', async () => {
    renderWorkspace();
    expect(await screen.findByText('No features defined yet')).toBeInTheDocument();
    expect(
      screen.getByText('Start by adding the main pieces of work needed to achieve this outcome.'),
    ).toBeInTheDocument();
  });

  it('shows Add Feature button in empty state when user can plan', async () => {
    renderWorkspace({ workData: { ...emptyWorkData, canPlan: true } });
    await screen.findByText('No features defined yet');
    const addButtons = screen.getAllByRole('button', { name: /add.*feature/i });
    expect(addButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking Add Feature in empty state opens the feature creation form', async () => {
    renderWorkspace({ workData: { ...emptyWorkData, canPlan: true } });
    await screen.findByText('No features defined yet');
    const addButtons = screen.getAllByRole('button', { name: /add.*feature/i });
    fireEvent.click(addButtons[0]);
    expect(screen.getByRole('textbox', { name: /feature title/i })).toBeInTheDocument();
  });

  it('does not show Add Feature button when user cannot plan', async () => {
    renderWorkspace({
      workData: { ...emptyWorkData, canPlan: false },
      outcomeOverride: { isJoined: false },
    });
    await screen.findByText('No features defined yet');
    expect(screen.queryAllByRole('button', { name: /add.*feature/i })).toHaveLength(0);
  });

  it('does not show "Add another feature" bottom button when feature list is empty', async () => {
    renderWorkspace({ workData: { ...emptyWorkData, canPlan: true } });
    await screen.findByText('No features defined yet');
    expect(screen.queryByRole('button', { name: /add another feature/i })).not.toBeInTheDocument();
  });

  it('shows "Add another feature" at bottom when features exist', async () => {
    const workWithFeatures = {
      ...emptyWorkData,
      canPlan: true,
      features: [
        {
          id: 'feat-1',
          title: 'User Auth',
          description: '',
          status: 'TODO' as const,
          tasks: [],
          createdAt: '2026-09-18T00:00:00.000Z',
          updatedAt: '2026-09-18T00:00:00.000Z',
        },
      ],
    };
    renderWorkspace({ workData: workWithFeatures });
    expect(await screen.findByRole('article', { name: /feature user auth/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add another feature/i })).toBeInTheDocument();
  });

  it('renders "0 submissions" count in the submission history', async () => {
    renderWorkspace();
    await screen.findByText(/0 submission/i);
    expect(screen.getByText('No submissions yet.')).toBeInTheDocument();
  });

  it('renders "Team submissions" section title matching prototype', async () => {
    renderWorkspace();
    expect(await screen.findByRole('heading', { name: 'Team submissions' })).toBeInTheDocument();
  });

  it('renders no-prerequisite state in context rail when prerequisites are empty', async () => {
    renderWorkspace({ outcomeOverride: { prerequisites: [] } });
    await screen.findByText('No prerequisite');
    expect(screen.getByText('This outcome can proceed independently.')).toBeInTheDocument();
  });

  it('renders prerequisite pill and waiting status when unresolved prerequisite present', async () => {
    renderWorkspace({
      outcomeOverride: {
        prerequisites: [
          { id: prereqOutcomeId, title: 'Market Research', resolved: false },
        ],
      },
    });
    await screen.findByText('Market Research');
    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });

  it('shows resolved prerequisite correctly', async () => {
    renderWorkspace({
      outcomeOverride: {
        prerequisites: [
          { id: prereqOutcomeId, title: 'Market Research', resolved: true },
        ],
      },
    });
    await screen.findByText('Market Research');
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('shows participating member context description when joined without custom description', async () => {
    renderWorkspace({ outcomeOverride: { isJoined: true, description: '' } });
    await screen.findByRole('heading', { name: 'Launch MVP' });
    expect(
      screen.getByText('You are participating in this outcome. Its workspace keeps features, tasks, outputs, and history together.'),
    ).toBeInTheDocument();
  });

  it('shows observer context description when not joined and no custom description', async () => {
    renderWorkspace({ outcomeOverride: { isJoined: false, description: '' } });
    await screen.findByRole('heading', { name: 'Launch MVP' });
    expect(
      screen.getByText('You can inspect this outcome workspace. Join it if you want to contribute to its features and tasks.'),
    ).toBeInTheDocument();
  });

  it('shows supervisor context description when isLead and no custom description', async () => {
    renderWorkspace({
      isLead: true,
      outcomeOverride: { isJoined: true, description: '' },
    });
    await screen.findByRole('heading', { name: 'Launch MVP' });
    expect(
      screen.getByText('You are supervising this outcome. Review the combined work and all team submissions before making the final outcome decision.'),
    ).toBeInTheDocument();
  });

  it('shows "First submission" label in the working submission banner', async () => {
    renderWorkspace();
    await screen.findByText('Working submission');
    expect(screen.getByText('First submission')).toBeInTheDocument();
  });

  it('shows "Version N" label when a prior submission exists', async () => {
    renderWorkspace({
      deliveryData: {
        ...emptyDeliveryData,
        submissions: [
          {
            id: 'sub-1',
            content: 'v1 output',
            note: '',
            reviewStatus: 'FOR_REVIEW' as const,
            submitter: { id: 'u1', fullName: 'Alice' },
            reviews: [],
            createdAt: '2026-09-18T00:00:00.000Z',
            updatedAt: '2026-09-18T00:00:00.000Z',
          },
        ],
      },
    });
    await screen.findByText('Working submission');
    expect(screen.getByText('Version 2')).toBeInTheDocument();
  });

  it('shows work progress at 0% in context rail for empty outcome', async () => {
    renderWorkspace();
    await waitFor(() => {
      const progressbar = screen.getByRole('progressbar', { name: 'Work progress' });
      expect(progressbar).toHaveAttribute('aria-valuenow', '0');
    });
  });

  it('shows fallback activity text when no real activity records exist', async () => {
    renderWorkspace({ deliveryData: { ...emptyDeliveryData, activity: [] } });
    await screen.findByText('Outcome workspace prepared.');
  });

  it('does not render Edit Outcome button and only shows Delete Outcome for Project Lead', async () => {
    renderWorkspace({ isLead: true });
    await screen.findByRole('heading', { name: 'Launch MVP' });

    expect(screen.queryByRole('button', { name: /edit outcome/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Outcome' })).toBeInTheDocument();
  });

  it('does not show Delete Outcome or Edit Outcome for non-lead contributor', async () => {
    renderWorkspace({ isLead: false });
    await screen.findByRole('heading', { name: 'Launch MVP' });

    expect(screen.queryByRole('button', { name: /edit outcome/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Outcome' })).not.toBeInTheDocument();
  });

  it('renders contributor delivery form with Save draft and Submit for review, and does not have bottom activity list', async () => {
    renderWorkspace({ isLead: false, outcomeOverride: { isJoined: true } });
    await screen.findByText('Working submission');

    expect(screen.getByRole('heading', { name: 'My Outputs & Feedback' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeInTheDocument();

    // The bottom delivery panel should not have "No activity yet." or "View all activity"
    expect(screen.queryByRole('button', { name: 'View all activity' })).not.toBeInTheDocument();
  });

  it('allows saving draft and displays Draft saved status', async () => {
    renderWorkspace({ isLead: false, outcomeOverride: { isJoined: true } });
    await screen.findByText('Working submission');

    const contentInput = screen.getByLabelText('Output content');
    fireEvent.change(contentInput, { target: { value: 'https://github.com/test/pr/1' } });

    const saveDraftBtn = screen.getByRole('button', { name: 'Save draft' });
    fireEvent.click(saveDraftBtn);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/projects/${projectId}/outcomes/${outcomeId}/delivery/draft`,
        expect.anything(),
        expect.objectContaining({
          method: 'PUT',
          body: expect.objectContaining({
            content: 'https://github.com/test/pr/1',
          }),
        }),
      );
    });

    await screen.findByText('Draft saved');
  });

  it('renders non-member view with read-only banner, join button, and hides contributor submission fields', async () => {
    renderWorkspace({ isLead: false, outcomeOverride: { isJoined: false } });
    await screen.findByRole('heading', { name: 'Launch MVP' });

    // Read-only banner is present
    expect(
      screen.getByText('You can inspect this outcome. Join it to contribute features, tasks, and output submissions.'),
    ).toBeInTheDocument();

    // Join button is present
    expect(screen.getByRole('button', { name: '+ Join outcome' })).toBeInTheDocument();

    // Work Plan title is Team Work Plan
    await screen.findByRole('heading', { name: 'Team Work Plan' });

    // Contributor Working submission and inputs are hidden
    expect(screen.queryByText('Working submission')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Output content')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).not.toBeInTheDocument();

    // Team submissions section is still visible
    expect(screen.getByRole('heading', { name: 'Submitted Outputs' })).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Team submissions' });
  });

  it('renders structured skeleton for Work Plan while loading', async () => {
    let resolveWork: (value: unknown) => void = () => {};
    const workPromise = new Promise((resolve) => {
      resolveWork = resolve;
    });
    renderWorkspace({ workPromise });

    const skeleton = await screen.findByLabelText('Loading Outcome work');
    expect(skeleton).toHaveClass('outcome-skeleton-card');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');

    resolveWork(emptyWorkData);
  });

  it('renders structured skeleton for Delivery Panel while loading', async () => {
    let resolveDelivery: (value: unknown) => void = () => {};
    const deliveryPromise = new Promise((resolve) => {
      resolveDelivery = resolve;
    });
    renderWorkspace({ deliveryPromise });

    const skeleton = await screen.findByLabelText('Loading submissions');
    expect(skeleton).toHaveClass('outcome-skeleton-card');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');

    resolveDelivery(emptyDeliveryData);
  });

  it('renders status badge and Delete Outcome stacked in pw-workspace-state-actions for Project Lead', async () => {
    renderWorkspace({ isLead: true });
    await screen.findByRole('heading', { name: 'Launch MVP' });

    const deleteBtn = screen.getByRole('button', { name: 'Delete Outcome' });
    const stateActionsContainer = deleteBtn.closest('.pw-workspace-state-actions');
    expect(stateActionsContainer).not.toBeNull();

    // The container should hold both the status badge and the delete button
    expect(stateActionsContainer?.querySelector('.workflow-state')).not.toBeNull();
    expect(stateActionsContainer?.contains(deleteBtn)).toBe(true);
  });
});

