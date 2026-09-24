import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../../lib/api';
import { ProjectActivityPanel } from './ProjectActivityPanel';

const projectId = '11111111-1111-4111-8111-111111111111';
const outcomeId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
const actor = { id: '44444444-4444-4444-8444-444444444444', fullName: 'Project Lead' };
const event = {
  id: eventId,
  actor,
  outcomeId,
  entityType: 'Outcome',
  entityId: outcomeId,
  action: 'OUTCOME_CREATED',
  metadata: { title: 'Initial outcome' },
  createdAt: '2026-09-23T03:00:00.000Z',
};

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));

function renderActivity() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProjectActivityPanel projectId={projectId} accessToken="token" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProjectActivityPanel', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it('links to live Outcomes and renders safe status transitions', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      items: [
        event,
        {
          ...event,
          id: '55555555-5555-4555-8555-555555555555',
          outcomeId: null,
          action: 'PROJECT_STATUS_CHANGED',
          metadata: { fromStatus: 'PLANNING', toStatus: 'IN_PROGRESS' },
        },
      ],
      nextCursor: null,
    });
    renderActivity();
    expect(await screen.findByText(/created an outcome/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'View outcome' })).toHaveAttribute(
      'href', '/projects/' + projectId + '/outcomes/' + outcomeId,
    );
    expect(screen.getByText(/PLANNING → IN_PROGRESS/)).toBeVisible();
  });

  it('keeps deleted Outcomes in history without linking to missing records', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      items: [{
        ...event,
        outcomeId: null,
        action: 'OUTCOME_DELETED',
        metadata: { title: 'Initial outcome' },
      }],
      nextCursor: null,
    });
    renderActivity();
    expect(await screen.findByText(/deleted an outcome/)).toBeVisible();
    expect(screen.getByText(/Initial outcome/)).toBeVisible();
    expect(screen.queryByRole('link', { name: 'View outcome' })).not.toBeInTheDocument();
  });

  it('loads older events and does not duplicate overlapping event IDs', async () => {
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (path.endsWith('?cursor=' + eventId))
        return Promise.resolve({
          items: [
            event,
            {
              ...event,
              id: '66666666-6666-4666-8666-666666666666',
              action: 'STAGE_DELETED',
              outcomeId: null,
              metadata: { title: 'Old stage' },
            },
          ],
          nextCursor: null,
        });
      return Promise.resolve({ items: [event], nextCursor: eventId });
    });
    renderActivity();
    fireEvent.click(await screen.findByRole('button', { name: 'Load older activity' }));
    expect(await screen.findByText(/deleted a stage/)).toBeVisible();
    await waitFor(() => expect(screen.getAllByText(/created an outcome/)).toHaveLength(1));
    expect(apiFetch).toHaveBeenCalledWith(
      '/projects/' + projectId + '/activity?cursor=' + eventId,
      expect.anything(),
      expect.anything(),
    );
  });
  it('filters Figma audit categories and members using loaded safe activity', async () => {
    const secondActor = { id: '77777777-7777-4777-8777-777777777777', fullName: 'Design Member' };
    vi.mocked(apiFetch).mockResolvedValue({
      items: [
        event,
        {
          ...event,
          id: '88888888-8888-4888-8888-888888888888',
          actor: secondActor,
          action: 'SUBMISSION_CREATED',
          metadata: {},
        },
        {
          ...event,
          id: '99999999-9999-4999-8999-999999999999',
          actor: secondActor,
          action: 'REVISION_REQUESTED',
          metadata: {},
        },
      ],
      nextCursor: null,
    });

    renderActivity();
    expect(await screen.findByText(/created an outcome/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Outputs' }));
    expect(screen.getByText(/submitted output for review/)).toBeVisible();
    expect(screen.queryByText(/created an outcome/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Needs Revision' }));
    expect(screen.getByText(/requested revisions/)).toBeVisible();
    expect(screen.queryByText(/submitted output for review/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All', exact: true }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Member' }), {
      target: { value: actor.id },
    });
    expect(screen.getByText(/created an outcome/)).toBeVisible();
    expect(screen.queryByText(/requested revisions/)).not.toBeInTheDocument();
  });

});
