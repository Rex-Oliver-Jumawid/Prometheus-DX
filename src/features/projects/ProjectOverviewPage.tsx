import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ProjectDetailResponseSchema,
  UpdateProjectStatusRequestSchema,
  type ProjectStatus,
} from '../../../shared/contracts/project';
import { useAuth } from '../auth/auth-context';
import { ApiRequestError, apiFetch } from '../../lib/api';
import './projects.css';

const projectsKey = ['projects', 'list'] as const;
const statusOptions: ProjectStatus[] = ['PLANNING', 'IN_PROGRESS', 'DONE'];

function statusLabel(status: ProjectStatus) {
  return status
    .split('_')
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(' ');
}

function formatTimestamp(value: string | null) {
  if (!value) return 'Not completed';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

export function ProjectOverviewPage() {
  const { projectId } = useParams();
  const { member, session } = useAuth();
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
    return <section className="project-overview-state" aria-label="Loading project"><div className="projects-skeleton" /><p>Loading project overview...</p></section>;
  }

  const isNotFound =
    !projectId ||
    (project.error instanceof ApiRequestError &&
      (project.error.statusCode === 400 || project.error.statusCode === 404));
  if (isNotFound) {
    return <section className="projects-state-card project-overview-state"><strong>Project not found</strong><p>This Project may have been removed, or the address is invalid.</p><Link className="projects-secondary-link" to="/projects">Back to Projects</Link></section>;
  }
  if (project.isError || !project.data) {
    return <section className="projects-state-card project-overview-state" role="alert"><strong>Project could not be loaded.</strong><p>{errorMessage(project.error)}</p><button type="button" className="projects-secondary-button" onClick={() => void project.refetch()}>Retry</button></section>;
  }

  const value = project.data;
  const isLead = value.lead.id === member?.id;
  const statusError = updateStatus.isError ? errorMessage(updateStatus.error) : null;
  return <section className="project-overview-page" aria-labelledby="project-overview-title">
    <Link className="project-back-link" to="/projects">Projects</Link>
    <header className="project-overview-header">
      <div>
        <p className="projects-kicker">PROJECT OVERVIEW</p>
        <h1 id="project-overview-title">{value.name}</h1>
        <p>{value.description}</p>
      </div>
      <div className="project-status-panel">
        <span className={`project-status ${value.status.toLowerCase()}`}>{statusLabel(value.status)}</span>
        {isLead ? <label className="project-status-control">Change status<select aria-label="Project status" value={value.status} disabled={updateStatus.isPending} onChange={(event) => void updateStatus.mutateAsync(event.target.value as ProjectStatus)}>{statusOptions.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label> : <p>You can view this Project's status. Only the assigned Project Lead can change it.</p>}
      </div>
    </header>
    {statusError && <p className="project-status-error" role="alert">{statusError}</p>}
    <div className="project-overview-grid">
      <section className="project-overview-card" aria-labelledby="project-people-title"><h2 id="project-people-title">Project ownership</h2><dl><div><dt>Project Lead</dt><dd>{value.lead.fullName}<span>{value.lead.email}</span></dd></div><div><dt>Created by</dt><dd>{value.creator.fullName}<span>{value.creator.email}</span></dd></div></dl><p className="project-ownership-note">Creator information is retained for audit history. Project Lead authority comes only from the assigned Lead relationship.</p></section>
      <section className="project-overview-card" aria-labelledby="project-departments-title"><h2 id="project-departments-title">Associated Departments</h2><div className="project-detail-departments">{value.departments.map((department) => <span key={department.id} title={department.name}>{department.name} <small>{department.shortLabel}</small></span>)}</div></section>
      <section className="project-overview-card" aria-labelledby="project-timestamps-title"><h2 id="project-timestamps-title">Project timeline</h2><dl><div><dt>Created</dt><dd><time dateTime={value.createdAt}>{formatTimestamp(value.createdAt)}</time></dd></div><div><dt>Last updated</dt><dd><time dateTime={value.updatedAt}>{formatTimestamp(value.updatedAt)}</time></dd></div><div><dt>Completed</dt><dd>{value.doneAt ? <time dateTime={value.doneAt}>{formatTimestamp(value.doneAt)}</time> : 'Not completed'}</dd></div></dl></section>
    </div>
  </section>;
}
