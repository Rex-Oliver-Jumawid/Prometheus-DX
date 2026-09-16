import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CreateProjectRequestSchema, ProjectListResponseSchema, ProjectSchema, type CreateProjectRequest } from '../../../shared/contracts/project';
import { useAuth } from '../auth/auth-context';
import { apiFetch } from '../../lib/api';
import { CreateProjectDialog } from './CreateProjectDialog';
import './projects.css';

const projectsKey = ['projects', 'list'] as const;
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
function statusLabel(status: string) { return status.split('_').map((word) => word[0] + word.slice(1).toLowerCase()).join(' '); }

export function ProjectsPage() {
  const { member, session } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scope, setScope] = useState<'all' | 'mine' | 'leading' | 'participating'>('all');
  const creatingRef = useRef(false);
  const queryClient = useQueryClient();
  const accessToken = session?.access_token;
  const projects = useQuery({ queryKey: projectsKey, queryFn: ({ signal }) => apiFetch('/projects', ProjectListResponseSchema, { accessToken, signal }), retry: false });
  const createProject = useMutation({
    mutationFn: (request: CreateProjectRequest) => apiFetch('/projects', ProjectSchema, { accessToken, method: 'POST', body: request }),
    onSuccess: async () => { setDialogOpen(false); await queryClient.invalidateQueries({ queryKey: projectsKey }); },
    onSettled: () => { creatingRef.current = false; },
  });
  const visibleProjects = projects.data?.filter((project) => {
    if (scope === 'all') return true;
    if (scope === 'leading') return project.lead.id === member?.id;
    if (scope === 'mine') return project.lead.id === member?.id || project.creator.id === member?.id;
    return false;
  }) ?? [];
  const openCreate = () => { createProject.reset(); setDialogOpen(true); };
  const closeDialog = () => { if (!createProject.isPending) { createProject.reset(); setDialogOpen(false); } };
  const save = async (request: CreateProjectRequest) => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    await createProject.mutateAsync(CreateProjectRequestSchema.parse(request));
  };
  return <section className="projects-page" aria-labelledby="projects-title">
    <header className="projects-page-header"><div><p className="projects-kicker">PROJECT WORKSPACE</p><h1 id="projects-title">Projects</h1><p>Discover company projects and start new work with the right Lead and departments.</p></div><button type="button" className="projects-primary-button" onClick={openCreate}>+ Add Project</button></header>
    <div className="projects-toolbar" role="tablist" aria-label="Project filters">
      {([['all', 'All Projects'], ['mine', 'My Projects'], ['leading', 'Leading'], ['participating', 'Participating']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={scope === value} className={scope === value ? 'active' : ''} onClick={() => setScope(value)}>{label}</button>)}
    </div>
    {scope === 'participating' ? <div className="projects-state-card"><strong>Participation will appear once outcome membership is available.</strong><p>Phase 4 will derive project participation from persisted Outcome Membership. No participation data is fabricated here.</p></div> : projects.isPending ? <div className="projects-grid" aria-label="Loading projects">{[0, 1, 2].map((item) => <div className="projects-skeleton" key={item} />)}</div> : projects.isError ? <div className="projects-state-card" role="alert"><strong>Projects could not be loaded.</strong><p>{errorMessage(projects.error)}</p><button type="button" className="projects-secondary-button" onClick={() => void projects.refetch()}>Retry</button></div> : visibleProjects.length === 0 ? <div className="projects-state-card"><strong>{scope === 'all' ? 'No projects yet' : 'No matching projects'}</strong><p>{scope === 'all' ? 'Create the first Project for your workspace.' : scope === 'mine' ? 'My Projects currently shows projects you created or lead. Creation alone grants no authority.' : 'You are not the Project Lead of a Project yet.'}</p>{scope === 'all' && <button type="button" className="projects-secondary-button" onClick={openCreate}>Add Project</button>}</div> : <div className="projects-grid">{visibleProjects.map((project) => <article className="project-card" key={project.id}><header><span className={`project-status ${project.status.toLowerCase()}`}>{statusLabel(project.status)}</span><time dateTime={project.updatedAt}>Updated {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(project.updatedAt))}</time></header><h2>{project.name}</h2><p>{project.description}</p><dl><div><dt>Project Lead</dt><dd>{project.lead.fullName}</dd></div><div><dt>Departments</dt><dd className="project-departments">{project.departments.map((department) => <span key={department.id} title={department.name}>{department.shortLabel}</span>)}</dd></div></dl><Link className="project-open-link" to={`/projects/${project.id}`}>Open Project<span aria-hidden="true">→</span></Link></article>)}</div>}
    {dialogOpen && <CreateProjectDialog accessToken={accessToken} isSaving={createProject.isPending} saveError={createProject.error} onClose={closeDialog} onSave={save} />}
  </section>;
}
