import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type {
  HomeDashboardResponse,
  HomeProject,
  HomeWorkingMember,
} from '../../../shared/contracts/home';
import type { CurrentMember } from '../../../shared/contracts/member';
import { useAuth } from '../auth/auth-context';
import { homeDashboardQuery } from './home-queries';
import './home.css';

function firstName(member: CurrentMember) {
  const nickname = member.nickname?.trim();
  if (nickname) return nickname;
  return member.fullName.trim().split(/\s+/)[0] ?? member.fullName;
}

function greetingFor(asOf: string, timezone: string) {
  const hourPart = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hourCycle: 'h23',
  })
    .formatToParts(new Date(asOf))
    .find((part) => part.type === 'hour')?.value;
  const hour = Number(hourPart ?? 12);
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function dateLabel(asOf: string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(asOf));
}

function hoursLabel(seconds: number) {
  const hours = seconds / 3_600;
  if (hours === 0) return '0h';
  return `${hours.toFixed(1).replace(/\.0$/, '')}h`;
}

function plannedHoursLabel(minutes: number) {
  const hours = minutes / 60;
  return `${hours.toFixed(1).replace(/\.0$/, '')}h`;
}

function statusLabel(status: HomeProject['status']) {
  return status
    .split('_')
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(' ');
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function ProjectGroup({
  title,
  projects,
  empty,
}: {
  title: string;
  projects: HomeProject[];
  empty: string;
}) {
  return (
    <section className="home-project-group" aria-labelledby={`home-${title}`}>
      <div className="home-project-group-heading">
        <h3 id={`home-${title}`}>{title}</h3>
        <span>{projects.length}</span>
      </div>
      {projects.length === 0 ? (
        <p className="home-inline-empty">{empty}</p>
      ) : (
        <div className="home-project-list">
          {projects.map((project) => (
            <Link
              className="home-project-row"
              key={project.id}
              to={`/projects/${project.id}`}
            >
              <span className="home-project-copy">
                <strong>{project.name}</strong>
                <span className="home-project-meta">
                  <i>
                    {project.relationship === 'LEAD'
                      ? 'Lead'
                      : project.accessLevel === 'CAN_EDIT'
                        ? 'Member · Can edit'
                        : 'Member'}
                  </i>
                  <small>{statusLabel(project.status)}</small>
                </span>
              </span>
              <span
                className="home-progress"
                aria-label={`${project.progressPercentage}% complete`}
              >
                <b>{project.progressPercentage}%</b>
                <span>
                  <i style={{ width: `${project.progressPercentage}%` }} />
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function WorkingMember({ member }: { member: HomeWorkingMember }) {
  return (
    <li className="home-working-row">
      <span className="home-working-avatar" aria-hidden="true">
        {initials(member.fullName)}
      </span>
      <span>
        <strong>{member.fullName}</strong>
        <small>{member.department.shortLabel}</small>
      </span>
      <i aria-label="Currently working" />
    </li>
  );
}

export function HomeDashboardView({
  data,
  member,
}: {
  data: HomeDashboardResponse;
  member: CurrentMember;
}) {
  return (
    <div className="home-page">
      <header className="home-header">
        <div>
          <p className="home-kicker">Company command center</p>
          <h1>
            {greetingFor(data.asOf, data.timezone)}, {firstName(member)}
          </h1>
          <p className="home-subtitle">
            You are viewing the company as {member.fullName}. Here is what is
            happening across projects and teams.
          </p>
        </div>
        <time dateTime={data.asOf}>
          {dateLabel(data.asOf, data.timezone)}
        </time>
      </header>

      <section className="home-summary-grid" aria-label="Company summary">
        <article className="home-summary-card">
          <span>Working now</span>
          <strong>{data.summary.workingNow}</strong>
          <small>members currently active</small>
        </article>
        <article className="home-summary-card">
          <span>Active projects</span>
          <strong>{data.summary.activeProjects}</strong>
          <small>{data.summary.totalProjects} projects total</small>
        </article>
        <article className="home-summary-card">
          <span>Awaiting review</span>
          <strong>{data.summary.awaitingReview}</strong>
          <small>
            {data.summary.revisionRequests}{' '}
            {data.summary.revisionRequests === 1
              ? 'revision request'
              : 'revision requests'}
          </small>
        </article>
        <article className="home-summary-card">
          <span>My week</span>
          <strong>{hoursLabel(data.summary.actualWorkedSeconds)}</strong>
          <small>
            {plannedHoursLabel(data.summary.plannedMinutes)} planned commitment
          </small>
        </article>
      </section>

      <div className="home-dashboard-grid">
        <section className="home-panel home-projects-panel">
          <div className="home-panel-heading">
            <div>
              <h2>My Projects</h2>
              <p>Projects you lead or contribute to.</p>
            </div>
            <Link to="/projects">View all →</Link>
          </div>
          <div className="home-project-groups">
            <ProjectGroup
              title="Leading"
              projects={data.projects.leading}
              empty="You are not leading a project right now."
            />
            <ProjectGroup
              title="Participating"
              projects={data.projects.participating}
              empty="You are not participating in another project yet."
            />
          </div>
        </section>

        <aside className="home-side-column" aria-label="Home activity">
          <section className="home-panel home-side-panel">
            <div className="home-panel-heading compact">
              <div>
                <h2>Working now</h2>
                <p>
                  {data.workingNow.length}{' '}
                  {data.workingNow.length === 1
                    ? 'active member'
                    : 'active members'}
                </p>
              </div>
            </div>
            <div className="home-fixed-list">
              {data.workingNow.length === 0 ? (
                <p className="home-side-empty">No active work sessions.</p>
              ) : (
                <ul className="home-working-list">
                  {data.workingNow.map((workingMember) => (
                    <WorkingMember
                      key={workingMember.id}
                      member={workingMember}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="home-panel home-side-panel">
            <div className="home-panel-heading compact">
              <div>
                <h2>Needs attention</h2>
                <p>Review and delivery signals.</p>
              </div>
            </div>
            <div className="home-fixed-list">
              {data.needsAttention.length === 0 ? (
                <p className="home-side-empty">Nothing needs attention.</p>
              ) : (
                <div className="home-attention-list">
                  {data.needsAttention.map((item) => (
                    <Link
                      className="home-attention-row"
                      key={item.id}
                      to={`/projects/${item.projectId}/outcomes/${item.outcomeId}`}
                    >
                      <strong>{item.title}</strong>
                      <span>
                        {item.projectName} · {item.stageName}
                      </span>
                      <i className={item.kind.toLowerCase()}>
                        {item.kind === 'REVIEW' ? 'For review' : 'Needs revision'}
                      </i>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="home-panel home-quick-panel">
            <h2>Quick access</h2>
            <div className="home-quick-grid">
              <Link to="/projects">
                <span>Projects</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link to="/schedule">
                <span>Schedule</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link to="/team">
                <span>Team</span>
                <span aria-hidden="true">→</span>
              </Link>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Reports & Analytics is not implemented yet"
              >
                <span>Reports</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function HomePage() {
  const { member, session } = useAuth();
  const dashboard = useQuery(homeDashboardQuery(session?.access_token));

  if (!member) return null;

  if (dashboard.isPending) {
    return (
      <section className="home-request-state" role="status" aria-live="polite">
        <span className="spinner dark" aria-hidden="true" />
        <h1>Opening your command center</h1>
        <p>Loading current project and work activity.</p>
      </section>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <section className="home-request-state" role="alert">
        <h1>Home could not be loaded</h1>
        <p>
          {dashboard.error instanceof Error
            ? dashboard.error.message
            : 'Current dashboard data is unavailable.'}
        </p>
        <button
          className="home-retry"
          type="button"
          onClick={() => void dashboard.refetch()}
        >
          Try again
        </button>
      </section>
    );
  }

  return <HomeDashboardView data={dashboard.data} member={member} />;
}
