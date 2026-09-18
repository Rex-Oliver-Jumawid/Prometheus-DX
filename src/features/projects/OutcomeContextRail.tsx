import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { OutcomeWorkSchema } from '../../../shared/contracts/outcome-work';
import { OutcomeDeliverySchema } from '../../../shared/contracts/outcome-delivery';

type OutcomePrerequisite = {
  id: string;
  title: string;
  resolved: boolean;
};

type OutcomeMember = {
  id: string;
  fullName: string;
};

type OutcomeDepartment = {
  id: string;
  name: string;
};

export interface OutcomeContextRailProps {
  projectId: string;
  outcomeId: string;
  accessToken?: string;
  isJoined: boolean;
  outcome: {
    title: string;
    lifecycleStatus: string;
    departments: OutcomeDepartment[];
    members: OutcomeMember[];
    prerequisites: OutcomePrerequisite[];
  };
}

function getInitials(name: string): string {
  if (!name.trim()) return '--';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatActivityTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const time = d.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${month} ${day} · ${time}`;
  } catch {
    return dateStr;
  }
}

export function OutcomeContextRail({
  projectId,
  outcomeId,
  accessToken,
  isJoined,
  outcome,
}: OutcomeContextRailProps) {
  const workQueryKey = [
    'projects',
    projectId,
    'outcome-work',
    outcomeId,
    isJoined,
  ];
  const workPath = `/projects/${projectId}/outcomes/${outcomeId}/work`;
  const work = useQuery({
    queryKey: workQueryKey,
    queryFn: () => apiFetch(workPath, OutcomeWorkSchema, { accessToken }),
    retry: false,
    staleTime: 10_000,
  });

  const deliveryQueryKey = [
    'projects',
    projectId,
    'delivery',
    outcomeId,
    isJoined,
  ];
  const deliveryPath = `/projects/${projectId}/outcomes/${outcomeId}/delivery`;
  const delivery = useQuery({
    queryKey: deliveryQueryKey,
    queryFn: () =>
      apiFetch(deliveryPath, OutcomeDeliverySchema, { accessToken }),
    retry: false,
    staleTime: 10_000,
  });

  const progress =
    outcome.lifecycleStatus === 'ACCEPTED'
      ? 100
      : (work.data?.progress ?? 0);

  const featureCount = work.data?.features.length ?? 0;
  const completedTasks = work.data?.completedTasks ?? 0;
  const totalTasks = work.data?.totalTasks ?? 0;

  const activities = delivery.data?.activity ?? [];
  const latestActivity = activities[0];
  const lastActivityLabel = latestActivity
    ? formatActivityTime(latestActivity.createdAt)
    : 'Outcome workspace prepared';

  const primaryMember = outcome.members[0];
  const avatarInitials = primaryMember
    ? getInitials(primaryMember.fullName)
    : outcome.departments[0]?.name.slice(0, 2).toUpperCase() || 'PW';

  const departmentText =
    outcome.departments.map((d) => d.name).join(', ') || 'General';

  const contributorsText =
    outcome.members.map((m) => m.fullName).join(', ') ||
    'No contributors yet';

  return (
    <aside className="outcome-context-rail" aria-label="Outcome details sidebar">
      {/* 1. Outcome Status Card */}
      <section className="rail-card status-rail-card">
        <div className="rail-title-row">
          <span className="rail-icon" aria-hidden="true">
            ◔
          </span>
          <div className="side-title">Outcome Status</div>
        </div>
        <div className="status-ring-row">
          <div
            className="progress-ring"
            style={
              {
                '--ring-progress': `${progress * 3.6}deg`,
              } as React.CSSProperties
            }
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Work progress"
          >
            <div className="progress-ring-core">
              <strong className="sr-only">{progress}%</strong>
            </div>
          </div>
          <div>
            <div className="ring-number">{progress}%</div>
            <div className="ring-label">Work progress</div>
          </div>
        </div>
        <div className="rail-divider" />
        <div className="rail-stat">
          <span>Features</span>
          <strong>{featureCount}</strong>
        </div>
        <div className="rail-stat">
          <span>Tasks</span>
          <strong>
            {completedTasks} / {totalTasks}
          </strong>
        </div>
        <div className="rail-stat">
          <span>Last activity</span>
          <strong>{lastActivityLabel}</strong>
        </div>
      </section>

      {/* 2. Ownership Card */}
      <section className="rail-card ownership-rail-card">
        <div className="rail-title-row">
          <span className="rail-icon" aria-hidden="true">
            ♧
          </span>
          <div className="side-title">Ownership</div>
        </div>
        <div className="ownership-profile">
          <div className="ownership-avatar" aria-hidden="true">
            {avatarInitials}
          </div>
          <div className="ownership-info">
            <div className="meta-label">Department</div>
            <strong>{departmentText}</strong>
            <div className="meta-label ownership-member-label">
              Contributors
            </div>
            <strong>{contributorsText}</strong>
          </div>
        </div>
      </section>

      {/* 3. Prerequisite Card */}
      <section className="rail-card prereq-rail-card">
        <div className="rail-title-row">
          <span className="rail-icon" aria-hidden="true">
            ⌁
          </span>
          <div className="side-title">Prerequisite</div>
        </div>
        <div className="prereq-rail">
          {outcome.prerequisites.length > 0 ? (
            <ul className="prereq-rail-list">
              {outcome.prerequisites.map((prereq) => (
                <li key={prereq.id} className="prereq-rail-item">
                  <span className="prereq-pill">
                    {prereq.title}
                  </span>
                  <span
                    className={`prereq-status ${prereq.resolved ? 'resolved' : 'waiting'}`}
                  >
                    {prereq.resolved ? 'Resolved' : 'Waiting'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="prereq-independent">
              <span className="prereq-pill">No prerequisite</span>
              <p className="prereq-note">
                This outcome can proceed independently.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 4. Recent Activity Card */}
      <section className="rail-card activity-rail-card">
        <div className="rail-title-row">
          <span className="rail-icon" aria-hidden="true">
            ◷
          </span>
          <div className="side-title">Recent Activity</div>
        </div>
        <div className="rail-activity-list">
          {activities.length > 0 ? (
            activities.slice(0, 3).map((item) => (
              <div key={item.id} className="rail-activity-item">
                <span className="rail-activity-dot" aria-hidden="true" />
                <div className="rail-activity-content">
                  <div className="rail-activity-action">
                    {item.action.toLowerCase().replaceAll('_', ' ')}
                  </div>
                  <div className="rail-activity-time">
                    {formatActivityTime(item.createdAt)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rail-activity-item">
              <span className="rail-activity-dot" aria-hidden="true" />
              <div className="rail-activity-content">
                <div className="rail-activity-action">
                  Outcome workspace prepared.
                </div>
                <div className="rail-activity-time">Project setup</div>
              </div>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
