import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  DeleteProjectResponseSchema,
  ProjectSchema,
  ProjectStatusUpdateResponseSchema,
  UpdateProjectRequestSchema,
  UpdateProjectStatusRequestSchema,
  type Project,
  type ProjectStatus,
  type UpdateProjectRequest,
} from '../../../shared/contracts/project';
import { useAuth } from '../auth/auth-context';
import { ApiRequestError, apiFetch } from '../../lib/api';
import { ProjectMembersPanel } from './ProjectMembersPanel';
import { ProjectActivityPanel } from './ProjectActivityPanel';
import { ProjectChatPanel } from './ProjectChatPanel';
import { ProjectAnnouncementsPanel } from './ProjectAnnouncementsPanel';
import { ProjectWorkflow } from './ProjectWorkflow';
import { ProjectDialog } from './ProjectDialog';
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

function ProjectEditDialog({
  project,
  pending,
  error,
  onClose,
  onSave,
}: {
  project: Project;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSave: (input: UpdateProjectRequest) => Promise<unknown>;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = UpdateProjectRequestSchema.safeParse({ name, description });
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ?? 'Check the Project details.',
      );
      return;
    }
    setValidationError(null);
    try {
      await onSave(parsed.data);
    } catch {
      // Keep the modal open so the mutation error remains visible.
    }
  };

  return (
    <ProjectDialog
      title="Edit Project"
      eyebrow="PROJECT DETAILS"
      subtitle="Update the Project name and description shown across the workspace."
      ariaLabel="Edit Project"
      pending={pending}
      onClose={onClose}
      className="pw-project-edit-dialog"
    >
      <form className="pw-project-edit-form" onSubmit={(event) => void submit(event)}>
        <div className="vw-add-project-field">
          <label htmlFor="project-edit-name">Project name</label>
          <input
            id="project-edit-name"
            value={name}
            maxLength={160}
            disabled={pending}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="vw-add-project-field">
          <label htmlFor="project-edit-description">Description</label>
          <textarea
            id="project-edit-description"
            value={description}
            maxLength={4000}
            disabled={pending}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        {Boolean(validationError || error) && (
          <div className="projects-form-banner error" role="alert">
            {validationError ?? errorMessage(error)}
          </div>
        )}
        <div className="pw-project-dialog-actions">
          <button
            type="button"
            className="projects-secondary-button"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="projects-primary-button"
            disabled={pending}
          >
            {pending ? 'Saving...' : 'Save Project'}
          </button>
        </div>
      </form>
    </ProjectDialog>
  );
}

function ProjectDeleteDialog({
  projectName,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  projectName: string;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
}) {
  return (
    <ProjectDialog
      title="Delete Project"
      eyebrow="DESTRUCTIVE ACTION"
      subtitle="This permanently removes the Project and its Project-owned workspace data."
      ariaLabel="Delete Project"
      pending={pending}
      onClose={onClose}
      className="pw-project-delete-dialog"
    >
      <p className="pw-project-delete-message">
        Are you sure you want to delete <strong>{projectName}</strong>?
      </p>
      <div className="pw-delete-warning-box">
        <span className="pw-delete-warning-icon" aria-hidden="true">!</span>
        <span>
          Stages, Outcomes, Project chat, announcements, activity, and Project
          membership data owned by this Project will be removed. This cannot be
          undone.
        </span>
      </div>
      {Boolean(error) && (
        <div className="projects-form-banner error" role="alert">
          {errorMessage(error)}
        </div>
      )}
      <div className="pw-project-dialog-actions">
        <button
          type="button"
          className="projects-secondary-button"
          disabled={pending}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="pw-delete-confirm-btn"
          disabled={pending}
          onClick={() => {
            void onConfirm().catch(() => undefined);
          }}
        >
          {pending ? 'Deleting...' : 'Delete Project'}
        </button>
      </div>
    </ProjectDialog>
  );
}

export function ProjectOverviewPage() {
  const { projectId, outcomeId } = useParams();
  const navigate = useNavigate();
  const [projectDialog, setProjectDialog] = useState<'edit' | 'delete' | null>(null);
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

  const updateProject = useMutation({
    mutationFn: (input: UpdateProjectRequest) =>
      apiFetch(
        `/projects/${projectId}`,
        ProjectSchema,
        {
          accessToken,
          method: 'PATCH',
          body: UpdateProjectRequestSchema.parse(input),
        },
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(detailKey, updated);
      queryClient.setQueryData<Project[]>(projectKeys.list, (current) =>
        current?.map((item) => (item.id === updated.id ? updated : item)),
      );
      setProjectDialog(null);
    },
  });

  const deleteProject = useMutation({
    mutationFn: () =>
      apiFetch(
        `/projects/${projectId}`,
        DeleteProjectResponseSchema,
        {
          accessToken,
          method: 'DELETE',
        },
      ),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: detailKey });
      queryClient.removeQueries({
        queryKey: projectKeys.workflow(projectId ?? 'missing-project'),
      });
      queryClient.setQueryData<Project[]>(projectKeys.list, (current) =>
        current?.filter((item) => item.id !== projectId),
      );
      navigate('/projects', { replace: true });
    },
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
  const canEditProject =
    value.lead.id === member?.id || value.currentMemberAccess === 'CAN_EDIT';
  const canDeleteProject = value.lead.id === member?.id;
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
        <div className="pw-project-header-row">
          <div className="pw-project-heading-copy">
            <div className="pw-project-kicker">PROJECT WORKSPACE</div>
            <h1 id="pwProjectTitle">{value.name}</h1>
            <p id="pwProjectDescription">
              {value.description ||
                'Client-facing management platform with onboarding, account tracking, dashboards, communication, and administrative tools.'}
            </p>
          </div>
          {(canEditProject || canDeleteProject) && !outcomeId && (
            <div className="pw-project-header-actions">
              {canEditProject && (
                <button
                  type="button"
                  className="pw-project-action-button"
                  onClick={() => {
                    updateProject.reset();
                    setProjectDialog('edit');
                  }}
                >
                  Edit Project
                </button>
              )}
              {canDeleteProject && (
                <button
                  type="button"
                  className="pw-project-action-button danger"
                  onClick={() => {
                    deleteProject.reset();
                    setProjectDialog('delete');
                  }}
                >
                  Delete Project
                </button>
              )}
            </div>
          )}
        </div>

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
        <div id="pw-content-panel" role="tabpanel" aria-labelledby="pw-content-tab">
          <ProjectWorkflow
            projectId={projectId!}
            outcomeId={outcomeId}
            accessToken={accessToken}
            isLead={workflow.data?.canManageStructure ?? false}
          />
        </div>
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

      {projectDialog === 'edit' && (
        <ProjectEditDialog
          project={value}
          pending={updateProject.isPending}
          error={updateProject.error}
          onClose={() => {
            if (!updateProject.isPending) setProjectDialog(null);
          }}
          onSave={(input) => updateProject.mutateAsync(input)}
        />
      )}
      {projectDialog === 'delete' && (
        <ProjectDeleteDialog
          projectName={value.name}
          pending={deleteProject.isPending}
          error={deleteProject.error}
          onClose={() => {
            if (!deleteProject.isPending) setProjectDialog(null);
          }}
          onConfirm={() => deleteProject.mutateAsync()}
        />
      )}
    </div>
  );
}
