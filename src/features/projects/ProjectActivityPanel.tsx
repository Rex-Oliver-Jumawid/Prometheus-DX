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
const personalFilters: ActivityFilter[] = ['All', 'Outputs', 'Tasks', 'Features', 'Membership'];

function personalAction(action: string) {
  const titles: Record<string, string> = {
    FEATURE_CREATED: 'Added feature',
    FEATURE_UPDATED: 'Updated feature',
    FEATURE_DELETED: 'Deleted feature',
    TASK_CREATED: 'Added task',
    TASK_UPDATED: 'Updated task',
    TASK_COMPLETED: 'Completed task',
    TASK_REOPENED: 'Reopened task',
    TASK_DELETED: 'Deleted task',
    OUTCOME_JOINED: 'Joined outcome',
    SUBMISSION_CREATED: 'Submitted output',
    SUBMISSION_REVIEWED: 'Reviewed submission',
    REVISION_REQUESTED: 'Requested revisions',
  };
  const label = titles[action] ?? eventDescription(action);
  return label[0].toUpperCase() + label.slice(1);
}

function personalDetail(item: ProjectActivity) {
  const title = eventTitle(item);
  if (!title) return null;
  if (item.action === 'FEATURE_CREATED') return 'Added feature: ' + title;
  if (item.action === 'FEATURE_UPDATED') return 'Updated feature: ' + title;
  if (item.action === 'TASK_CREATED') return 'Added task: ' + title;
  return title;
}

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
  currentMemberId,
  currentMemberName,
  isLead = true,
}: {
  projectId: string;
  accessToken?: string;
  currentMemberId?: string;
  currentMemberName?: string;
  isLead?: boolean;
}) {
  const [filter, setFilter] = useState<ActivityFilter>('All');
  const [memberId, setMemberId] = useState('all');
  const feed = useInfiniteQuery({
    // Prevent a cached Lead's project-wide history from leaking to another signed-in member.
    queryKey: [
      'projects', projectId, 'activity',
      currentMemberId ?? 'unresolved', isLead ? 'lead' : 'member',
    ],
    queryFn: ({ pageParam }) =>
      apiFetch(
        '/projects/' + projectId + '/activity' +
          (pageParam ? '?cursor=' + encodeURIComponent(pageParam) : ''),
        ProjectActivityPageSchema,
        { accessToken },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(accessToken && currentMemberId),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  // The API is authoritative about visibility. Scope the cached history to the
  // current identity before deriving the count, filters, and visible activity.
  const scope = feed.data?.pages[0]?.scope ?? 'PROJECT';
  const personal = scope === 'PERSONAL';
  const seenIds = new Set<string>();
  const items = (feed.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (item) =>
      (!personal || item.actor?.id === currentMemberId) &&
      !seenIds.has(item.id) &&
      Boolean(seenIds.add(item.id)),
  );
  const availableFilters = personal ? personalFilters : activityFilters;
  const activeFilter = availableFilters.includes(filter) ? filter : 'All';
  const actors = [...new Map(
    items.filter((item) => item.actor).map((item) => [item.actor!.id, item.actor!.fullName] as const),
  )].sort((a, b) => a[1].localeCompare(b[1]));
  const visible = items.filter(
    (item) => (!personal || item.actor?.id === currentMemberId) &&
      matchesFilter(item.action, activeFilter) &&
      (personal || memberId === 'all' || item.actor?.id === memberId),
  );

  return (
    <section
      className={personal ? 'pw-collaboration-panel pw-activity-panel pw-activity-panel--personal' : 'pw-collaboration-panel pw-activity-panel'}
      aria-label={personal ? 'My Activity' : 'Project activity'}
    >
      <header className="pw-collaboration-heading pw-activity-heading">
        <div>
          <span className="pw-collaboration-eyebrow">{personal ? 'PERSONAL PROJECT HISTORY' : 'PROJECT AUDIT TRAIL'}</span>
          <h2>{personal ? 'My Activity' : 'Project Activity'}</h2>
          <p>
            {personal
              ? 'Actions performed by ' + (currentMemberName ?? 'you') + ' inside this project.'
              : 'Review project decisions, submissions, revisions, dependencies, and member activity in one history.'}
          </p>
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
              <span>{personal
                ? (feed.hasNextPage ? 'loaded actions' : 'actions logged')
                : (feed.hasNextPage ? 'loaded events' : 'audit events')}</span>
            </>
          )}
        </div>
      </header>

      <div className="pw-activity-controls">
        <div className="pw-activity-filters" role="group" aria-label="Filter project activity">
          {availableFilters.map((option) => (
            <button
              key={option}
              className={activeFilter === option ? 'pw-activity-filter is-active' : 'pw-activity-filter'}
              type="button"
              aria-pressed={activeFilter === option}
              onClick={() => setFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {!personal && (
          <label className="pw-activity-member-filter">
            <span>Member</span>
            <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
              <option value="all">All members</option>
              {actors.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
        )}
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
                      {personal
                        ? <strong className="pw-activity-personal-action">{personalAction(item.action)}</strong>
                        : <span>{item.actor?.fullName ?? 'System'} · {eventCategory(item.action)}</span>}
                      <time dateTime={item.createdAt}>{eventTime(item.createdAt)}</time>
                    </div>
                    {personal ? (
                      personalDetail(item) && <p className="pw-activity-personal-detail">{personalDetail(item)}</p>
                    ) : (
                      <>
                        <p><strong>{eventDescription(item.action)}</strong></p>
                        {eventTitle(item) && <p className="pw-activity-subject">{eventTitle(item)}</p>}
                      </>
                    )}
                    <div className="pw-activity-entry-meta">
                      {personal && item.outcomeId && (
                        <span className="pw-activity-context-chip">
                          {item.outcomeTitle ?? 'Outcome'} · {currentMemberName ?? 'You'}
                        </span>
                      )}
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
            <p className="pw-collaboration-state pw-activity-empty-state">
              {items.length
                ? 'No activity matches the selected filters.'
                : 'No activity has been recorded yet.'}
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
