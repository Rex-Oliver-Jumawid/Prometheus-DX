import { describe, expect, it } from 'vitest';
import type { Project } from '../../../shared/contracts/project';
import type { ProjectWorkflowResponse } from '../../../shared/contracts/project-workflow';
import type { TeamWorkSummaryResponse } from '../../../shared/contracts/work-session';
import {
  buildVisiWorkModel,
  departmentStages,
  groupDepartmentProjects,
} from './visiwork-model';

const rd = {
  id: '00000000-0000-4000-8000-000000000101',
  name: 'Research & Development',
  shortLabel: 'R&D',
};

const creatives = {
  id: '00000000-0000-4000-8000-000000000102',
  name: 'Creatives',
  shortLabel: 'Creative',
};

const nico = {
  id: '00000000-0000-4000-8000-000000000201',
  fullName: 'Nico Ramos',
  email: 'nico@example.com',
};

const bea = {
  id: '00000000-0000-4000-8000-000000000202',
  fullName: 'Bea Santos',
  email: 'bea@example.com',
};

function project(
  overrides: Partial<Project> & Pick<Project, 'id' | 'name' | 'status'>,
): Project {
  return {
    id: overrides.id,
    name: overrides.name,
    description: 'Project description',
    status: overrides.status,
    lead: nico,
    creator: nico,
    departments: [rd],
    isParticipating: true,
    currentMemberAccess: 'CAN_VIEW',
    canChangeStatus: false,
    doneAt: null,
    archivedAt: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    metrics: {
      totalOutcomes: 2,
      openOutcomes: 1,
      acceptedOutcomes: 1,
      activeStagesCount: 1,
      activeStages: [
        {
          id: '00000000-0000-4000-8000-000000000401',
          name: 'Build',
          openOutcomesCount: 1,
        },
      ],
      progressPercentage: 50,
    },
    ...overrides,
  };
}

const projects: Project[] = [
  project({
    id: '00000000-0000-4000-8000-000000000301',
    name: 'Client Management System',
    status: 'IN_PROGRESS',
    departments: [rd, creatives],
    metrics: {
      totalOutcomes: 2,
      openOutcomes: 1,
      acceptedOutcomes: 1,
      activeStagesCount: 1,
      activeStages: [
        {
          id: '00000000-0000-4000-8000-000000000401',
          name: 'Build',
          openOutcomesCount: 1,
        },
      ],
      progressPercentage: 54,
    },
  }),
  project({
    id: '00000000-0000-4000-8000-000000000302',
    name: 'Prometheus Brand Site',
    status: 'DONE',
    departments: [creatives],
    metrics: {
      totalOutcomes: 1,
      openOutcomes: 0,
      acceptedOutcomes: 1,
      activeStagesCount: 0,
      activeStages: [],
      progressPercentage: 100,
    },
  }),
];

const workflows: ProjectWorkflowResponse[] = [
  {
    projectId: projects[0].id,
    canManageStructure: false,
    stages: [
      {
        id: '00000000-0000-4000-8000-000000000401',
        projectId: projects[0].id,
        name: 'Build',
        description: null,
        position: 0,
        createdAt: '2026-09-20T00:00:00.000Z',
        updatedAt: '2026-09-20T00:00:00.000Z',
        outcomes: [
          {
            id: '00000000-0000-4000-8000-000000000501',
            stageId: '00000000-0000-4000-8000-000000000401',
            title: 'Validated experiment brief',
            description: 'Research and organize the next validation experiment.',
            lifecycleStatus: 'OPEN',
            position: 0,
            departments: [rd],
            acceptanceCriteria: [],
            prerequisites: [],
            members: [nico],
            isLocked: false,
            isJoined: true,
            hasForReview: false,
            createdAt: '2026-09-20T00:00:00.000Z',
            updatedAt: '2026-09-20T00:00:00.000Z',
          },
          {
            id: '00000000-0000-4000-8000-000000000502',
            stageId: '00000000-0000-4000-8000-000000000401',
            title: 'Creative launch pack',
            description: null,
            lifecycleStatus: 'ACCEPTED',
            position: 1,
            departments: [creatives],
            acceptanceCriteria: [],
            prerequisites: [],
            members: [bea],
            isLocked: false,
            isJoined: false,
            hasForReview: false,
            createdAt: '2026-09-20T00:00:00.000Z',
            updatedAt: '2026-09-20T00:00:00.000Z',
          },
        ],
      },
    ],
  },
  {
    projectId: projects[1].id,
    canManageStructure: false,
    stages: [],
  },
];

const team: TeamWorkSummaryResponse = {
  timezone: 'Asia/Manila',
  asOf: '2026-09-23T10:30:00.000Z',
  weekStart: '2026-09-21T00:00:00.000Z',
  weekEnd: '2026-09-28T00:00:00.000Z',
  summary: {
    memberCount: 2,
    workingNowCount: 1,
    scheduledMinutes: 2400,
    actualWorkedSeconds: 36000,
  },
  members: [
    {
      id: nico.id,
      fullName: nico.fullName,
      position: 'Developer',
      department: rd,
      workingNow: true,
      scheduledMinutes: 1200,
      actualWorkedSeconds: 18000,
      todaySchedule: [],
    },
    {
      id: bea.id,
      fullName: bea.fullName,
      position: 'Designer',
      department: creatives,
      workingNow: false,
      scheduledMinutes: 1200,
      actualWorkedSeconds: 18000,
      todaySchedule: [],
    },
  ],
};

describe('buildVisiWorkModel', () => {
  it('derives department presence and project progress from canonical records', () => {
    const model = buildVisiWorkModel(projects, workflows, team);
    const department = model.departments.find((item) => item.id === rd.id);
    const clientProject = model.projects.find(
      (item) => item.id === projects[0].id,
    );

    expect(department?.workingMembers.map((member) => member.fullName)).toEqual([
      'Nico Ramos',
    ]);
    expect(department?.projects.map((item) => item.name)).toContain(
      'Client Management System',
    );
    expect(clientProject?.progress).toBe(54);
    expect(clientProject?.currentStageName).toBe('Build');
    expect(clientProject?.workingMemberNames).toContain('Nico Ramos');
  });

  it('scopes department detail outcomes to the responsible department', () => {
    const model = buildVisiWorkModel(projects, workflows, team);
    const clientProject = model.projects.find(
      (item) => item.id === projects[0].id,
    );

    expect(clientProject).toBeDefined();
    const stages = departmentStages(clientProject!, rd.id);

    expect(stages).toHaveLength(1);
    expect(stages[0].outcomes.map((outcome) => outcome.title)).toEqual([
      'Validated experiment brief',
    ]);
  });

  it('groups department projects by their current project state', () => {
    const model = buildVisiWorkModel(projects, workflows, team);
    const department = model.departments.find(
      (item) => item.id === creatives.id,
    );

    expect(department).toBeDefined();
    const groups = groupDepartmentProjects(department!);

    expect(groups.IN_PROGRESS.map((item) => item.name)).toEqual([
      'Client Management System',
    ]);
    expect(groups.DONE.map((item) => item.name)).toEqual([
      'Prometheus Brand Site',
    ]);
    expect(groups.PLANNING).toEqual([]);
  });
});
