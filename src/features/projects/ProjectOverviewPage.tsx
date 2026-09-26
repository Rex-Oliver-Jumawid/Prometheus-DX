import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ProjectStatusUpdateResponseSchema,
  UpdateProjectStatusRequestSchema,
  type Project,
  type ProjectStatus,
} from '../../../shared/contracts/project';
import { useAuth } from '../auth/auth-context';
import { ApiRequestError, apiFetch } from '../../lib/api';
import { ProjectMembersPanel } from './ProjectMembersPanel';
import { ProjectActivityPanel } from './ProjectActivityPanel';
import { ProjectChatPanel } from './ProjectChatPanel';
import { ProjectAnnouncementsPanel } from './ProjectAnnouncementsPanel';
import { ProjectWorkflow } from './ProjectWorkflow';
import {
  projectDetailQuery,
  projectKeys,
  projectWorkflowQuery,
} from './project-queries';
import './projects.css';
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

function withProjectStatus(
  project: Project,
  status: ProjectStatus,
  server?: { doneAt: string | null; updatedAt: string },
): Project {
  const progressPercentage =
    status === 'DONE'
      ? 100
      : project.metrics?.totalOutcomes
        ? Math.round(
            (project.metrics.acceptedOutcomes / project.metrics.totalOutcomes) *
              100,
          )
        : 0;

  return {
    ...project,
    status,
    doneAt:
      server?.doneAt ??
      (status === 'DONE'
        ? new Date().toISOString()
        : project.status === 'DONE'
          ? null
          : project.doneAt),
    updatedAt: server?.updatedAt ?? project.updatedAt,
    metrics: project.metrics
      ? { ...project.metrics, progressPercentage }
      : project.metrics,
  };
}

export function ProjectOverviewPage() {
  const { projectId, outcomeId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'activity'
    ? 'activity'
    : searchParams.get('tab') === 'chat'
      ? 'chat'
      : 'content';
  const chooseTab = (tab: 'content' | 'chat' | 'activity') => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (tab === 'content') next.delete('tab');
      else next.set('tab', tab);
      return next;
    });
  };
  const { member, session } = useAuth();
  const queryClient = useQueryClient();
  const accessToken = session?.access_token;
  const detailKey = projectKeys.detail(projectId ?? 'missing-project');

  const project = useQuery({
    ...projectDetailQuery(projectId ?? 'missing-project', accessToken),
    enabled: Boolean(projectId && accessToken),
    placeholderData: () =>
      queryClient
        .getQueryData<Project[]>(projectKeys.list)
        ?.find((item) => item.id === projectId),
  });
  const workflow = useQuery({
    ...projectWorkflowQuery(projectId ?? 'missing-project', accessToken),
    enabled: Boolean(projectId && accessToken),
  });

  const updateStatus = useMutation({
    scope: { id: `project-status-${projectId ?? 'missing-project'}` },
    mutationFn: (status: ProjectStatus) =>
      apiFetch(
        `/projects/${projectId}/status`,
        ProjectStatusUpdateResponseSchema,
        {
          accessToken,
          method: 'PATCH',
          body: UpdateProjectStatusRequestSchema.parse({ status }),
        },
      ),
    onMutate: async (status) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: detailKey }),
        queryClient.cancelQueries({ queryKey: projectKeys.list }),
      ]);
      const previousDetail = queryClient.getQueryData<Project>(detailKey);
      const previousList = queryClient.getQueryData<Project[]>(
        projectKeys.list,
      );
      queryClient.setQueryData<Project>(detailKey, (current) =>
        current ? withProjectStatus(current, status) : current,
      );
      queryClient.setQueryData<Project[]>(projectKeys.list, (current) =>
        current?.map((item) =>
          item.id === projectId ? withProjectStatus(item, status) : item,
        ),
      );
      return { previousDetail, previousList };
    },
    onError: (_error, _status, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(detailKey, context.previousDetail);
      }
      if (context?.previousList) {
        queryClient.setQueryData(projectKeys.list, context.previousList);
      }
    },
    onSuccess: (updated) => {
      const reconcile = (current: Project) =>
        withProjectStatus(current, updated.status, updated);
      queryClient.setQueryData<Project>(detailKey, (current) =>
        current ? reconcile(current) : current,
      );
      queryClient.setQueryData<Project[]>(projectKeys.list, (current) =>
        current?.map((item) =>
          item.id === updated.id ? reconcile(item) : item,
        ),
      );
    },
  });

  if (project.isPending) {
    return (
      <section
        className="pw-project-page pw-project-page-skeleton"
        aria-label="Loading project workspace"
      >
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

  if ((project.isError && !project.data) || !project.data) {
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
    <div
      id="pwProjectPage"
      className="pw-project-page"
      aria-labelledby="pwProjectTitle"
    >
      {!outcomeId && (
        <Link to="/projects" className="pw-back-nav pw-project-back-nav" aria-label="Back to Projects list">
          ← Back to Projects
        </Link>
      )}
      <div className="pw-top-bar">
        {(() => {
          if (outcomeId && workflow.data) {
            const allOutcomes = workflow.data.stages.flatMap((s) => s.outcomes);
            const breadcrumbOutcome = allOutcomes.find(
              (o) => o.id === outcomeId,
            );
            const breadcrumbStage = breadcrumbOutcome
              ? workflow.data.stages.find(
                  (s) => s.id === breadcrumbOutcome.stageId,
                )
              : undefined;
            return (
              <nav
                className="pw-breadcrumb-pill"
                aria-label="Breadcrumb"
              >
                <Link to="/projects" className="pw-breadcrumb-link">
                  Projects
                </Link>
                <span className="pw-breadcrumb-sep" aria-hidden="true">/</span>
                <Link
                  to={`/projects/${projectId}`}
                  className="pw-breadcrumb-link"
                  title={value.name}
                >
                  {value.name}
                </Link>
                {breadcrumbStage && (
                  <>
                    <span className="pw-breadcrumb-sep" aria-hidden="true">&gt;</span>
                    <span className="pw-breadcrumb-seg" title={breadcrumbStage.name}>
                      {breadcrumbStage.name}
                    </span>
                  </>
                )}
                {breadcrumbOutcome && (
                  <>
                    <span className="pw-breadcrumb-sep" aria-hidden="true">&gt;</span>
                    <strong
                      className="pw-breadcrumb-current"
                      title={breadcrumbOutcome.title}
                      aria-current="page"
                    >
                      {breadcrumbOutcome.title}
                    </strong>
                  </>
                )}
              </nav>
            );
          }

          return (
            <nav
              className="pw-breadcrumb-pill"
              aria-label="Breadcrumb"
            >
              <Link to="/projects" className="pw-breadcrumb-link">
                Projects
              </Link>
              <span className="pw-breadcrumb-sep" aria-hidden="true">/</span>
              {!outcomeId && activeTab === 'chat' ? (
                <Link
                  to={`/projects/${projectId}`}
                  className="pw-breadcrumb-current pw-chat-project-link"
                  title={value.name}
                  aria-label={value.name}
                >
                  {value.name}
                </Link>
              ) : (
                <strong
                  className="pw-breadcrumb-current"
                  title={value.name}
                  aria-current="page"
                >
                  {value.name}
                </strong>
              )}
            </nav>
          );
        })()}
      </div>

      <section className="pw-project-header">
        {project.isError && (
          <div className="project-status-error" role="alert">
            Latest Project details could not be loaded. Showing the most recent
            available Project data.
          </div>
        )}
        <div className="pw-project-kicker">PROJECT WORKSPACE</div>
        <h1 id="pwProjectTitle">{value.name}</h1>
        <p id="pwProjectDescription">
          {value.description ||
            'Client-facing management platform with onboarding, account tracking, dashboards, communication, and administrative tools.'}
        </p>

        <div className="pw-project-meta">
          <div className="pw-project-meta-card project-overview-card">
            <span>Project lead</span>
            <strong id="pwProjectLead">{value.lead.fullName}</strong>
            <span className="pw-meta-sub pw-project-lead-email">
              {value.lead.email}
            </span>
            <div className="sr-only">
              <h2 id="project-people-title">Project ownership</h2>
              <dl>
                <dt>Project Lead</dt>
                <dd>
                  {value.lead.fullName} {value.lead.email}
                </dd>
                <dt>Created by</dt>
                <dd>
                  {value.creator.fullName} {value.creator.email}
                </dd>
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
                    updateStatus.mutate(event.target.value as ProjectStatus)
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className={`pw-project-state-pill ${value.status.toLowerCase()}`}
                >
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
          <nav className="tabs pw-tabs" role="tablist" aria-label="Project sections">
            <button
              className={`tab-btn ${activeTab === 'content' ? 'active' : ''}`}
              type="button"
              role="tab"
              id="pw-content-tab"
              aria-selected={activeTab === 'content'}
              aria-controls="pw-content-panel"
              onClick={() => chooseTab('content')}
            >
              Content
            </button>
            <button
              className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
              type="button"
              role="tab"
              id="pw-chat-tab"
              aria-selected={activeTab === 'chat'}
              aria-controls="pw-chat-panel"
              onClick={() => chooseTab('chat')}
            >
              Chat
            </button>
            <button
              className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
              type="button"
              role="tab"
              id="pw-activity-tab"
              aria-selected={activeTab === 'activity'}
              aria-controls="pw-activity-panel"
              onClick={() => chooseTab('activity')}
            >
              Activity
            </button>
          </nav>
        </div>

      {activeTab === 'content' && outcomeId ? (
        <ProjectWorkflow
          projectId={projectId!}
          outcomeId={outcomeId}
          accessToken={accessToken}
          isLead={workflow.data?.canManageStructure ?? false}
        />
      ) : activeTab === 'chat' ? (
        <div id="pw-chat-panel" role="tabpanel" aria-labelledby="pw-chat-tab">
          <div className="pw-chat-page-heading">
            <div>
              <h2 id="pwChatPageTitle">Project chat</h2>
              <p>Local conversation for {value.name}.</p>
            </div>
          </div>
          <div className="pw-chat-workspace">
            <ProjectChatPanel
              key={projectId}
              projectId={projectId!}
              projectName={value.name}
              projectLead={value.lead}
              currentMemberId={member?.id}
              accessToken={accessToken}
              initialMessageId={searchParams.get('message')}
            />
            <aside className="pw-chat-side-stack" aria-label="Project chat sidebar">
              <ProjectAnnouncementsPanel
                projectId={projectId!}
                accessToken={accessToken}
              />
              <div className="pw-chat-sidebar">
                <ProjectMembersPanel
                  key={projectId}
                  projectId={projectId!}
                  projectLead={value.lead}
                  accessToken={accessToken}
                  compact
                />
              </div>
            </aside>
          </div>
        </div>
      ) : activeTab === 'activity' ? (
        <div id="pw-activity-panel" role="tabpanel" aria-labelledby="pw-activity-tab">
          <ProjectActivityPanel
            key={projectId}
            projectId={projectId!}
            accessToken={accessToken}
            currentMemberId={member?.id}
            currentMemberName={member?.fullName}
            isLead={value.lead.id === member?.id}
          />
        </div>
      ) : (
        <div id="pw-content-panel" role="tabpanel" aria-labelledby="pw-content-tab">
          <ProjectWorkflow
            projectId={projectId!}
            accessToken={accessToken}
            isLead={workflow.data?.canManageStructure ?? false}
          />
        </div>
      )}
    </div>
  );
}
