import type { Project } from '../../../shared/contracts/project';
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
  departmentIds: string[];
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
  departments: Project['departments'];
  memberNames: string[];
  workingMemberNames: string[];
  currentStageName: string | null;
  stages: VisiWorkStage[];
  isParticipating: boolean;
}

export interface VisiWorkDepartment {
  id: string;
  name: string;
  shortLabel: string;
  members: VisiWorkMember[];
  workingMembers: VisiWorkMember[];
  projects: VisiWorkProject[];
}

export interface VisiWorkModel {
  departments: VisiWorkDepartment[];
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
      departmentIds: outcome.departments.map((department) => department.id),
    })),
  }));
}

export function buildVisiWorkModel(
  projects: Project[],
  workflows: ProjectWorkflowResponse[],
  team: TeamWorkSummaryResponse,
): VisiWorkModel {
  const workflowsByProject = workflowByProject(workflows);
  const teamById = new Map(team.members.map((member) => [member.id, member]));

  const projectModels: VisiWorkProject[] = projects.map((project) => {
    const workflow = workflowsByProject.get(project.id);
    const participants = membersForWorkflow(project, workflow);
    const memberNames = participants.map((member) => member.fullName);
    const projectDepartmentIds = new Set(
      project.departments.map((department) => department.id),
    );
    const workingMemberNames = participants
      .filter((member) => {
        const teamMember = teamById.get(member.id);
        if (!teamMember?.workingNow) return false;
        const focusedDepartmentId =
          teamMember.visiworkDepartmentId ?? teamMember.department.id;
        return projectDepartmentIds.has(focusedDepartmentId);
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
      departments: project.departments,
      memberNames,
      workingMemberNames,
      currentStageName: currentStageName(workflow),
      stages: toStages(project.id, workflow?.stages ?? []),
      isParticipating: project.isParticipating,
    };
  });

  const departmentMap = new Map<
    string,
    { id: string; name: string; shortLabel: string }
  >();

  for (const member of team.members) {
    departmentMap.set(member.department.id, member.department);
  }
  for (const project of projects) {
    for (const department of project.departments) {
      departmentMap.set(department.id, department);
    }
  }

  const departments = [...departmentMap.values()]
    .map((department): VisiWorkDepartment => {
      const members = team.members
        .filter(
          (member) =>
            member.department.id === department.id ||
            member.visiworkDepartmentId === department.id,
        )
        .map((member) => {
          const focusedDepartmentId =
            member.visiworkDepartmentId ?? member.department.id;
          return {
            id: member.id,
            fullName: member.fullName,
            position: member.position,
            workingNow:
              member.workingNow && focusedDepartmentId === department.id,
          };
        })
        .sort(
          (left, right) =>
            Number(right.workingNow) - Number(left.workingNow) ||
            left.fullName.localeCompare(right.fullName),
        );
      const departmentProjects = projectModels.filter(
        (project) =>
          project.status !== 'ARCHIVED' &&
          project.departments.some((item) => item.id === department.id),
      );

      return {
        ...department,
        members,
        workingMembers: members.filter((member) => member.workingNow),
        projects: departmentProjects,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    departments,
    projects: projectModels,
  };
}

export function departmentStages(
  project: VisiWorkProject,
  departmentId: string,
): VisiWorkStage[] {
  return project.stages
    .map((stage) => ({
      ...stage,
      outcomes: stage.outcomes.filter((outcome) =>
        outcome.departmentIds.includes(departmentId),
      ),
    }))
    .filter((stage) => stage.outcomes.length > 0);
}

export function groupDepartmentProjects(
  department: VisiWorkDepartment,
): Record<VisiWorkStatusGroup, VisiWorkProject[]> {
  const groups: Record<VisiWorkStatusGroup, VisiWorkProject[]> = {
    PLANNING: [],
    IN_PROGRESS: [],
    DONE: [],
  };

  for (const project of department.projects) {
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
