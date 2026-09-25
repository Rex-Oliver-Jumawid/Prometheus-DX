import { describe, expect, it } from 'vitest';
import type { Project } from '../../../shared/contracts/project';
import type { ProjectWorkflowResponse } from '../../../shared/contracts/project-workflow';
import type { TeamWorkSummaryResponse } from '../../../shared/contracts/work-session';
import { buildReportsAnalyticsModel } from './reports-model';

const projectAId = '11111111-1111-4111-8111-111111111111';
const projectBId = '22222222-2222-4222-8222-222222222222';
const engineeringId = '33333333-3333-4333-8333-333333333333';
const designId = '44444444-4444-4444-8444-444444444444';

const member = {
  id: '55555555-5555-4555-8555-555555555555',
  fullName: 'Rex Jumawid',
  email: 'rex@example.com',
};

const projects: Project[] = [
  {
    id: projectAId,
    name: 'Project Alpha',
    description: 'Alpha',
    status: 'IN_PROGRESS',
    lead: member,
    creator: member,
    departments: [
      { id: engineeringId, name: 'Engineering', shortLabel: 'ENG' },
    ],
    isParticipating: true,
    currentMemberAccess: 'CAN_EDIT',
    canChangeStatus: true,
    doneAt: null,
    archivedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    metrics: {
      totalOutcomes: 3,
      openOutcomes: 2,
      acceptedOutcomes: 1,
      activeStagesCount: 1,
      activeStages: [],
      progressPercentage: 40,
    },
  },
  {
    id: projectBId,
    name: 'Project Beta',
    description: 'Beta',
    status: 'PLANNING',
    lead: member,
    creator: member,
    departments: [{ id: designId, name: 'Design', shortLabel: 'DSN' }],
    isParticipating: true,
    currentMemberAccess: 'CAN_VIEW',
    canChangeStatus: false,
    doneAt: null,
    archivedAt: null,
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    metrics: {
      totalOutcomes: 1,
      openOutcomes: 1,
      acceptedOutcomes: 0,
      activeStagesCount: 1,
      activeStages: [],
      progressPercentage: 20,
    },
  },
];

const outcome = (
  id: string,
  projectId: string,
  departmentId: string,
  departmentName: string,
  lifecycleStatus: 'OPEN' | 'NEEDS_REVISION' | 'ACCEPTED',
  options: { hasForReview?: boolean; isLocked?: boolean } = {},
) => ({
  id,
  stageId:
    projectId === projectAId
      ? '66666666-6666-4666-8666-666666666666'
      : '77777777-7777-4777-8777-777777777777',
  title: id,
  description: null,
  lifecycleStatus,
  position: 0,
  departments: [
    {
      id: departmentId,
      name: departmentName,
      shortLabel: departmentName.slice(0, 3).toUpperCase(),
    },
  ],
  acceptanceCriteria: [],
  prerequisites: [],
  members: [],
  isLocked: options.isLocked ?? false,
  isJoined: false,
  hasForReview: options.hasForReview ?? false,
  workProgress: lifecycleStatus === 'ACCEPTED' ? 100 : 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
});

const workflows: ProjectWorkflowResponse[] = [
  {
    projectId: projectAId,
    canManageStructure: true,
    stages: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        projectId: projectAId,
        name: 'Delivery',
        description: null,
        position: 0,
        outcomes: [
          outcome(
            '88888888-8888-4888-8888-888888888888',
            projectAId,
            engineeringId,
            'Engineering',
            'ACCEPTED',
          ),
          outcome(
            '99999999-9999-4999-8999-999999999999',
            projectAId,
            engineeringId,
            'Engineering',
            'OPEN',
            { hasForReview: true },
          ),
          outcome(
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            projectAId,
            engineeringId,
            'Engineering',
            'NEEDS_REVISION',
          ),
        ],
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-20T00:00:00.000Z',
      },
    ],
  },
  {
    projectId: projectBId,
    canManageStructure: true,
    stages: [
      {
        id: '77777777-7777-4777-8777-777777777777',
        projectId: projectBId,
        name: 'Planning',
        description: null,
        position: 0,
        outcomes: [
          outcome(
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            projectBId,
            designId,
            'Design',
            'OPEN',
          ),
        ],
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-20T00:00:00.000Z',
      },
    ],
  },
];

const team: TeamWorkSummaryResponse = {
  timezone: 'Asia/Manila',
  asOf: '2026-09-23T12:00:00.000Z',
  weekStart: '2026-09-21T00:00:00.000Z',
  weekEnd: '2026-09-27T23:59:59.000Z',
  summary: {
    memberCount: 2,
    workingNowCount: 0,
    scheduledMinutes: 1800,
    actualWorkedSeconds: 75600,
  },
  members: [
    {
      id: member.id,
      fullName: member.fullName,
      position: 'Developer',
      department: {
        id: engineeringId,
        name: 'Engineering',
        shortLabel: 'ENG',
      },
      visiworkDepartmentId: null,
      workingNow: false,
      scheduledMinutes: 1200,
      actualWorkedSeconds: 54000,
      todaySchedule: [],
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      fullName: 'Ana Mendoza',
      position: 'Designer',
      department: { id: designId, name: 'Design', shortLabel: 'DSN' },
      visiworkDepartmentId: null,
      workingNow: false,
      scheduledMinutes: 600,
      actualWorkedSeconds: 21600,
      todaySchedule: [],
    },
  ],
};

describe('buildReportsAnalyticsModel', () => {
  it('derives reporting metrics from project, outcome, and work-session sources', () => {
    const model = buildReportsAnalyticsModel(projects, workflows, team, {
      projectId: '',
      departmentId: '',
    });

    expect(model.projectProgress).toBe(30);
    expect(model.acceptedOutcomes).toBe(1);
    expect(model.totalOutcomes).toBe(4);
    expect(model.needsReview).toBe(1);
    expect(model.needsRevision).toBe(1);
    expect(model.capacityPercent).toBe(70);
    expect(model.pipeline.find((item) => item.key === 'planned')?.value).toBe(1);
  });

  it('applies department filters to outcome ownership and team capacity', () => {
    const model = buildReportsAnalyticsModel(projects, workflows, team, {
      projectId: '',
      departmentId: engineeringId,
    });

    expect(model.totalOutcomes).toBe(3);
    expect(model.acceptedOutcomes).toBe(1);
    expect(model.capacity).toHaveLength(1);
    expect(model.capacity[0]?.name).toBe('Rex Jumawid');
    expect(model.departments.map((department) => department.name)).toEqual([
      'Engineering',
    ]);
  });
});
