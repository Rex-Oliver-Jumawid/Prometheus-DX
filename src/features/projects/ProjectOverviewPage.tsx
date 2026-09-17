import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ProjectDetailResponseSchema,
  UpdateProjectStatusRequestSchema,
  type ProjectStatus,
} from '../../../shared/contracts/project';
import { useAuth } from '../auth/auth-context';
import { ApiRequestError, apiFetch } from '../../lib/api';
import { ProjectWorkflow } from './ProjectWorkflow';
import './projects.css';

const projectsKey = ['projects', 'list'] as const;
const statusOptions: ProjectStatus[] = ['PLANNING', 'IN_PROGRESS', 'DONE'];

function statusLabel(status: ProjectStatus) {
  return status
    .split('_')
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(' ');
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

export function ProjectOverviewPage() {
  const { projectId, outcomeId } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const accessToken = session?.access_token;
  const detailKey = ['projects', 'detail', projectId] as const;

  const project = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) =>
      apiFetch(`/projects/${projectId}`, ProjectDetailResponseSchema, {
        accessToken,
        signal,
      }),
    enabled: Boolean(projectId),
    retry: false,
  });

  const updateStatus = useMutation({
    mutationFn: (status: ProjectStatus) =>
      apiFetch(`/projects/${projectId}/status`, ProjectDetailResponseSchema, {
        accessToken,
        method: 'PATCH',
        body: UpdateProjectStatusRequestSchema.parse({ status }),
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(detailKey, updated);
      await queryClient.invalidateQueries({ queryKey: projectsKey });
    },
  });

  if (project.isPending) {
    return (
      <section className="pw-project-page pw-project-page-skeleton" aria-label="Loading project workspace">
        <div className="pw-project-header">
          <div className="pw-sk-kicker" />
          <div className="pw-sk-title" />
          <div className="pw-sk-desc" />
          <div className="pw-project-meta">
            <div className="pw-project-meta-card pw-meta-card-skeleton">
              <div className="pw-sk-meta-label" />
              <div className="pw-sk-meta-val" />
            </div>
            <div className="pw-project-meta-card pw-meta-card-skeleton">
              <div className="pw-sk-meta-label" />
              <div className="pw-sk-meta-val" />
            </div>
            <div className="pw-project-meta-card pw-meta-card-skeleton">
              <div className="pw-sk-meta-label" />
              <div className="pw-sk-meta-val" />
              <div className="pw-sk-meta-track" />
            </div>
          </div>
        </div>
        <div className="pw-board-skeleton-wrap">
          <div className="pw-board-skeleton">
            <div className="pw-stage-column-skeleton" />
            <div className="pw-stage-column-skeleton" />
            <div className="pw-stage-column-skeleton" />
          </div>
        </div>
      </section>
    );
  }

  const isNotFound =
    !projectId ||
    (project.error instanceof ApiRequestError &&
      (project.error.statusCode === 400 || project.error.statusCode === 404));

  if (isNotFound) {
    return (
      <section className="projects-state-card project-overview-state">
        <strong>Project not found</strong>
        <p>This Project may have been removed, or the address is invalid.</p>
        <Link className="projects-secondary-link" to="/projects">
          Back to Projects
        </Link>
      </section>
    );
  }

  if (project.isError || !project.data) {
    return (
      <section
        className="projects-state-card project-overview-state"
        role="alert"
      >
        <strong>Project could not be loaded.</strong>
        <p>{errorMessage(project.error)}</p>
        <button
          type="button"
          className="projects-secondary-button"
          onClick={() => void project.refetch()}
        >
          Retry
        </button>
      </section>
    );
  }

  const value = project.data;
  const statusError = updateStatus.isError
    ? errorMessage(updateStatus.error)
    : null;

  return (
    <div id="pwProjectPage" className="pw-project-page" aria-labelledby="pwProjectTitle">
      <div className="pw-top-bar">
        <div className="pw-breadcrumb-pill">
          <Link to="/projects" className="pw-breadcrumb-link">
            Projects
          </Link>
          <span className="pw-breadcrumb-sep">/</span>
          <strong className="pw-breadcrumb-current" title={value.name}>
            {value.name}
          </strong>
        </div>
      </div>

      <section className="pw-project-header">
        <div className="pw-project-kicker">PROJECT WORKSPACE</div>
        <h1 id="pwProjectTitle">{value.name}</h1>
        <p id="pwProjectDescription">
          {value.description || 'Client-facing management platform with onboarding, account tracking, dashboards, communication, and administrative tools.'}
        </p>

        <div className="pw-project-meta">
          <div className="pw-project-meta-card project-overview-card">
            <span>Project lead</span>
            <strong id="pwProjectLead">{value.lead.fullName}</strong>
            <span className="pw-meta-sub pw-project-lead-email">{value.lead.email}</span>
            <div className="sr-only">
              <h2 id="project-people-title">Project ownership</h2>
              <dl>
                <dt>Project Lead</dt>
                <dd>{value.lead.fullName} {value.lead.email}</dd>
                <dt>Created by</dt>
                <dd>{value.creator.fullName} {value.creator.email}</dd>
              </dl>
            </div>
          </div>

          <div className="pw-project-meta-card">
            <span>State</span>
            <div id="pwProjectStateControl">
              {value.canChangeStatus ? (
                <select
                  aria-label="Project status"
                  className="pw-project-state-select"
                  value={value.status}
                  disabled={updateStatus.isPending}
                  onChange={(event) =>
                    void updateStatus.mutateAsync(
                      event.target.value as ProjectStatus,
                    )
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={`pw-project-state-pill ${value.status.toLowerCase()}`}>
                  {statusLabel(value.status)}
                </span>
              )}
            </div>
            {statusError && (
              <p className="project-status-error" role="alert">
                {statusError}
              </p>
            )}
          </div>

          <div className="pw-project-meta-card">
            <span>Progress</span>
            <strong id="pwProjectProgressSummary">
              {value.metrics
                ? `${value.metrics.acceptedOutcomes} accepted / ${value.metrics.totalOutcomes} outcomes · ${value.metrics.progressPercentage}%`
                : value.status === 'DONE'
                  ? 'Completed · 100%'
                  : '0 accepted / 0 outcomes · 0%'}
            </strong>
            <div className="pw-project-progress-track">
              <span
                id="pwProjectProgressFill"
                style={{
                  width: `${value.metrics?.progressPercentage ?? (value.status === 'DONE' ? 100 : 0)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="tabs-wrap pw-tabs-wrap">
        <nav className="tabs pw-tabs" aria-label="Project sections">
          <button className="tab-btn active" type="button">
            Content
          </button>
          <button className="tab-btn" type="button">
            Chat <span className="tab-badge">10</span>
          </button>
          <button className="tab-btn" type="button">
            Activity <span className="tab-badge">6</span>
          </button>
        </nav>
      </div>

      <ProjectWorkflow
        projectId={projectId!}
        outcomeId={outcomeId}
        accessToken={accessToken}
        isLead={value.lead.id === session?.user?.id || value.canChangeStatus}
      />
    </div>
  );
}
