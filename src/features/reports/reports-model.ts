import type { Project } from '../../../shared/contracts/project';
import type { ProjectWorkflowResponse } from '../../../shared/contracts/project-workflow';
import type { TeamWorkSummaryResponse } from '../../../shared/contracts/work-session';

export interface ReportsFilters {
  projectId: string;
  departmentId: string;
}

export interface ProjectHealthRow {
  id: string;
  name: string;
  progress: number;
  accepted: number;
  total: number;
  status: string;
}

export interface PipelineMetric {
  key:
    | 'planned'
    | 'inProgress'
    | 'forReview'
    | 'needsRevision'
    | 'accepted'
    | 'locked';
  label: string;
  detail: string;
  value: number;
}

export interface CapacityRow {
  id: string;
  name: string;
  departmentId: string;
  actualSeconds: number;
  plannedSeconds: number;
  percent: number;
}

export interface DepartmentWorkloadRow {
  id: string;
  name: string;
  total: number;
  open: number;
  share: number;
}

export interface ReportsAnalyticsModel {
  projectProgress: number;
  projectCount: number;
  acceptedOutcomes: number;
  totalOutcomes: number;
  needsReview: number;
  needsRevision: number;
  actualSeconds: number;
  plannedSeconds: number;
  capacityPercent: number;
  projectHealth: ProjectHealthRow[];
  pipeline: PipelineMetric[];
  capacity: CapacityRow[];
  departments: DepartmentWorkloadRow[];
}

const projectStatusLabel = (status: Project['status']) =>
  ({
    PLANNING: 'Planning',
    IN_PROGRESS: 'Active',
    DONE: 'Completed',
    ARCHIVED: 'Archived',
  })[status];

const percent = (value: number, total: number) =>
  total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

export function buildReportsAnalyticsModel(
  projects: Project[],
  workflows: ProjectWorkflowResponse[],
  team: TeamWorkSummaryResponse,
  filters: ReportsFilters,
): ReportsAnalyticsModel {
  const workflowByProject = new Map(
    workflows.map((workflow) => [workflow.projectId, workflow]),
  );
  const scopedProjects = projects.filter(
    (project) =>
      (!filters.projectId || project.id === filters.projectId) &&
      (!filters.departmentId ||
        project.departments.some(
          (department) => department.id === filters.departmentId,
        )),
  );

  const scopedOutcomes = scopedProjects.flatMap((project) => {
    const workflow = workflowByProject.get(project.id);
    if (!workflow) return [];
    return workflow.stages.flatMap((stage) =>
      stage.outcomes
        .filter(
          (outcome) =>
            !filters.departmentId ||
            outcome.departments.some(
              (department) => department.id === filters.departmentId,
            ),
        )
        .map((outcome) => ({ project, outcome })),
    );
  });

  const projectHealth = scopedProjects.map((project) => {
    const outcomes = scopedOutcomes.filter(({ project: owner }) => owner.id === project.id);
    const accepted = outcomes.filter(
      ({ outcome }) => outcome.lifecycleStatus === 'ACCEPTED',
    ).length;
    const total = outcomes.length;
    const progress =
      filters.departmentId || !project.metrics
        ? percent(accepted, total)
        : project.metrics.progressPercentage;

    return {
      id: project.id,
      name: project.name,
      progress,
      accepted,
      total,
      status: projectStatusLabel(project.status),
    };
  });

  const acceptedOutcomes = scopedOutcomes.filter(
    ({ outcome }) => outcome.lifecycleStatus === 'ACCEPTED',
  ).length;
  const needsRevision = scopedOutcomes.filter(
    ({ outcome }) => outcome.lifecycleStatus === 'NEEDS_REVISION',
  ).length;
  const needsReview = scopedOutcomes.filter(
    ({ outcome }) =>
      outcome.lifecycleStatus === 'OPEN' && outcome.hasForReview,
  ).length;
  const locked = scopedOutcomes.filter(
    ({ outcome }) =>
      outcome.lifecycleStatus === 'OPEN' &&
      !outcome.hasForReview &&
      outcome.isLocked,
  ).length;
  const planned = scopedOutcomes.filter(
    ({ project, outcome }) =>
      outcome.lifecycleStatus === 'OPEN' &&
      !outcome.hasForReview &&
      !outcome.isLocked &&
      project.status === 'PLANNING',
  ).length;
  const inProgress = scopedOutcomes.filter(
    ({ project, outcome }) =>
      outcome.lifecycleStatus === 'OPEN' &&
      !outcome.hasForReview &&
      !outcome.isLocked &&
      project.status !== 'PLANNING',
  ).length;

  const capacityMembers = team.members.filter(
    (member) =>
      !filters.departmentId || member.department.id === filters.departmentId,
  );
  const actualSeconds = capacityMembers.reduce(
    (sum, member) => sum + member.actualWorkedSeconds,
    0,
  );
  const plannedSeconds = capacityMembers.reduce(
    (sum, member) => sum + member.scheduledMinutes * 60,
    0,
  );

  const capacity = capacityMembers
    .map((member) => ({
      id: member.id,
      name: member.fullName,
      departmentId: member.department.id,
      actualSeconds: member.actualWorkedSeconds,
      plannedSeconds: member.scheduledMinutes * 60,
      percent: percent(
        member.actualWorkedSeconds,
        member.scheduledMinutes * 60,
      ),
    }))
    .sort((left, right) => right.percent - left.percent);

  const departmentMap = new Map<
    string,
    { id: string; name: string; total: number; open: number }
  >();

  scopedOutcomes.forEach(({ outcome }) => {
    outcome.departments.forEach((department) => {
      if (filters.departmentId && department.id !== filters.departmentId) return;
      const current = departmentMap.get(department.id) ?? {
        id: department.id,
        name: department.name,
        total: 0,
        open: 0,
      };
      current.total += 1;
      if (outcome.lifecycleStatus !== 'ACCEPTED') current.open += 1;
      departmentMap.set(department.id, current);
    });
  });

  const ownershipTotal = Array.from(departmentMap.values()).reduce(
    (sum, department) => sum + department.total,
    0,
  );
  const departments = Array.from(departmentMap.values())
    .map((department) => ({
      ...department,
      share: percent(department.total, ownershipTotal),
    }))
    .sort((left, right) => right.total - left.total);

  const averageProgress =
    projectHealth.length > 0
      ? Math.round(
          projectHealth.reduce((sum, project) => sum + project.progress, 0) /
            projectHealth.length,
        )
      : 0;

  return {
    projectProgress: averageProgress,
    projectCount: projectHealth.length,
    acceptedOutcomes,
    totalOutcomes: scopedOutcomes.length,
    needsReview,
    needsRevision,
    actualSeconds,
    plannedSeconds,
    capacityPercent: percent(actualSeconds, plannedSeconds),
    projectHealth,
    pipeline: [
      {
        key: 'planned',
        label: 'Planned',
        detail: 'Not started yet',
        value: planned,
      },
      {
        key: 'inProgress',
        label: 'In progress',
        detail: 'Active delivery',
        value: inProgress,
      },
      {
        key: 'forReview',
        label: 'For review',
        detail: 'Waiting for Project Lead',
        value: needsReview,
      },
      {
        key: 'needsRevision',
        label: 'Needs revision',
        detail: 'Changes requested',
        value: needsRevision,
      },
      {
        key: 'accepted',
        label: 'Accepted',
        detail: 'Completed outcomes',
        value: acceptedOutcomes,
      },
      {
        key: 'locked',
        label: 'Locked',
        detail: 'Waiting on dependencies',
        value: locked,
      },
    ],
    capacity,
    departments,
  };
}
