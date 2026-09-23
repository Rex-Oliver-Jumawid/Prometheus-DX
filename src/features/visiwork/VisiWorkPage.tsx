import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OutcomeWorkSchema, type OutcomeWork } from '../../../shared/contracts/outcome-work';
import {
  SetVisiWorkPresenceRequestSchema,
  VisiWorkPresenceResponseSchema,
} from '../../../shared/contracts/visiwork';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/auth-context';
import {
  projectWorkflowQuery,
  projectsListQuery,
} from '../projects/project-queries';
import {
  teamWorkKeys,
  teamWorkSummaryQuery,
} from '../work-sessions/work-session-queries';
import {
  buildVisiWorkModel,
  departmentStages,
  groupDepartmentProjects,
  projectStatusLabel,
  type VisiWorkDepartment,
  type VisiWorkMember,
  type VisiWorkOutcome,
  type VisiWorkProject,
  type VisiWorkStatusGroup,
} from './visiwork-model';
import './visiwork.css';

const groupLabels: Record<VisiWorkStatusGroup, string> = {
  PLANNING: 'Planning',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function DepartmentGlyph({ index }: { index: number }) {
  return (
    <span className="visiwork-department-glyph" aria-hidden="true">
      {index % 3 === 0 ? '⌁' : index % 3 === 1 ? '✦' : '◇'}
    </span>
  );
}

function WorkingChip({ name }: { name: string }) {
  return (
    <span className="visiwork-person-chip">
      <i aria-hidden="true" />
      {name}
    </span>
  );
}

function RoomPanel({
  roomType,
  title,
  subtitle,
  members,
}: {
  roomType: string;
  title: string;
  subtitle: string;
  members: VisiWorkMember[];
}) {
  const liveMembers = members.filter((member) => member.workingNow).slice(0, 3);

  return (
    <aside className="visiwork-room" aria-label={title}>
      <header className="visiwork-room-header">
        <div>
          <span>{roomType}</span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </div>
        <b>● LIVE</b>
      </header>
      <div className="visiwork-room-feed">
        {liveMembers.length ? (
          liveMembers.map((member) => (
            <div className="visiwork-room-message" key={member.id}>
              <span className="visiwork-room-avatar">{initials(member.fullName)}</span>
              <div>
                <small>{member.fullName} · LIVE PRESENCE</small>
                <p>
                  {member.position
                    ? member.position + ' is currently working.'
                    : 'Currently working in Prometheus.'}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="visiwork-room-empty">
            <span>Room is quiet right now.</span>
            <small>Live presence appears here when members time in.</small>
          </div>
        )}
      </div>
      <div className="visiwork-room-composer" aria-label="Room messaging preview">
        <input
          disabled
          aria-label={'Message ' + title}
          placeholder="Messaging arrives with collaboration"
        />
        <button type="button" disabled>
          Send
        </button>
      </div>
    </aside>
  );
}

function ViewSwitcher({ projectView }: { projectView: boolean }) {
  const [, setSearchParams] = useSearchParams();

  return (
    <div className="visiwork-switcher" aria-label="VisiWork view">
      <button
        type="button"
        className={projectView ? '' : 'active'}
        aria-pressed={!projectView}
        onClick={() => setSearchParams({})}
      >
        Department
      </button>
      <button
        type="button"
        className={projectView ? 'active' : ''}
        aria-pressed={projectView}
        onClick={() => setSearchParams({ view: 'projects' })}
      >
        Projects
      </button>
    </div>
  );
}

function BirdViewBreadcrumb({ projectView }: { projectView: boolean }) {
  return (
    <nav className="visiwork-breadcrumb" aria-label="VisiWork breadcrumb">
      <span>VisiWork</span>
      <i>/</i>
      <strong>{projectView ? 'Projects' : "Bird's View"}</strong>
    </nav>
  );
}

function DepartmentCard({
  department,
  index,
  joined,
  joining,
  joinError,
  onJoin,
  onEnter,
}: {
  department: VisiWorkDepartment;
  index: number;
  joined: boolean;
  joining: boolean;
  joinError: string | null;
  onJoin: () => void;
  onEnter: () => void;
}) {
  const visibleMembers = department.members.slice(0, 3);
  const visibleProjects = department.projects.slice(0, 4);

  return (
    <article className="visiwork-department-card">
      <header>
        <div className="visiwork-department-title">
          <DepartmentGlyph index={index} />
          <div>
            <strong>{department.name}</strong>
            <small>Projects, people, and delivery activity.</small>
          </div>
        </div>
        <span className="visiwork-working-count">
          <i aria-hidden="true" />
          {department.workingMembers.length} working
        </span>
      </header>

      <div className="visiwork-presence-row">
        {visibleMembers.length ? (
          visibleMembers.map((member) => (
            <div className="visiwork-presence-card" key={member.id}>
              <strong title={member.fullName}>{member.fullName}</strong>
              <span className={member.workingNow ? 'working' : ''}>
                <i aria-hidden="true" />
                {member.workingNow ? 'Currently working' : 'Not working'}
              </span>
            </div>
          ))
        ) : (
          <div className="visiwork-card-empty">No active members assigned.</div>
        )}
      </div>

      <div className="visiwork-department-projects">
        {visibleProjects.length ? (
          visibleProjects.map((project) => (
            <div className="visiwork-mini-project" key={project.id}>
              <span
                className="visiwork-mini-progress"
                style={{ width: clampPercent(project.progress) + '%' }}
                aria-hidden="true"
              />
              <div className="visiwork-mini-project-heading">
                <strong title={project.name}>{project.name}</strong>
                <b>{clampPercent(project.progress)}%</b>
              </div>
              <p title={project.description}>{project.description}</p>
              <div className="visiwork-mini-project-people">
                {(project.workingMemberNames.length
                  ? project.workingMemberNames
                  : project.memberNames
                )
                  .slice(0, 2)
                  .map((name) => (
                    <WorkingChip key={name} name={name} />
                  ))}
              </div>
            </div>
          ))
        ) : (
          <div className="visiwork-card-empty">No active projects assigned.</div>
        )}
      </div>

      <footer>
        <span>
          {department.projects.length} active project
          {department.projects.length === 1 ? '' : 's'}
        </span>
        <button
          className={joined ? 'visiwork-join-button joined' : 'visiwork-join-button'}
          type="button"
          disabled={joining || joined}
          aria-pressed={joined}
          title={joinError ?? (joined ? 'You are working in this department.' : undefined)}
          onClick={onJoin}
        >
          {joining ? 'Joining...' : joined ? 'Joined' : 'Join'}
        </button>
        <button className="visiwork-enter-button" type="button" onClick={onEnter}>
          Enter {department.shortLabel} →
        </button>
      </footer>
    </article>
  );
}

function ProjectCard({ project }: { project: VisiWorkProject }) {
  const participants = project.workingMemberNames.length
    ? project.workingMemberNames
    : project.memberNames;

  return (
    <article className="visiwork-project-card">
      <header>
        <span>{project.isParticipating ? 'PRIMARY WORKSPACE' : 'COMPANY PROJECT'}</span>
        <b>{projectStatusLabel(project.status).toUpperCase()}</b>
      </header>
      <h2>{project.name}</h2>
      <p>{project.description}</p>

      <div className="visiwork-project-progress">
        <div>
          <span>OVERALL PROJECT PROGRESS</span>
          <strong>{clampPercent(project.progress)}%</strong>
        </div>
        <div className="visiwork-progress-track" aria-hidden="true">
          <i style={{ width: clampPercent(project.progress) + '%' }} />
        </div>
      </div>

      <div className="visiwork-project-metrics">
        <div>
          <span>OPEN OUTCOMES</span>
          <strong>
            {project.openOutcomes} / {project.totalOutcomes} outcomes
          </strong>
        </div>
        <div>
          <span>ACTIVE STAGES</span>
          <strong>
            {project.activeStagesCount} stage
            {project.activeStagesCount === 1 ? '' : 's'}
          </strong>
        </div>
      </div>

      <div className="visiwork-tag-row">
        {project.departments.slice(0, 4).map((department) => (
          <span key={department.id}>{department.shortLabel}</span>
        ))}
      </div>
      <div className="visiwork-project-people">
        {participants.slice(0, 3).map((name) => (
          <WorkingChip key={name} name={name} />
        ))}
      </div>
      <div className="visiwork-current-stage">
        <strong>Current:</strong>{' '}
        <span>{project.currentStageName ?? 'No active stage'}</span>
      </div>

      <footer>
        <span>
          {project.departments.length} department
          {project.departments.length === 1 ? '' : 's'} involved
        </span>
        <Link to={'/projects/' + project.id}>Open Workspace →</Link>
      </footer>
    </article>
  );
}

function outcomeState(
  outcome: VisiWorkOutcome,
  work: OutcomeWork | undefined,
): { label: string; progress: number } {
  if (outcome.lifecycleStatus === 'ACCEPTED') {
    return { label: 'Accepted', progress: 100 };
  }
  const progress = clampPercent(work?.progress ?? 0);
  if (outcome.lifecycleStatus === 'NEEDS_REVISION') {
    return { label: 'Needs revision', progress };
  }
  if (progress > 0) return { label: 'In progress', progress };
  return { label: 'Planned', progress };
}

function DepartmentProjectDetail({
  project,
  departmentId,
  workByOutcome,
}: {
  project: VisiWorkProject;
  departmentId: string;
  workByOutcome: Map<string, OutcomeWork>;
}) {
  const stages = departmentStages(project, departmentId);

  return (
    <article className="visiwork-department-project-detail">
      <div className="visiwork-department-project-summary">
        <div>
          <strong>{project.name}</strong>
          <p>{project.description}</p>
        </div>
        <div className="visiwork-project-inline-progress">
          <div className="visiwork-progress-track" aria-hidden="true">
            <i style={{ width: clampPercent(project.progress) + '%' }} />
          </div>
          <span>{clampPercent(project.progress)}%</span>
        </div>
      </div>

      {stages.length ? (
        stages.map((stage) => {
          const openCount = stage.outcomes.filter(
            (outcome) => outcome.lifecycleStatus !== 'ACCEPTED',
          ).length;
          return (
            <section className="visiwork-stage" key={stage.id}>
              <header>
                <strong>{stage.name}</strong>
                <span>
                  {openCount} open / {stage.outcomes.length} assigned
                </span>
              </header>
              <div className="visiwork-outcome-list">
                {stage.outcomes.map((outcome) => {
                  const state = outcomeState(
                    outcome,
                    workByOutcome.get(outcome.id),
                  );
                  return (
                    <div className="visiwork-outcome" key={outcome.id}>
                      <div>
                        <strong>{outcome.title}</strong>
                        <div className="visiwork-outcome-people">
                          {outcome.memberNames.slice(0, 3).map((name) => (
                            <span key={name}>{name}</span>
                          ))}
                        </div>
                      </div>
                      <span>
                        {state.label} · {state.progress}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      ) : (
        <div className="visiwork-detail-empty">
          No outcomes are assigned to this department in this project yet.
        </div>
      )}
    </article>
  );
}

function DepartmentView({
  department,
  workByOutcome,
  onBack,
}: {
  department: VisiWorkDepartment;
  workByOutcome: Map<string, OutcomeWork>;
  onBack: () => void;
}) {
  const groups = groupDepartmentProjects(department);
  const [expanded, setExpanded] = useState<Record<VisiWorkStatusGroup, boolean>>({
    PLANNING: true,
    IN_PROGRESS: false,
    DONE: true,
  });

  return (
    <div className="visiwork-department-view">
      <div className="visiwork-detail-toolbar">
        <button type="button" onClick={onBack}>
          ← Back to Bird&apos;s View
        </button>
        <nav className="visiwork-breadcrumb" aria-label="VisiWork breadcrumb">
          <span>VisiWork</span>
          <i>/</i>
          <button type="button" onClick={onBack}>
            Bird&apos;s View
          </button>
          <i>›</i>
          <strong>{department.shortLabel}</strong>
        </nav>
      </div>

      <div className="visiwork-main-grid visiwork-detail-grid">
        <section className="visiwork-detail-panel">
          <header className="visiwork-detail-heading">
            <div>
              <h1>{department.name} Department View</h1>
              <p>Projects, stages, and outcomes this department is responsible for.</p>
            </div>
            <span>VIEW ONLY</span>
          </header>

          <div className="visiwork-status-groups">
            {(Object.keys(groupLabels) as VisiWorkStatusGroup[]).map((status) => {
              const isExpanded = expanded[status];
              return (
                <section className="visiwork-status-group" key={status}>
                  <button
                    type="button"
                    className="visiwork-status-heading"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpanded((current) => ({
                        ...current,
                        [status]: !current[status],
                      }))
                    }
                  >
                    <span>{isExpanded ? '▼' : '▶'}</span>
                    <i className={status.toLowerCase()} aria-hidden="true">
                      {status === 'DONE' ? '✓' : ''}
                    </i>
                    <strong>{groupLabels[status]}</strong>
                    <b>{groups[status].length}</b>
                  </button>
                  {isExpanded && (
                    <div className="visiwork-status-body">
                      {groups[status].length ? (
                        groups[status].map((project) => (
                          <DepartmentProjectDetail
                            key={project.id}
                            project={project}
                            departmentId={department.id}
                            workByOutcome={workByOutcome}
                          />
                        ))
                      ) : (
                        <div className="visiwork-detail-empty">
                          No {groupLabels[status].toLowerCase()} projects.
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>

        <RoomPanel
          roomType="DEPARTMENT ROOM"
          title={department.shortLabel + ' Chat'}
          subtitle={department.workingMembers.length + ' members currently working'}
          members={department.members}
        />
      </div>
    </div>
  );
}

function VisiWorkSkeleton() {
  return (
    <section className="visiwork-page visiwork-skeleton" role="status" aria-label="Loading VisiWork">
      <div className="visiwork-skeleton-toolbar" />
      <div className="visiwork-main-grid">
        <div className="visiwork-birds-panel">
          <div className="visiwork-department-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="visiwork-skeleton-card" key={index} />
            ))}
          </div>
        </div>
        <div className="visiwork-skeleton-room" />
      </div>
    </section>
  );
}

export function VisiWorkPage() {
  const { member, session } = useAuth();
  const queryClient = useQueryClient();
  const accessToken = session?.access_token;
  const [searchParams, setSearchParams] = useSearchParams();
  const projectView = searchParams.get('view') === 'projects';
  const selectedDepartmentId = searchParams.get('department');

  const projects = useQuery(projectsListQuery(accessToken));
  const team = useQuery({
    ...teamWorkSummaryQuery(accessToken),
    refetchInterval: 30_000,
  });
  const joinDepartment = useMutation({
    mutationFn: (departmentId: string) =>
      apiFetch('/visiwork/presence', VisiWorkPresenceResponseSchema, {
        accessToken,
        method: 'PUT',
        body: SetVisiWorkPresenceRequestSchema.parse({ departmentId }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: teamWorkKeys.all }),
  });
  const workflowQueries = useQueries({
    queries: (projects.data ?? []).map((project) =>
      projectWorkflowQuery(project.id, accessToken),
    ),
  });

  const workflows = workflowQueries.flatMap((query) =>
    query.data ? [query.data] : [],
  );
  const waitingForWorkflows =
    Boolean(projects.data?.length) && workflowQueries.some((query) => query.isPending);
  const workflowError = workflowQueries.find((query) => query.isError)?.error;

  const model = team.data
    ? buildVisiWorkModel(projects.data ?? [], workflows, team.data)
    : null;

  const selectedDepartment = model?.departments.find(
    (department) => department.id === selectedDepartmentId,
  );

  const departmentOutcomeRefs = (() => {
    if (!selectedDepartment) return [];
    const refs = new Map<string, { projectId: string; outcomeId: string }>();
    for (const project of selectedDepartment.projects) {
      for (const stage of departmentStages(project, selectedDepartment.id)) {
        for (const outcome of stage.outcomes) {
          refs.set(outcome.id, {
            projectId: project.id,
            outcomeId: outcome.id,
          });
        }
      }
    }
    return [...refs.values()];
  })();

  const outcomeWorkQueries = useQueries({
    queries: departmentOutcomeRefs.map((ref) => ({
      queryKey: ['visiwork', 'outcome-work', ref.projectId, ref.outcomeId],
      queryFn: () =>
        apiFetch(
          '/projects/' + ref.projectId + '/outcomes/' + ref.outcomeId + '/work',
          OutcomeWorkSchema,
          { accessToken },
        ),
      staleTime: 15_000,
      retry: false,
      enabled: Boolean(accessToken),
    })),
  });

  const workByOutcome = new Map<string, OutcomeWork>();
  departmentOutcomeRefs.forEach((ref, index) => {
    const data = outcomeWorkQueries[index]?.data;
    if (data) workByOutcome.set(ref.outcomeId, data);
  });

  if (projects.isPending || team.isPending || waitingForWorkflows) {
    return <VisiWorkSkeleton />;
  }

  if (projects.isError || team.isError || workflowError || !team.data || !model) {
    const message =
      projects.error?.message ??
      team.error?.message ??
      (workflowError instanceof Error ? workflowError.message : null) ??
      'VisiWork data could not be loaded.';
    return (
      <section className="visiwork-state" role="alert">
        <span>OPERATIONAL VISIBILITY</span>
        <h1>VisiWork could not be loaded</h1>
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

  const allMembers: VisiWorkMember[] = team.data.members.map((teamMember) => ({
    id: teamMember.id,
    fullName: teamMember.fullName,
    position: teamMember.position,
    workingNow: teamMember.workingNow,
  }));
  const currentTeamMember = team.data.members.find(
    (teamMember) => teamMember.id === member?.id,
  );
  const joinedDepartmentId = currentTeamMember?.visiworkDepartmentId ?? null;

  if (selectedDepartmentId) {
    if (!selectedDepartment) {
      return (
        <section className="visiwork-state">
          <span>OPERATIONAL VISIBILITY</span>
          <h1>Department not found</h1>
          <p>The selected department is no longer available in VisiWork.</p>
          <button type="button" onClick={() => setSearchParams({})}>
            Back to Bird&apos;s View
          </button>
        </section>
      );
    }

    return (
      <DepartmentView
        department={selectedDepartment}
        workByOutcome={workByOutcome}
        onBack={() => setSearchParams({})}
      />
    );
  }

  return (
    <section className="visiwork-page" aria-label="VisiWork Bird's View">
      <div className="visiwork-toolbar">
        <ViewSwitcher projectView={projectView} />
        <BirdViewBreadcrumb projectView={projectView} />
      </div>

      <div className="visiwork-main-grid">
        <section className="visiwork-birds-panel">
          {projectView ? (
            model.projects.length ? (
              <div className="visiwork-project-grid">
                {model.projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className="visiwork-empty-state">No projects are available yet.</div>
            )
          ) : model.departments.length ? (
            <div className="visiwork-department-grid">
              {model.departments.map((department, index) => (
                <DepartmentCard
                  key={department.id}
                  department={department}
                  index={index}
                  joined={joinedDepartmentId === department.id}
                  joining={
                    joinDepartment.isPending &&
                    joinDepartment.variables === department.id
                  }
                  joinError={
                    joinDepartment.isError &&
                    joinDepartment.variables === department.id
                      ? joinDepartment.error.message
                      : null
                  }
                  onJoin={() => joinDepartment.mutate(department.id)}
                  onEnter={() =>
                    setSearchParams({ department: department.id })
                  }
                />
              ))}
            </div>
          ) : (
            <div className="visiwork-empty-state">No departments are available yet.</div>
          )}
        </section>

        <RoomPanel
          roomType="GENERAL ROOM"
          title="General Chat"
          subtitle={team.data.summary.workingNowCount + ' working now · company-wide'}
          members={allMembers}
        />
      </div>
    </section>
  );
}
