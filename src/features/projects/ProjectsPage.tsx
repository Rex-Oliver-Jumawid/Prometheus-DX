import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CreateProjectRequestSchema,
  ProjectSchema,
  type CreateProjectRequest,
  type Project,
  type ProjectStatus,
} from '../../../shared/contracts/project';
import { useAuth } from '../auth/auth-context';
import { apiFetch } from '../../lib/api';
import { CreateProjectDialog } from './CreateProjectDialog';
import { loadProjectOverviewRoute } from '../../routes/route-modules';
import {
  projectDetailQuery,
  projectKeys,
  projectsListQuery,
  projectWorkflowQuery,
} from './project-queries';
import './projects.css';

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

function statusLabel(status: string) {
  return status
    .split('_')
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(' ');
}

interface StatusGroupConfig {
  key: ProjectStatus;
  label: string;
  emptyText: string;
}

const STATUS_GROUPS: StatusGroupConfig[] = [
  {
    key: 'PLANNING',
    label: 'Planning',
    emptyText: 'No planning projects yet.',
  },
  {
    key: 'IN_PROGRESS',
    label: 'In Progress',
    emptyText: 'No in progress projects yet.',
  },
  {
    key: 'DONE',
    label: 'Done',
    emptyText: 'No done projects yet.',
  },
];

function formatCompletionDate(dateStr?: string) {
  if (!dateStr) return 'Done';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Done';
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Done';
  }
}

interface ProjectCardProps {
  project: Project;
  currentMemberId?: string;
  scope: 'all' | 'mine' | 'archives';
  onPrefetch: (projectId: string) => void;
}

function ProjectCard({
  project,
  currentMemberId,
  scope,
  onPrefetch,
}: ProjectCardProps) {
  const metrics = project.metrics;
  const progress =
    metrics?.progressPercentage ?? (project.status === 'DONE' ? 100 : 0);
  const openOutcomes = metrics?.openOutcomes ?? 0;
  const totalOutcomes = metrics?.totalOutcomes ?? 0;
  const activeStagesCount = metrics?.activeStagesCount ?? 0;
  const activeStages = metrics?.activeStages ?? [];

  const stageSummary =
    activeStages.length > 0
      ? activeStages
          .slice(0, 2)
          .map((stage) => `${stage.name} (${stage.openOutcomesCount})`)
          .join(' · ')
      : 'No open stage work';

  const isLead = project.lead.id === currentMemberId;
  const showRelationBadge =
    scope === 'mine' || isLead || project.isParticipating;
  const relationText = isLead
    ? 'Lead'
    : project.isParticipating
      ? 'Member'
      : null;

  return (
    <article
      className="vw-overview-project"
      style={{ '--project-progress': `${progress}%` } as React.CSSProperties}
    >
      <div className="vw-overview-project-head">
        <div>
          <div className="vw-overview-project-kicker">COMPANY PROJECT</div>
          <h3 className="vw-overview-project-title">{project.name}</h3>
        </div>
        <div className="vw-overview-project-head-actions">
          {showRelationBadge && relationText && (
            <span className="vw-project-relation-badge">{relationText}</span>
          )}
          <span
            className={`vw-overview-project-status status-${project.status.toLowerCase()}`}
          >
            {statusLabel(project.status).toUpperCase()}
          </span>
        </div>
      </div>

      <p className="vw-overview-project-desc">{project.description}</p>

      <div className="vw-overview-progress-block">
        <div className="vw-overview-progress-head">
          <span>OVERALL PROJECT PROGRESS</span>
          <strong>{progress}%</strong>
        </div>
        <div className="vw-progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="vw-overview-meta-grid">
          <div className="vw-overview-meta">
            <div className="vw-overview-meta-label">OPEN OUTCOMES</div>
            <div className="vw-overview-meta-value">
              {openOutcomes} / {totalOutcomes} outcomes
            </div>
          </div>
          <div className="vw-overview-meta">
            <div className="vw-overview-meta-label">ACTIVE STAGES</div>
            <div className="vw-overview-meta-value">
              {activeStagesCount} stage{activeStagesCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </div>

      <div className="vw-overview-depts">
        {project.departments.map((dept) => (
          <span key={dept.id} className="vw-overview-dept" title={dept.name}>
            {dept.name}
          </span>
        ))}
      </div>

      <div className="vw-overview-workers">
        <span className="vw-overview-no-workers">
          No one currently working on this project
        </span>
      </div>

      <div className="vw-overview-stage-line">
        <strong>Current:</strong> {stageSummary}
      </div>

      <div className="vw-overview-project-foot">
        <span>
          {project.departments.length} department
          {project.departments.length === 1 ? '' : 's'} involved
        </span>
        <Link
          to={`/projects/${project.id}`}
          className="vw-overview-open"
          onMouseEnter={() => onPrefetch(project.id)}
          onFocus={() => onPrefetch(project.id)}
        >
          Open Workspace →
        </Link>
      </div>
    </article>
  );
}

export function ProjectsPage() {
  const { member, session } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scope, setScope] = useState<'all' | 'mine' | 'archives'>('all');
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const creatingRef = useRef(false);
  const queryClient = useQueryClient();
  const accessToken = session?.access_token;

  const projects = useQuery({
    ...projectsListQuery(accessToken),
    enabled: Boolean(accessToken),
  });

  const createProject = useMutation({
    mutationFn: (request: CreateProjectRequest) =>
      apiFetch('/projects', ProjectSchema, {
        accessToken,
        method: 'POST',
        body: request,
      }),
    onSuccess: (created) => {
      queryClient.setQueryData<Project[]>(projectKeys.list, (current = []) => [
        created,
        ...current.filter((project) => project.id !== created.id),
      ]);
      setDialogOpen(false);
    },
    onSettled: () => {
      creatingRef.current = false;
    },
  });

  const openCreate = () => {
    createProject.reset();
    setDialogOpen(true);
  };

  const prefetchWorkspace = (projectId: string) => {
    void Promise.all([
      loadProjectOverviewRoute(),
      queryClient.prefetchQuery(projectDetailQuery(projectId, accessToken)),
      queryClient.prefetchQuery(projectWorkflowQuery(projectId, accessToken)),
    ]);
  };

  const closeDialog = () => {
    if (!createProject.isPending) {
      createProject.reset();
      setDialogOpen(false);
    }
  };

  const save = async (request: CreateProjectRequest) => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    await createProject.mutateAsync(CreateProjectRequestSchema.parse(request));
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const filteredProjects = useMemo(() => {
    const data = projects.data ?? [];
    const scoped = data.filter((project) => {
      if (scope === 'archives') return project.status === 'DONE';
      if (scope === 'mine')
        return project.lead.id === member?.id || project.isParticipating;
      return true;
    });

    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return scoped;

    return scoped.filter((project) => {
      const haystack = [
        project.name,
        project.description,
        project.lead.fullName,
        statusLabel(project.status),
        ...project.departments.map((d) => d.name),
        ...project.departments.map((d) => d.shortLabel),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [projects.data, scope, member?.id, search]);

  return (
    <section className="vw-projects-landing" aria-labelledby="projects-heading">
      <h1 id="projects-heading" className="projects-heading-sr">
        Projects
      </h1>

      <div className="vw-projects-toolbar">
        <div className="vw-project-search-wrap">
          <span className="vw-project-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            id="projects-search-input"
            type="search"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search projects"
            autoComplete="off"
          />
        </div>

        <div className="vw-projects-toolbar-actions">
          <div
            className="vw-project-scope-toggle"
            role="tablist"
            aria-label="Project scope"
            data-scope={scope}
          >
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'all'}
              className={`vw-project-scope-button ${scope === 'all' ? 'active' : ''}`}
              onClick={() => setScope('all')}
            >
              All Projects
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'mine'}
              className={`vw-project-scope-button ${scope === 'mine' ? 'active' : ''}`}
              onClick={() => setScope('mine')}
            >
              My Projects
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'archives'}
              className={`vw-project-scope-button ${scope === 'archives' ? 'active' : ''}`}
              onClick={() => setScope('archives')}
            >
              Archives
            </button>
          </div>

          <button
            type="button"
            className="vw-add-project-button"
            onClick={openCreate}
          >
            + Add Project
          </button>
        </div>
      </div>

      {projects.isPending ? (
        <div className="vw-projects-loading" aria-label="Loading projects">
          {[0, 1, 2].map((item) => (
            <div className="vw-projects-skeleton-group" key={item}>
              <div className="vw-skeleton-header" />
              <div className="vw-skeleton-row">
                <div className="vw-skeleton-card" />
                <div className="vw-skeleton-card" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.isError ? (
        <div className="projects-state-card" role="alert">
          <strong>Projects could not be loaded.</strong>
          <p>{errorMessage(projects.error)}</p>
          <button
            type="button"
            className="projects-secondary-button"
            onClick={() => void projects.refetch()}
          >
            Retry
          </button>
        </div>
      ) : scope === 'archives' ? (
        <section className="vw-archive-shell" aria-label="Archived projects">
          <header className="vw-archive-head">
            <div>
              <strong>Archived projects</strong>
              <span>
                Completed work is kept here as a readable project record.
              </span>
            </div>
            <div className="vw-archive-count">
              {filteredProjects.length} completed
            </div>
          </header>
          {filteredProjects.length > 0 ? (
            <div className="vw-archive-list">
              {filteredProjects.map((project) => (
                <article key={project.id} className="vw-archive-project-row">
                  <div>
                    <div className="vw-archive-project-title">
                      {project.name}
                    </div>
                    <div className="vw-archive-project-desc">
                      {project.description || 'Completed project.'}
                    </div>
                  </div>
                  <div className="vw-archive-meta">
                    <div className="vw-archive-meta-label">Project Lead</div>
                    <div className="vw-archive-meta-value">
                      {project.lead.fullName}
                    </div>
                  </div>
                  <div className="vw-archive-meta">
                    <div className="vw-archive-meta-label">Completed</div>
                    <div className="vw-archive-meta-value">
                      {formatCompletionDate(project.updatedAt)}
                    </div>
                    <div className="vw-archive-depts">
                      {project.departments.map((dept) => (
                        <span key={dept.id}>{dept.name}</span>
                      ))}
                    </div>
                  </div>
                  <Link
                    to={`/projects/${project.id}`}
                    className="vw-archive-open"
                    onMouseEnter={() => prefetchWorkspace(project.id)}
                    onFocus={() => prefetchWorkspace(project.id)}
                  >
                    View project →
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="vw-archive-empty">
              {search.trim()
                ? 'No completed projects match your search.'
                : 'No completed projects yet.'}
            </div>
          )}
        </section>
      ) : (
        <div className="vw-projects-board">
          {STATUS_GROUPS.map((group) => {
            const groupProjects = filteredProjects.filter(
              (p) => p.status === group.key,
            );
            const isCollapsed = Boolean(collapsedGroups[group.key]);

            return (
              <section
                key={group.key}
                className="vw-project-group"
                aria-labelledby={`group-title-${group.key}`}
              >
                <div className="vw-project-group-head">
                  <button
                    type="button"
                    className="vw-project-group-toggle"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={!isCollapsed}
                    aria-controls={`group-body-${group.key}`}
                  >
                    <span
                      className={`vw-group-chevron ${isCollapsed ? 'collapsed' : ''}`}
                      aria-hidden="true"
                    >
                      ▶
                    </span>
                    <span
                      className={`vw-group-status-icon status-${group.key.toLowerCase()}`}
                      aria-hidden="true"
                    >
                      {group.key === 'DONE' && (
                        <span className="vw-group-check">✓</span>
                      )}
                    </span>
                    <span
                      id={`group-title-${group.key}`}
                      className="vw-project-group-name"
                    >
                      {group.label}
                    </span>
                    <span className="vw-project-group-count">
                      {groupProjects.length}
                    </span>
                  </button>
                </div>

                {!isCollapsed && (
                  <div
                    id={`group-body-${group.key}`}
                    className="vw-project-group-body"
                  >
                    {groupProjects.length > 0 ? (
                      <div
                        className="vw-project-row"
                        role="region"
                        aria-label={`${group.label} projects`}
                      >
                        {groupProjects.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            currentMemberId={member?.id}
                            scope={scope}
                            onPrefetch={prefetchWorkspace}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="vw-project-group-empty">
                        {search.trim()
                          ? 'No matching projects in this section.'
                          : group.emptyText}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {dialogOpen && (
        <CreateProjectDialog
          accessToken={accessToken}
          isSaving={createProject.isPending}
          saveError={createProject.error}
          onClose={closeDialog}
          onSave={save}
        />
      )}
    </section>
  );
}
