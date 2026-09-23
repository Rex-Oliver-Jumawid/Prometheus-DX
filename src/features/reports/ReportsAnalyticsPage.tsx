import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useAuth } from '../auth/auth-context';
import {
  projectWorkflowQuery,
  projectsListQuery,
} from '../projects/project-queries';
import { formatHours } from '../work-sessions/work-session-format';
import { teamWorkSummaryQuery } from '../work-sessions/work-session-queries';
import {
  buildReportsAnalyticsModel,
  type ReportsFilters,
} from './reports-model';
import './reports.css';

function formatWeek(start: string, end: string): string {
  const format = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
  });
  return `${format.format(new Date(start))} - ${format.format(new Date(end))}`;
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="reports-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ProgressRow({
  label,
  value,
  caption,
}: {
  label: string;
  value: number;
  caption: string;
}) {
  return (
    <div className="reports-progress-row">
      <div className="reports-row-heading">
        <strong>{label}</strong>
        <span>{value}%</span>
      </div>
      <div className="reports-progress-track" aria-hidden="true">
        <i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <small>{caption}</small>
    </div>
  );
}

export function ReportsAnalyticsPage() {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [filters, setFilters] = useState<ReportsFilters>({
    projectId: '',
    departmentId: '',
  });

  const projects = useQuery(projectsListQuery(accessToken));
  const team = useQuery(teamWorkSummaryQuery(accessToken));
  const workflowQueries = useQueries({
    queries: (projects.data ?? []).map((project) =>
      projectWorkflowQuery(project.id, accessToken),
    ),
  });

  const workflows = workflowQueries.flatMap((query) =>
    query.data ? [query.data] : [],
  );

  const departments = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    (projects.data ?? []).forEach((project) =>
      project.departments.forEach((department) =>
        byId.set(department.id, {
          id: department.id,
          name: department.name,
        }),
      ),
    );
    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [projects.data]);

  const waitingForWorkflows =
    Boolean(projects.data?.length) &&
    workflowQueries.some((query) => query.isPending);
  const hasWorkflowError = workflowQueries.some((query) => query.isError);

  if (projects.isPending || team.isPending || waitingForWorkflows) {
    return (
      <section className="reports-state" role="status">
        <span className="reports-state-kicker">OPERATING INTELLIGENCE</span>
        <h1>Reports & Analytics</h1>
        <p>Building the current company view from live project and work data...</p>
      </section>
    );
  }

  if (projects.isError || team.isError || hasWorkflowError || !team.data) {
    const message =
      projects.error?.message ??
      team.error?.message ??
      workflowQueries.find((query) => query.error)?.error?.message ??
      'Reporting data could not be loaded.';
    return (
      <section className="reports-state error" role="alert">
        <span className="reports-state-kicker">OPERATING INTELLIGENCE</span>
        <h1>Reports could not be loaded</h1>
        <p>{message}</p>
        <button
          type="button"
          onClick={() => {
            void projects.refetch();
            void team.refetch();
            workflowQueries.forEach((query) => void query.refetch());
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  const model = buildReportsAnalyticsModel(
    projects.data ?? [],
    workflows,
    team.data,
    filters,
  );

  const clearFilters = () =>
    setFilters({
      projectId: '',
      departmentId: '',
    });

  return (
    <section className="reports-page" aria-labelledby="reports-title">
      <header className="reports-header">
        <div className="reports-heading">
          <span className="reports-kicker">OPERATING INTELLIGENCE</span>
          <h1 id="reports-title">Reports & Analytics</h1>
          <p>
            Project delivery, outcome pipeline, team capacity, and company
            activity in one view.
          </p>
        </div>
        <div className="reports-header-actions">
          <span className="reports-period">
            {formatWeek(team.data.weekStart, team.data.weekEnd)} · Live
          </span>
          <div className="reports-filters" aria-label="Report filters">
            <label>
              <span>Project</span>
              <select
                value={filters.projectId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    projectId: event.target.value,
                  }))
                }
              >
                <option value="">All projects</option>
                {(projects.data ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Department</span>
              <select
                value={filters.departmentId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    departmentId: event.target.value,
                  }))
                }
              >
                <option value="">All departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            {(filters.projectId || filters.departmentId) && (
              <button type="button" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="reports-metrics" aria-label="Company reporting summary">
        <MetricCard
          label="Project progress"
          value={`${model.projectProgress}%`}
          detail={`Average across ${model.projectCount} project${model.projectCount === 1 ? '' : 's'}`}
        />
        <MetricCard
          label="Accepted outcomes"
          value={model.acceptedOutcomes}
          detail={`${model.totalOutcomes} outcomes total`}
        />
        <MetricCard
          label="Needs review"
          value={model.needsReview}
          detail={`${model.needsReview} review · ${model.needsRevision} revision`}
        />
        <MetricCard
          label="Capacity used"
          value={`${model.capacityPercent}%`}
          detail={`${formatHours(model.actualSeconds)} / ${formatHours(model.plannedSeconds)} planned`}
        />
      </div>

      <div className="reports-grid reports-grid-top">
        <article className="reports-panel reports-project-health">
          <div className="reports-panel-title">
            <h2>Project health</h2>
            <p>Current progress across all company projects.</p>
          </div>
          <div className="reports-list">
            {model.projectHealth.length ? (
              model.projectHealth.map((project) => (
                <ProgressRow
                  key={project.id}
                  label={project.name}
                  value={project.progress}
                  caption={`${project.accepted} accepted / ${project.total} outcomes · ${project.status}`}
                />
              ))
            ) : (
              <div className="reports-empty">No projects match these filters.</div>
            )}
          </div>
        </article>

        <article className="reports-panel reports-pipeline">
          <div className="reports-panel-title">
            <h2>Outcome pipeline</h2>
            <p>Where project outcomes currently sit.</p>
          </div>
          <div className="reports-pipeline-grid">
            {model.pipeline.map((item) => (
              <div className="reports-pipeline-cell" key={item.key}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
                <small>{item.detail}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="reports-grid reports-grid-bottom">
        <article className="reports-panel reports-capacity">
          <div className="reports-panel-title">
            <h2>Team capacity</h2>
            <p>Worked hours against planned commitment.</p>
          </div>
          <div className="reports-list">
            {model.capacity.length ? (
              model.capacity.map((member) => (
                <div className="reports-progress-row" key={member.id}>
                  <div className="reports-row-heading">
                    <strong>{member.name}</strong>
                    <span>
                      {formatHours(member.actualSeconds)} /{' '}
                      {formatHours(member.plannedSeconds)}
                    </span>
                  </div>
                  <div className="reports-progress-track" aria-hidden="true">
                    <i style={{ width: `${member.percent}%` }} />
                  </div>
                  <small>
                    {member.percent}% of planned weekly commitment recorded
                  </small>
                </div>
              ))
            ) : (
              <div className="reports-empty">No team capacity data in this scope.</div>
            )}
          </div>
        </article>

        <article className="reports-panel reports-departments">
          <div className="reports-panel-title">
            <h2>Department workload</h2>
            <p>Outcomes currently owned by each department.</p>
          </div>
          <div className="reports-list">
            {model.departments.length ? (
              model.departments.map((department) => (
                <div className="reports-progress-row" key={department.id}>
                  <div className="reports-row-heading">
                    <strong>{department.name}</strong>
                    <span>{department.total} outcomes</span>
                  </div>
                  <div className="reports-progress-track" aria-hidden="true">
                    <i style={{ width: `${department.share}%` }} />
                  </div>
                  <small>
                    {department.open} open · {department.share}% of scoped
                    outcome ownership
                  </small>
                </div>
              ))
            ) : (
              <div className="reports-empty">No department workload in this scope.</div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
