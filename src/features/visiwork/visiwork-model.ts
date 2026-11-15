import type {
  Project,
  ProjectVentureSummary,
} from '../../../shared/contracts/project';
import type {
  Outcome,
  ProjectWorkflowResponse,
  Stage,
} from '../../../shared/contracts/project-workflow';
import type { TeamWorkSummaryResponse } from '../../../shared/contracts/work-session';

export type VisiWorkStatusGroup = 'PLANNING' | 'IN_PROGRESS' | 'DONE';

export interface VisiWorkMember {
  id: string;
  fullName: string;
  position: string | null;
  profileImagePath: string | null;
  workingNow: boolean;
}

export interface VisiWorkOutcome {
  id: string;
  projectId: string;
  stageId: string;
  title: string;
  description: string | null;
  lifecycleStatus: Outcome['lifecycleStatus'];
  memberNames: string[];
  ventureIds: string[];
}

export interface VisiWorkStage {
  id: string;
  name: string;
  description: string | null;
  outcomes: VisiWorkOutcome[];
}

export interface VisiWorkProject {
  id: string;
  name: string;
  description: string;
  status: Project['status'];
  progress: number;
  totalOutcomes: number;
  openOutcomes: number;
  activeStagesCount: number;
  ventures: Project['ventures'];
  memberNames: string[];
  workingMemberNames: string[];
  currentStageName: string | null;
  stages: VisiWorkStage[];
  isParticipating: boolean;
}

export interface VisiWorkVenture {
  id: string;
  name: string;
  shortLabel: string;
  members: VisiWorkMember[];
  workingMembers: VisiWorkMember[];
  projects: VisiWorkProject[];
}

export interface VisiWorkModel {
  ventures: VisiWorkVenture[];
  projects: VisiWorkProject[];
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizedStatus(status: Project['status']): VisiWorkStatusGroup {
  if (status === 'PLANNING') return 'PLANNING';
  if (status === 'IN_PROGRESS') return 'IN_PROGRESS';
  return 'DONE';
}

function workflowByProject(
  workflows: ProjectWorkflowResponse[],
): Map<string, ProjectWorkflowResponse> {
  return new Map(workflows.map((workflow) => [workflow.projectId, workflow]));
}

function membersForWorkflow(
  project: Project,
  workflow: ProjectWorkflowResponse | undefined,
): Array<{ id: string; fullName: string }> {
  const members = new Map<string, { id: string; fullName: string }>();
  members.set(project.lead.id, {
    id: project.lead.id,
    fullName: project.lead.fullName,
  });
  for (const stage of workflow?.stages ?? []) {
    for (const outcome of stage.outcomes) {
      for (const member of outcome.members) {
        members.set(member.id, { id: member.id, fullName: member.fullName });
      }
    }
  }
  return [...members.values()];
}

function currentStageName(workflow: ProjectWorkflowResponse | undefined): string | null {
  if (!workflow?.stages.length) return null;
  const active = workflow.stages.find((stage) =>
    stage.outcomes.some((outcome) => outcome.lifecycleStatus !== 'ACCEPTED'),
  );
  return active?.name ?? workflow.stages.at(-1)?.name ?? null;
}

function toStages(
  projectId: string,
  stages: Stage[],
): VisiWorkStage[] {
  return stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    description: stage.description,
    outcomes: stage.outcomes.map((outcome) => ({
      id: outcome.id,
      projectId,
      stageId: stage.id,
      title: outcome.title,
      description: outcome.description,
      lifecycleStatus: outcome.lifecycleStatus,
      memberNames: uniq(outcome.members.map((member) => member.fullName)),
      ventureIds: outcome.ventures.map((venture) => venture.id),
    })),
  }));
}

export function buildVisiWorkModel(
  projects: Project[],
  workflows: ProjectWorkflowResponse[],
  team: TeamWorkSummaryResponse,
  ventureOptions: ProjectVentureSummary[] = [],
): VisiWorkModel {
  const workflowsByProject = workflowByProject(workflows);
  const teamById = new Map(team.members.map((member) => [member.id, member]));

  const projectModels: VisiWorkProject[] = projects.map((project) => {
    const workflow = workflowsByProject.get(project.id);
    const participants = membersForWorkflow(project, workflow);
    const memberNames = participants.map((member) => member.fullName);
    const projectVentureIds = new Set(
      project.ventures.map((venture) => venture.id),
    );
    const workingMemberNames = participants
      .filter((member) => {
        const teamMember = teamById.get(member.id);
        if (!teamMember?.workingNow) return false;
        const focusedVentureId =
          teamMember.visiworkVentureId ?? teamMember.venture?.id;
        return Boolean(focusedVentureId && projectVentureIds.has(focusedVentureId));
      })
      .map((member) => member.fullName);
    const metrics = project.metrics;

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      progress:
        metrics?.progressPercentage ?? (project.status === 'DONE' ? 100 : 0),
      totalOutcomes: metrics?.totalOutcomes ?? 0,
      openOutcomes: metrics?.openOutcomes ?? 0,
      activeStagesCount: metrics?.activeStagesCount ?? 0,
      ventures: project.ventures,
      memberNames,
      workingMemberNames,
      currentStageName: currentStageName(workflow),
      stages: toStages(project.id, workflow?.stages ?? []),
      isParticipating: project.isParticipating,
    };
  });

  const ventureMap = new Map<
    string,
    { id: string; name: string; shortLabel: string }
  >();

  for (const venture of ventureOptions) {
    ventureMap.set(venture.id, venture);
  }
  for (const member of team.members) {
    if (member.venture) ventureMap.set(member.venture.id, member.venture);
    for (const venture of member.ventures ?? []) ventureMap.set(venture.id, venture);
  }
  for (const project of projects) {
    for (const venture of project.ventures) {
      ventureMap.set(venture.id, venture);
    }
  }

  const ventures = [...ventureMap.values()]
    .map((venture): VisiWorkVenture => {
      const members = team.members
        .filter((member) => {
          const focusedVentureId =
            member.visiworkVentureId ?? member.venture?.id;
          // VisiWork membership represents the member's current working room,
          // not their Registry/home venture. The home venture remains
          // unchanged in the database.
          return focusedVentureId === venture.id;
        })
        .map((member) => ({
          id: member.id,
          fullName: member.fullName,
          position: member.position,
          profileImagePath: member.profileImagePath,
          workingNow: member.workingNow,
        }))
        .sort(
          (left, right) =>
            Number(right.workingNow) - Number(left.workingNow) ||
            left.fullName.localeCompare(right.fullName),
        );
      const ventureProjects = projectModels.filter(
        (project) =>
          project.status !== 'ARCHIVED' &&
          project.ventures.some((item) => item.id === venture.id),
      );

      return {
        ...venture,
        members,
        workingMembers: members.filter((member) => member.workingNow),
        projects: ventureProjects,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    ventures,
    projects: projectModels,
  };
}

export function ventureStages(
  project: VisiWorkProject,
  ventureId: string,
): VisiWorkStage[] {
  return project.stages
    .map((stage) => ({
      ...stage,
      outcomes: stage.outcomes.filter((outcome) =>
        outcome.ventureIds.includes(ventureId),
      ),
    }))
    .filter((stage) => stage.outcomes.length > 0);
}

export function groupVentureProjects(
  venture: VisiWorkVenture,
): Record<VisiWorkStatusGroup, VisiWorkProject[]> {
  const groups: Record<VisiWorkStatusGroup, VisiWorkProject[]> = {
    PLANNING: [],
    IN_PROGRESS: [],
    DONE: [],
  };

  for (const project of venture.projects) {
    groups[normalizedStatus(project.status)].push(project);
  }

  return groups;
}

export function projectStatusLabel(status: Project['status']): string {
  return status
    .split('_')
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(' ');
}
