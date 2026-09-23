import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ProjectActivityPageSchema, type ProjectActivity } from '../../../shared/contracts/project-activity';
import { apiFetch } from '../../lib/api';
import './project-collaboration.css';

const descriptions: Record<string, string> = {
  PROJECT_CREATED: 'created the project',
  PROJECT_STATUS_CHANGED: 'changed the project status',
  PROJECT_LEAD_CHANGED: 'changed the project lead',
  PROJECT_MEMBER_ACCESS_CHANGED: 'updated project member access',
  PROJECT_ARCHIVED: 'archived the project',
  STAGE_CREATED: 'created a stage',
  STAGE_UPDATED: 'updated a stage',
  OUTCOME_CREATED: 'created an outcome',
  OUTCOME_UPDATED: 'updated an outcome',
  OUTCOME_JOINED: 'joined an outcome',
  OUTCOME_ACCEPTED: 'accepted an outcome',
  OUTCOME_REOPENED: 'reopened an outcome',
  OUTCOME_DEPENDENCY_OVERRIDDEN: 'skipped an outcome dependency',
  FEATURE_CREATED: 'created a feature',
  FEATURE_UPDATED: 'updated a feature',
  FEATURE_DELETED: 'deleted a feature',
  TASK_CREATED: 'created a task',
  TASK_UPDATED: 'updated a task',
  TASK_COMPLETED: 'completed a task',
  TASK_REOPENED: 'reopened a task',
  TASK_DELETED: 'deleted a task',
  SUBMISSION_CREATED: 'submitted output for review',
  SUBMISSION_REVIEWED: 'reviewed a submission',
  REVISION_REQUESTED: 'requested revisions',
  REVISION_RESOLVED: 'resolved revisions',
};

function eventDescription(action: string) {
  return descriptions[action] ?? action.toLowerCase().replaceAll('_', ' ');
}

function eventTitle(item: ProjectActivity) {
  const meta =
    item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};
  return typeof meta.title === 'string' ? meta.title : null;
}

function eventTime(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ProjectActivityPanel({
  projectId,
  accessToken,
}: {
  projectId: string;
  accessToken?: string;
}) {
  const feed = useInfiniteQuery({
    queryKey: ['projects', projectId, 'activity'],
    queryFn: ({ pageParam }) =>
      apiFetch(
        '/projects/' + projectId + '/activity' +
          (pageParam ? '?cursor=' + encodeURIComponent(pageParam) : ''),
        ProjectActivityPageSchema,
        { accessToken },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(accessToken),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="pw-collaboration-panel" aria-label="Project activity">
      <header className="pw-collaboration-heading">
        <div>
          <span className="pw-collaboration-eyebrow">PROJECT TIMELINE</span>
          <h2>Project activity</h2>
          <p>Updates from your team's project and outcome work.</p>
        </div>
        <button
          type="button"
          className="projects-secondary-button"
          onClick={() => void feed.refetch()}
          disabled={feed.isFetching}
        >
          {feed.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {feed.isPending ? (
        <p className="pw-collaboration-state" role="status">Loading project activity…</p>
      ) : feed.isError && items.length === 0 ? (
        <div className="pw-collaboration-state" role="alert">
          <strong>Project activity could not be loaded.</strong>
          <p>{feed.error instanceof Error ? feed.error.message : 'Please try again.'}</p>
          <button type="button" onClick={() => void feed.refetch()}>Retry</button>
        </div>
      ) : items.length === 0 ? (
        <p className="pw-collaboration-state">No project activity has been recorded yet.</p>
      ) : (
        <>
          <ol className="pw-activity-timeline">
            {items.map((item) => (
              <li className="pw-activity-entry" key={item.id}>
                <span className="pw-activity-node" aria-hidden="true" />
                <div className="pw-activity-entry-body">
                  <p>
                    <strong>{item.actor?.fullName ?? 'System'}</strong>{' '}
                    {eventDescription(item.action)}
                    {eventTitle(item) && (
                      <span className="pw-activity-subject"> — {eventTitle(item)}</span>
                    )}
                  </p>
                  <div className="pw-activity-entry-meta">
                    <time dateTime={item.createdAt}>{eventTime(item.createdAt)}</time>
                    {item.outcomeId && (
                      <Link to={'/projects/' + projectId + '/outcomes/' + item.outcomeId}>
                        View outcome
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {feed.isError && (
            <p className="pw-collaboration-warning" role="alert">
              Newer activity could not be refreshed. Showing previously loaded events.
            </p>
          )}
          {feed.hasNextPage && (
            <button
              type="button"
              className="pw-collaboration-load-more"
              onClick={() => void feed.fetchNextPage()}
              disabled={feed.isFetchingNextPage}
            >
              {feed.isFetchingNextPage ? 'Loading…' : 'Load older activity'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
