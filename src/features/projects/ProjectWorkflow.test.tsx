import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function renderWorkflow() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/projects/${projectId}`]}>
        <ProjectWorkflow projectId={projectId} isLead={true} />
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
});
