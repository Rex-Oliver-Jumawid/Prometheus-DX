import { useState } from 'react';
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
  STAGE_DELETED: 'deleted a stage',
  OUTCOME_CREATED: 'created an outcome',
  OUTCOME_UPDATED: 'updated an outcome',
  OUTCOME_DELETED: 'deleted an outcome',
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
  PROJECT_ANNOUNCEMENT_POSTED: 'Posted announcement',
  PROJECT_ANNOUNCEMENT_PINNED: 'Pinned announcement',
  PROJECT_ANNOUNCEMENT_UNPINNED: 'Unpinned announcement',
};

function eventDescription(action: string) {
  return descriptions[action] ?? action.toLowerCase().replaceAll('_', ' ');
}

function eventTitle(item: ProjectActivity) {
  const meta =
    item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};
  if (typeof meta.title === 'string') return meta.title;
  if (
    item.action === 'PROJECT_STATUS_CHANGED' &&
    typeof meta.fromStatus === 'string' &&
    typeof meta.toStatus === 'string'
  ) return meta.fromStatus + ' → ' + meta.toStatus;
  if (
    item.action === 'PROJECT_MEMBER_ACCESS_CHANGED' &&
    typeof meta.previousAccess === 'string' &&
    typeof meta.newAccess === 'string'
  ) return meta.previousAccess + ' → ' + meta.newAccess;
  return null;
}

type ActivityFilter =
  | 'All'
  | 'Reviews'
  | 'Accepted'
  | 'Needs Revision'
  | 'Outputs'
  | 'Tasks'
  | 'Features'
  | 'Membership'
  | 'Project';

const activityFilters: ActivityFilter[] = [
  'All', 'Reviews', 'Accepted', 'Needs Revision',
  'Outputs', 'Tasks', 'Features', 'Membership', 'Project',
];

function matchesFilter(action: string, filter: ActivityFilter) {
  if (filter === 'All') return true;
  if (filter === 'Reviews') return [
    'SUBMISSION_REVIEWED', 'REVISION_REQUESTED', 'REVISION_RESOLVED',
    'OUTCOME_ACCEPTED', 'OUTCOME_REOPENED',
  ].includes(action);
  if (filter === 'Accepted') return action === 'OUTCOME_ACCEPTED';
  if (filter === 'Needs Revision') return action === 'REVISION_REQUESTED';
  if (filter === 'Outputs') return action.startsWith('SUBMISSION_');
  if (filter === 'Tasks') return action.startsWith('TASK_');
  if (filter === 'Features') return action.startsWith('FEATURE_');
  if (filter === 'Membership') return [
    'OUTCOME_JOINED', 'PROJECT_MEMBER_ACCESS_CHANGED',
  ].includes(action);
  return action.startsWith('PROJECT_') || action.startsWith('STAGE_') ||
    action.startsWith('OUTCOME_');
}

function eventCategory(action: string) {
  if (action.startsWith('SUBMISSION_')) return 'Output';
  if (action === 'REVISION_REQUESTED' || action === 'REVISION_RESOLVED') return 'Review';
  if (action === 'OUTCOME_ACCEPTED' || action === 'OUTCOME_REOPENED') return 'Review';
  if (action.startsWith('TASK_')) return 'Task';
  if (action.startsWith('FEATURE_')) return 'Feature';
  if (action.startsWith('PROJECT_ANNOUNCEMENT_')) return 'Announcement';
  if (action === 'OUTCOME_JOINED' || action === 'PROJECT_MEMBER_ACCESS_CHANGED') return 'Membership';
  return 'Project';
}

function eventTime(date: string) {
  const value = new Date(date);
  const now = new Date();
  const time = new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
  if (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  ) {
    return 'Today · ' + time;
  }
  return (
    new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      year: value.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    }).format(value) +
    ' · ' +
    time
  );
}

export function ProjectActivityPanel({
  projectId,
  accessToken,
}: {
  projectId: string;
  accessToken?: string;
}) {
  const [filter, setFilter] = useState<ActivityFilter>('All');
  const [memberId, setMemberId] = useState('all');
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

  const seenIds = new Set<string>();
  const items = (feed.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (item) => !seenIds.has(item.id) && Boolean(seenIds.add(item.id)),
  );
  const actors = [...new Map(
    items.filter((item) => item.actor).map((item) => [item.actor!.id, item.actor!.fullName] as const),
  )].sort((a, b) => a[1].localeCompare(b[1]));
  const visible = items.filter(
    (item) => matchesFilter(item.action, filter) &&
      (memberId === 'all' || item.actor?.id === memberId),
  );

  return (
    <section className="pw-collaboration-panel pw-activity-panel" aria-label="Project activity">
      <header className="pw-collaboration-heading pw-activity-heading">
        <div>
          <span className="pw-collaboration-eyebrow">PROJECT AUDIT TRAIL</span>
          <h2>Project Activity</h2>
          <p>Review project decisions, submissions, revisions, dependencies, and member activity in one history.</p>
        </div>
        <div className="pw-activity-summary" aria-live="polite">
          {feed.isPending ? (
            <div aria-hidden="true">
              <span className="pw-chat-skeleton-line pw-activity-skeleton-count" />
              <span className="pw-chat-skeleton-line pw-activity-skeleton-count-label" />
            </div>
          ) : (
            <>
              <strong>{items.length}{feed.hasNextPage ? '+' : ''}</strong>
              <span>{feed.hasNextPage ? 'loaded events' : 'audit events'}</span>
            </>
          )}
        </div>
      </header>

      <div className="pw-activity-controls">
        <div className="pw-activity-filters" role="group" aria-label="Filter project activity">
          {activityFilters.map((option) => (
            <button
              key={option}
              className={filter === option ? 'pw-activity-filter is-active' : 'pw-activity-filter'}
              type="button"
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <label className="pw-activity-member-filter">
          <span>Member</span>
          <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            <option value="all">All members</option>
            {actors.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
      </div>

      {feed.isPending ? (
        <div className="pw-activity-skeleton" role="status" aria-label="Loading project activity">
          <span className="sr-only">Loading project activity...</span>
          <ol className="pw-activity-timeline" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <li className="pw-activity-skeleton-entry" key={index}>
                <span className="pw-chat-skeleton-line pw-activity-skeleton-icon" />
                <div className="pw-activity-skeleton-copy">
                  <span className="pw-chat-skeleton-line pw-activity-skeleton-label" />
                  <span className="pw-chat-skeleton-line pw-activity-skeleton-title" />
                  <span className="pw-chat-skeleton-line pw-activity-skeleton-detail" />
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : feed.isError && items.length === 0 ? (
        <div className="pw-collaboration-state" role="alert">
          <strong>Project activity could not be loaded.</strong>
          <p>{feed.error instanceof Error ? feed.error.message : 'Please try again.'}</p>
          <button type="button" onClick={() => void feed.refetch()}>Retry</button>
        </div>
      ) : (
        <>
          {visible.length ? (
            <ol className="pw-activity-timeline" aria-label="Project activity timeline">
              {visible.map((item) => (
                <li className="pw-activity-entry" key={item.id}>
                  <span className={'pw-activity-node pw-activity-node-' + eventCategory(item.action).toLowerCase()} aria-hidden="true">
                    {item.action.startsWith('PROJECT_ANNOUNCEMENT_') ? '⚑' :
                      item.action === 'OUTCOME_ACCEPTED' ? '✓' :
                      item.action.startsWith('SUBMISSION_') ? '↗' :
                      item.action === 'REVISION_REQUESTED' ? '!' : '•'}
                  </span>
                  <div className="pw-activity-entry-body">
                    <div className="pw-activity-entry-top">
                      <span>{item.actor?.fullName ?? 'System'} · {eventCategory(item.action)}</span>
                      <time dateTime={item.createdAt}>{eventTime(item.createdAt)}</time>
                    </div>
                    <p><strong>{eventDescription(item.action)}</strong></p>
                    {eventTitle(item) && (
                      <p className="pw-activity-subject">{eventTitle(item)}</p>
                    )}
                    <div className="pw-activity-entry-meta">
                      {item.outcomeId && (
                        <Link
                          to={'/projects/' + projectId + '/outcomes/' + item.outcomeId}
                          aria-label="View outcome"
                        >
                          Open outcome →
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="pw-collaboration-state">
              {items.length
                ? 'No matching activity in the loaded history. Try another filter or load older events.'
                : 'No project activity has been recorded yet.'}
            </p>
          )}
          {feed.isError && items.length > 0 && (
            <p className="pw-collaboration-warning" role="alert">
              Activity could not be refreshed. Showing previously loaded events.
            </p>
          )}
          {feed.hasNextPage && (
            <div className="pw-activity-actions">
              <button
                type="button"
                className="pw-collaboration-load-more"
                onClick={() => void feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
              >
                {feed.isFetchingNextPage ? 'Loading…' : 'Load older activity'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
