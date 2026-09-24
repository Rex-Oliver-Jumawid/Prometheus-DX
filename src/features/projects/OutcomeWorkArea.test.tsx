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
    if (path.startsWith(`/projects/${projectId}/outcomes/${outcomeId}/work`)) {
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
    expect(
      await screen.findByText(
        'No features have been defined yet. Start by adding the main pieces of work needed to achieve this outcome.',
      ),
    ).toBeInTheDocument();
  });

  it('shows Add Feature button in empty state when user can plan', async () => {
    renderWorkspace({ workData: { ...emptyWorkData, canPlan: true } });
    await screen.findByText(
      /No features have been defined yet\./,
    );
    const addButtons = screen.getAllByRole('button', { name: /add.*feature/i });
    expect(addButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking Add Feature in empty state opens the feature creation form', async () => {
    renderWorkspace({ workData: { ...emptyWorkData, canPlan: true } });
    await screen.findByText(
      /No features have been defined yet\./,
    );
    const addButtons = screen.getAllByRole('button', { name: /add.*feature/i });
    fireEvent.click(addButtons[0]);
    expect(screen.getByRole('textbox', { name: /feature title/i })).toBeInTheDocument();
  });

  it('does not show Add Feature button when user cannot plan', async () => {
    renderWorkspace({
      workData: { ...emptyWorkData, canPlan: false },
      outcomeOverride: { isJoined: false },
    });
    await screen.findByText(
      /No features have been defined yet\./,
    );
    expect(screen.queryAllByRole('button', { name: /add.*feature/i })).toHaveLength(0);
  });

  it('shows the Figma Add another feature action when the feature list is empty', async () => {
    renderWorkspace({ workData: { ...emptyWorkData, canPlan: true } });
    await screen.findByText(
      /No features have been defined yet\./,
    );
    expect(
      screen.getByRole('button', { name: /add another feature/i }),
    ).toBeInTheDocument();
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

  it('renders FeatureComposer with name, description, Cancel, and Add feature buttons and handles submission', async () => {
    renderWorkspace({ workData: { ...emptyWorkData, canPlan: true } });
    await screen.findByText(
      /No features have been defined yet\./,
    );

    const addFeatureBtn = screen.getByRole('button', {
      name: 'Add a feature to this outcome',
    });
    fireEvent.click(addFeatureBtn);

    const nameInput = screen.getByPlaceholderText('Feature name');
    const descInput = screen.getByPlaceholderText('Short description (optional)');
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const submitBtn = screen.getByRole('button', { name: 'Add feature' });

    expect(nameInput).toBeInTheDocument();
    expect(descInput).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();
    expect(submitBtn).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Frontend UI' } });
    fireEvent.change(descInput, { target: { value: 'Complete components' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/projects/${projectId}/outcomes/${outcomeId}/work/features`,
        expect.anything(),
        expect.objectContaining({
          method: 'POST',
          body: {
            title: 'Frontend UI',
            description: 'Complete components',
          },
        }),
      );
    });
  });

  it('renders inline Add Task in feature card and handles submission', async () => {
    const workWithFeatures = {
      ...emptyWorkData,
      canPlan: true,
      canExecute: true,
      features: [
        {
          id: 'feat-10',
          title: 'Database Layer',
          description: '',
          status: 'TODO' as const,
          tasks: [],
          createdAt: '2026-09-18T00:00:00.000Z',
          updatedAt: '2026-09-18T00:00:00.000Z',
        },
      ],
    };
    renderWorkspace({ workData: workWithFeatures });
    await screen.findByText('Database Layer');

    const taskInput = screen.getByPlaceholderText('Add a task...');
    const addTaskBtn = screen.getByRole('button', { name: 'Add task' });

    expect(taskInput).toBeInTheDocument();
    expect(addTaskBtn).toBeInTheDocument();
    expect(addTaskBtn).toBeDisabled();

    fireEvent.change(taskInput, { target: { value: 'Write migrations' } });
    expect(addTaskBtn).not.toBeDisabled();

    fireEvent.click(addTaskBtn);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/projects/${projectId}/outcomes/${outcomeId}/work/features/feat-10/tasks`,
        expect.anything(),
        expect.objectContaining({
          method: 'POST',
          body: {
            title: 'Write migrations',
          },
        }),
      );
    });
  });

  it('keeps a zero-task feature informative after acceptance without exposing Add task', async () => {
    const acceptedWork = {
      ...emptyWorkData,
      canPlan: false,
      canExecute: false,
      features: [
        {
          id: 'feat-accepted-empty',
          title: 'Accepted Empty Feature',
          description: 'Locked after acceptance',
          status: 'TODO' as const,
          tasks: [],
          createdAt: '2026-09-18T00:00:00.000Z',
          updatedAt: '2026-09-18T00:00:00.000Z',
        },
      ],
    };

    renderWorkspace({ workData: acceptedWork });

    await screen.findByText('Accepted Empty Feature');
    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    expect(
      screen.getByText('No tasks were added before this outcome was accepted.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Add a task to Accepted Empty Feature'),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Collapse Accepted Empty Feature' }),
    );
    expect(screen.queryByText('No tasks yet')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Accepted Empty Feature' }),
    );
    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
  });

  it('renders FeatureComposer at the bottom when adding another feature', async () => {
    const workWithFeatures = {
      ...emptyWorkData,
      canPlan: true,
      canExecute: true,
      features: [
        {
          id: 'feat-1',
          title: 'Existing Feature',
          description: '',
          status: 'TODO' as const,
          tasks: [],
          createdAt: '2026-09-18T00:00:00.000Z',
          updatedAt: '2026-09-18T00:00:00.000Z',
        },
      ],
    };
    renderWorkspace({ workData: workWithFeatures });
    await screen.findByText('Existing Feature');

    const addAnotherBtn = screen.getByRole('button', { name: '＋ Add another feature' });
    fireEvent.click(addAnotherBtn);

    const nameInput = screen.getByPlaceholderText('Feature name');
    expect(nameInput).toBeInTheDocument();
    // Verify it is positioned after the existing feature card
    const featureCard = screen.getByText('Existing Feature').closest('article');
    const form = nameInput.closest('form');
    expect(featureCard).not.toBeNull();
    expect(form).not.toBeNull();
    expect(
      Boolean(
        featureCard!.compareDocumentPosition(form!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it('renders an empty task state and FeatureComposer on Edit feature', async () => {
    const workWithFeatures = {
      ...emptyWorkData,
      canPlan: true,
      canExecute: true,
      features: [
        {
          id: 'feat-1',
          title: 'Make a Prototype',
          description: 'do a prototype',
          status: 'TODO' as const,
          tasks: [],
          createdAt: '2026-09-18T00:00:00.000Z',
          updatedAt: '2026-09-18T00:00:00.000Z',
        },
      ],
    };
    renderWorkspace({ workData: workWithFeatures });
    await screen.findByText('Make a Prototype');

    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    expect(
      screen.getByText('Add the first task for this feature below.'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Add a task to Make a Prototype'),
    ).toBeInTheDocument();

    const editBtn = screen.getByRole('button', { name: 'Edit feature' });
    fireEvent.click(editBtn);

    // Should render FeatureComposer prefilled
    const nameInput = screen.getByDisplayValue('Make a Prototype');
    const descInput = screen.getByDisplayValue('do a prototype');
    const saveBtn = screen.getByRole('button', { name: 'Save feature' });

    expect(nameInput).toBeInTheDocument();
    expect(descInput).toBeInTheDocument();
    expect(saveBtn).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Make a Prototype v2' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/projects/${projectId}/outcomes/${outcomeId}/work/features/feat-1`,
        expect.anything(),
        expect.objectContaining({
          method: 'PATCH',
          body: expect.objectContaining({
            title: 'Make a Prototype v2',
          }),
        }),
      );
    });
  });

  it('optimistically updates task checkbox, status badge, and context rail immediately on check', async () => {
    let resolveTaskUpdate: (val: unknown) => void = () => {};
    const taskUpdatePromise = new Promise((resolve) => {
      resolveTaskUpdate = resolve;
    });

    const workWithTasks = {
      ...emptyWorkData,
      canPlan: true,
      canExecute: true,
      completedTasks: 0,
      totalTasks: 2,
      progress: 0,
      features: [
        {
          id: 'feat-1',
          title: 'Make a Prototype',
          description: 'do a prototype',
          status: 'TODO' as const,
          createdAt: '2026-09-18T00:00:00.000Z',
          updatedAt: '2026-09-18T00:00:00.000Z',
          tasks: [
            {
              id: 'task-1',
              title: 'First Task',
              description: '',
              position: 0,
              status: 'TODO' as const,
              completedAt: null,
              createdAt: '2026-09-18T00:00:00.000Z',
              updatedAt: '2026-09-18T00:00:00.000Z',
            },
            {
              id: 'task-2',
              title: 'Second Task',
              description: '',
              position: 1,
              status: 'TODO' as const,
              completedAt: null,
              createdAt: '2026-09-18T00:00:00.000Z',
              updatedAt: '2026-09-18T00:00:00.000Z',
            },
          ],
        },
      ],
    };

    renderWorkspace({ workData: workWithTasks });
    await screen.findByText('First Task');

    // Initially 0 / 2 tasks and 0%
    expect(screen.getByText('0/2 tasks')).toBeInTheDocument();
    expect(screen.getByText('0 / 2')).toBeInTheDocument();
    expect(screen.getAllByText('0%').length).toBeGreaterThanOrEqual(1);

    const checkbox = screen.getByRole('checkbox', { name: 'Complete First Task' });
    expect(checkbox).not.toBeChecked();

    // Mock API to hang on state change to simulate network delay
    vi.mocked(apiFetch).mockImplementation((path: string, _schema: unknown, opts: unknown) => {
      const options = opts as { method?: string } | undefined;
      if (path.includes('/tasks/task-1/state') && options?.method === 'PATCH') {
        return taskUpdatePromise;
      }
      if (path.startsWith(`/projects/${projectId}/outcomes/${outcomeId}/work`)) {
        return Promise.resolve(workWithTasks);
      }
      return Promise.resolve({ success: true });
    });

    // Click checkbox
    fireEvent.click(checkbox);

    // Immediately and optimistically checked without waiting for taskUpdatePromise to resolve
    await waitFor(() => {
      expect(checkbox).toBeChecked();
      expect(screen.getByText('1/2 tasks')).toBeInTheDocument();
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
      expect(screen.getAllByText('50%').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    // Now resolve the promise
    resolveTaskUpdate({
      ...workWithTasks,
      completedTasks: 1,
      progress: 50,
      features: [
        {
          ...workWithTasks.features[0],
          tasks: [
            {
              ...workWithTasks.features[0].tasks[0],
              status: 'DONE',
              completedAt: '2026-09-18T00:01:00.000Z',
            },
            workWithTasks.features[0].tasks[1],
          ],
        },
      ],
    });

    await waitFor(() => {
      expect(checkbox).toBeChecked();
    });
  });

  it('rolls back task status and progress if state update fails', async () => {
    let rejectTaskUpdate: (err: Error) => void = () => {};
    const taskUpdatePromise = new Promise((_, reject) => {
      rejectTaskUpdate = reject;
    });

    const workWithTasks = {
      ...emptyWorkData,
      canPlan: true,
      canExecute: true,
      completedTasks: 0,
      totalTasks: 2,
      progress: 0,
      features: [
        {
          id: 'feat-1',
          title: 'Make a Prototype',
          description: 'do a prototype',
          status: 'TODO' as const,
          createdAt: '2026-09-18T00:00:00.000Z',
          updatedAt: '2026-09-18T00:00:00.000Z',
          tasks: [
            {
              id: 'task-1',
              title: 'First Task',
              description: '',
              position: 0,
              status: 'TODO' as const,
              completedAt: null,
              createdAt: '2026-09-18T00:00:00.000Z',
              updatedAt: '2026-09-18T00:00:00.000Z',
            },
            {
              id: 'task-2',
              title: 'Second Task',
              description: '',
              position: 1,
              status: 'TODO' as const,
              completedAt: null,
              createdAt: '2026-09-18T00:00:00.000Z',
              updatedAt: '2026-09-18T00:00:00.000Z',
            },
          ],
        },
      ],
    };

    renderWorkspace({ workData: workWithTasks });
    await screen.findByText('First Task');

    const checkbox = screen.getByRole('checkbox', { name: 'Complete First Task' });
    expect(checkbox).not.toBeChecked();

    vi.mocked(apiFetch).mockImplementation((path: string, _schema: unknown, opts: unknown) => {
      const options = opts as { method?: string } | undefined;
      if (path.includes('/tasks/task-1/state') && options?.method === 'PATCH') {
        return taskUpdatePromise;
      }
      if (path.startsWith(`/projects/${projectId}/outcomes/${outcomeId}/work`)) {
        return Promise.resolve(workWithTasks);
      }
      return Promise.resolve({ success: true });
    });

    fireEvent.click(checkbox);

    // Optimistically checked
    await waitFor(() => {
      expect(checkbox).toBeChecked();
    });

    // Reject the mutation
    rejectTaskUpdate(new Error('Network failure'));

    // Rolls back
    await waitFor(() => {
      expect(checkbox).not.toBeChecked();
      expect(screen.getByText('0/2 tasks')).toBeInTheDocument();
      expect(screen.getByText('0 / 2')).toBeInTheDocument();
    });
  });
});
