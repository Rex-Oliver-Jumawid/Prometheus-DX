import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectWorkflowResponse } from '../../../shared/contracts/project-workflow';
import { apiFetch } from '../../lib/api';
import { ProjectWorkflow } from './ProjectWorkflow';

const projectId = '11111111-1111-4111-8111-111111111111';
const stageId = '22222222-2222-4222-8222-222222222222';
const outcomeId = '33333333-3333-4333-8333-333333333333';

const workflowFixture: ProjectWorkflowResponse = {
  projectId,
  canManageStructure: true,
  stages: [
    {
      id: stageId,
      projectId,
      name: 'Discovery',
      description: 'Initial stage',
      position: 0,
      outcomes: [
        {
          id: outcomeId,
          stageId,
          title: 'User Interviews',
          description: 'Conduct user research',
          position: 0,
          lifecycleStatus: 'OPEN',
          isJoined: false,
          isLocked: false,
          hasForReview: false,
          departments: [
            {
              id: '44444444-4444-4444-8444-444444444444',
              name: 'Design',
              shortLabel: 'Design',
            },
          ],
          acceptanceCriteria: [],
          prerequisites: [],
          members: [],
          createdAt: '2026-09-18T00:00:00.000Z',
          updatedAt: '2026-09-18T00:00:00.000Z',
        },
      ],
      createdAt: '2026-09-18T00:00:00.000Z',
      updatedAt: '2026-09-18T00:00:00.000Z',
    },
  ],
};

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));

function renderWorkflow(selectedOutcomeId?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/projects/${projectId}`]}>
        <ProjectWorkflow
          projectId={projectId}
          outcomeId={selectedOutcomeId}
          isLead={true}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('ProjectWorkflow Stage & Outcome Deletion', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === `/projects/${projectId}/workflow`) {
        return Promise.resolve(workflowFixture);
      }
      return Promise.resolve({ success: true });
    });
  });

  it('renders the Figma project stage board controls and compact stage header', async () => {
    renderWorkflow();

    expect(await screen.findByText('STAGE 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Discovery' })).toBeInTheDocument();
    expect(screen.getByText('1 outcome')).toBeInTheDocument();
    expect(screen.queryByText('Initial stage')).not.toBeInTheDocument();

    const editStage = screen.getByRole('button', {
      name: 'Edit Stage Discovery',
    });
    const deleteStage = screen.getByRole('button', {
      name: 'Delete Stage Discovery',
    });
    expect(editStage.querySelector('svg')).not.toBeNull();
    expect(deleteStage.querySelector('svg')).not.toBeNull();

    expect(screen.getByRole('button', { name: '+ Outcome' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '+ Stage' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: '+ Add Outcome' }),
    ).toHaveTextContent('+ Add outcome to stage');
  });

  it('shows complete dependency outcome names without edit or delete controls', async () => {
    const prerequisiteTitle =
      'Validated client requirements and complete business rules package';
    const dependentTitle =
      'Implementation plan for the complete approved experience';

    const dependencyWorkflow: ProjectWorkflowResponse = {
      ...workflowFixture,
      stages: [
        {
          ...workflowFixture.stages[0],
          outcomes: [
            {
              ...workflowFixture.stages[0].outcomes[0],
              title: prerequisiteTitle,
            },
            {
              ...workflowFixture.stages[0].outcomes[0],
              id: '55555555-5555-4555-8555-555555555555',
              title: dependentTitle,
              position: 1,
              prerequisites: [
                {
                  id: outcomeId,
                  title: prerequisiteTitle,
                  lifecycleStatus: 'OPEN',
                  resolved: false,
                },
              ],
            },
          ],
        },
      ],
    };

    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === `/projects/${projectId}/workflow`) {
        return Promise.resolve(dependencyWorkflow);
      }
      return Promise.resolve({ success: true });
    });

    renderWorkflow();

    expect(
      await screen.findByRole('link', { name: prerequisiteTitle }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: dependentTitle }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: `Edit Outcome ${prerequisiteTitle}` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Delete Outcome ${prerequisiteTitle}` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Edit Outcome ${dependentTitle}` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Delete Outcome ${dependentTitle}` }),
    ).not.toBeInTheDocument();
  });

  it('treats accepted prerequisites as resolved and hides redundant dependency actions', async () => {
    const acceptedPrerequisiteTitle = 'Accepted prerequisite outcome';
    const dependentTitle = 'Dependent outcome';

    const dependencyWorkflow: ProjectWorkflowResponse = {
      ...workflowFixture,
      stages: [
        {
          ...workflowFixture.stages[0],
          outcomes: [
            {
              ...workflowFixture.stages[0].outcomes[0],
              title: acceptedPrerequisiteTitle,
              lifecycleStatus: 'ACCEPTED',
            },
            {
              ...workflowFixture.stages[0].outcomes[0],
              id: '99999999-9999-4999-8999-999999999999',
              title: dependentTitle,
              position: 1,
              prerequisites: [
                {
                  id: outcomeId,
                  title: acceptedPrerequisiteTitle,
                  lifecycleStatus: 'ACCEPTED',
                  resolved: true,
                  resolution: 'ACCEPTED',
                },
              ],
            },
          ],
        },
      ],
    };

    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === `/projects/${projectId}/workflow`) {
        return Promise.resolve(dependencyWorkflow);
      }
      return Promise.resolve({ success: true });
    });

    renderWorkflow();

    const prerequisiteCard = await screen.findByRole('link', {
      name: acceptedPrerequisiteTitle,
    });
    expect(prerequisiteCard).toHaveClass('dep-mini');
    expect(screen.getByText('RESOLVED')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Verify prerequisite' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Skip dependency' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('NEXT OUTCOME')).toBeInTheDocument();
    expect(screen.getByText(/Accepted$/)).toBeInTheDocument();
    expect(screen.queryByText('Prerequisite complete')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Continue to next outcome →' }),
    ).not.toBeInTheDocument();
  });

  it('renders an overridden dependency as skipped instead of accepted', async () => {
    const prerequisiteTitle = 'Optional research spike';
    const dependentTitle = 'Production rollout';

    const dependencyWorkflow: ProjectWorkflowResponse = {
      ...workflowFixture,
      stages: [
        {
          ...workflowFixture.stages[0],
          outcomes: [
            {
              ...workflowFixture.stages[0].outcomes[0],
              title: prerequisiteTitle,
              lifecycleStatus: 'OPEN',
            },
            {
              ...workflowFixture.stages[0].outcomes[0],
              id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              title: dependentTitle,
              position: 1,
              prerequisites: [
                {
                  id: outcomeId,
                  dependencyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                  title: prerequisiteTitle,
                  lifecycleStatus: 'OPEN',
                  resolved: true,
                  resolution: 'OVERRIDDEN',
                },
              ],
            },
          ],
        },
      ],
    };

    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === `/projects/${projectId}/workflow`) {
        return Promise.resolve(dependencyWorkflow);
      }
      return Promise.resolve({ success: true });
    });

    renderWorkflow();

    expect(await screen.findByText('SKIPPED')).toBeInTheDocument();
    expect(screen.queryByText('RESOLVED')).not.toBeInTheDocument();
    expect(screen.getByText(/Skipped by Project editor/)).toBeInTheDocument();

    const prerequisiteCard = screen.getByRole('link', {
      name: prerequisiteTitle,
    });
    expect(prerequisiteCard).toHaveClass('skipped');

    expect(screen.getByText('NEXT OUTCOME')).toBeInTheDocument();
    expect(screen.queryByText('Prerequisite complete')).not.toBeInTheDocument();
  });

  it('opens the dependency override modal directly from the board', async () => {
    const dependencyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const prerequisiteTitle = 'Prototype approved';
    const dependentTitle = 'Production rollout';

    const dependencyWorkflow: ProjectWorkflowResponse = {
      ...workflowFixture,
      stages: [
        {
          ...workflowFixture.stages[0],
          outcomes: [
            {
              ...workflowFixture.stages[0].outcomes[0],
              title: prerequisiteTitle,
            },
            {
              ...workflowFixture.stages[0].outcomes[0],
              id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              title: dependentTitle,
              position: 1,
              isLocked: true,
              prerequisites: [
                {
                  id: outcomeId,
                  dependencyId,
                  title: prerequisiteTitle,
                  lifecycleStatus: 'OPEN',
                  resolved: false,
                },
              ],
            },
          ],
        },
      ],
    };

    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === `/projects/${projectId}/workflow`) {
        return Promise.resolve(dependencyWorkflow);
      }
      return Promise.resolve({ success: true });
    });

    renderWorkflow();

    const skip = await screen.findByRole('button', {
      name: 'Skip dependency',
    });
    fireEvent.click(skip);

    const dialog = screen.getByRole('dialog', { name: 'Skip dependency' });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByText('Bypass this prerequisite only'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(prerequisiteTitle)).toBeInTheDocument();
    expect(within(dialog).getByText(dependentTitle)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Confirm skip dependency' }),
    ).toBeInTheDocument();
  });

  it('renders X delete controls on manageable stages and outcomes', async () => {
    renderWorkflow();

    expect(
      await screen.findByRole('button', { name: 'Delete Stage Discovery' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Outcome User Interviews' }),
    ).toBeInTheDocument();
  });

  it('opens confirmation dialog on clicking stage X and cancels cleanly', async () => {
    renderWorkflow();

    const deleteStageBtn = await screen.findByRole('button', {
      name: 'Delete Stage Discovery',
    });
    fireEvent.click(deleteStageBtn);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Delete Stage' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete stage/i),
    ).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('opens confirmation dialog on clicking outcome X and executes deletion', async () => {
    renderWorkflow();

    const deleteOutcomeBtn = await screen.findByRole('button', {
      name: 'Delete Outcome User Interviews',
    });
    fireEvent.click(deleteOutcomeBtn);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Delete Outcome' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete outcome/i),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Delete Outcome' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/projects/${projectId}/outcomes/${outcomeId}`,
        expect.anything(),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('renders the redesigned outcome workspace layout with header, navigation, and context rail', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === `/projects/${projectId}/workflow`) {
        return Promise.resolve(workflowFixture);
      }
      if (path === `/projects/${projectId}/outcomes/${outcomeId}/work`) {
        return Promise.resolve({
          features: [],
          completedTasks: 0,
          totalTasks: 0,
          progress: 0,
          canPlan: true,
          canExecute: true,
        });
      }
      if (path === `/projects/${projectId}/outcomes/${outcomeId}/delivery`) {
        return Promise.resolve({
          submissions: [],
          revisions: [],
          acceptances: [],
          dependencies: [],
          activity: [],
          canSubmit: true,
          isLead: true,
          canManageDelivery: true,
          hasForReview: false,
          lifecycleStatus: 'OPEN',
          outcomeUpdatedAt: '2026-09-18T00:00:00.000Z',
        });
      }
      if (path === '/projects/create-options') {
        return Promise.resolve({ leads: [], departments: [] });
      }
      return Promise.resolve({ success: true });
    });

    renderWorkflow(outcomeId);

    // Navigation row
    expect(
      await screen.findByRole('link', { name: /back to project workspace/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Back to Content')).toBeInTheDocument();
    const outcomeDetails = screen.getByRole('button', {
      name: 'Outcome Details',
    });
    expect(outcomeDetails).toBeInTheDocument();
    expect(screen.queryByText('Outcome workspace')).not.toBeInTheDocument();

    fireEvent.click(outcomeDetails);
    expect(
      await screen.findByRole('heading', { name: 'Edit project outcome' }),
    ).toBeInTheDocument();

    // Outcome Header Card
    expect(
      screen.getByRole('heading', { name: 'User Interviews' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Expected outcome')).toBeInTheDocument();
    expect(
      screen.getByText('Acceptance criteria', { selector: '.acceptance-label' }),
    ).toBeInTheDocument();

    // Context Rail
    expect(screen.getByText('Outcome Status')).toBeInTheDocument();
    expect(screen.getByText('Ownership')).toBeInTheDocument();
    expect(screen.getByText('Prerequisite')).toBeInTheDocument();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('does not duplicate resolved dependency status in the main delivery panel', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === `/projects/${projectId}/workflow`) {
        return Promise.resolve(workflowFixture);
      }
      if (path === `/projects/${projectId}/outcomes/${outcomeId}/work`) {
        return Promise.resolve({
          features: [],
          completedTasks: 0,
          totalTasks: 0,
          progress: 0,
          canPlan: false,
          canExecute: false,
        });
      }
      if (path === `/projects/${projectId}/outcomes/${outcomeId}/delivery`) {
        return Promise.resolve({
          submissions: [],
          revisions: [],
          acceptances: [],
          dependencies: [
            {
              id: '55555555-5555-4555-8555-555555555555',
              prerequisiteId: '66666666-6666-4666-8666-666666666666',
              title: 'Working Prototype',
              resolved: true,
              overrideReason: null,
            },
          ],
          activity: [],
          canSubmit: false,
          isLead: true,
          canManageDelivery: true,
          hasForReview: false,
          lifecycleStatus: 'OPEN',
          outcomeUpdatedAt: '2026-09-18T00:00:00.000Z',
        });
      }
      return Promise.resolve({ success: true });
    });

    renderWorkflow(outcomeId);

    await screen.findByText('Outcome Submissions');
    expect(
      screen.queryByRole('region', { name: 'Dependency actions' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Dependency action required'),
    ).not.toBeInTheDocument();
  });

  it('shows a compact action area only for unresolved lead dependencies', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === `/projects/${projectId}/workflow`) {
        return Promise.resolve(workflowFixture);
      }
      if (path === `/projects/${projectId}/outcomes/${outcomeId}/work`) {
        return Promise.resolve({
          features: [],
          completedTasks: 0,
          totalTasks: 0,
          progress: 0,
          canPlan: true,
          canExecute: false,
        });
      }
      if (path === `/projects/${projectId}/outcomes/${outcomeId}/delivery`) {
        return Promise.resolve({
          submissions: [],
          revisions: [],
          acceptances: [],
          dependencies: [
            {
              id: '77777777-7777-4777-8777-777777777777',
              prerequisiteId: '88888888-8888-4888-8888-888888888888',
              title: 'Working Prototype',
              resolved: false,
              overrideReason: null,
            },
          ],
          activity: [],
          canSubmit: false,
          isLead: true,
          canManageDelivery: true,
          hasForReview: false,
          lifecycleStatus: 'OPEN',
          outcomeUpdatedAt: '2026-09-18T00:00:00.000Z',
        });
      }
      return Promise.resolve({ success: true });
    });

    renderWorkflow(outcomeId);

    expect(
      await screen.findByRole('region', { name: 'Dependency actions' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Dependency action required')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Skip dependency' }),
    ).toBeInTheDocument();
  });
});
