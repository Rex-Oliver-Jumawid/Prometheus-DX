import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberStatus,
  Prisma,
  type Member,
  type ProjectStatus,
} from '@prisma/client';
import type {
  CreateProjectRequest,
  ProjectCreateOptionsResponse,
  Project,
  ProjectStatusUpdateResponse,
  UpdateProjectStatusRequest,
} from '../../shared/contracts/project';
import { PrismaService } from '../database/prisma.service';
import { writeNotifications } from '../notifications/notification-writer';

const projectInclude = {
  createdByMember: { select: { id: true, fullName: true, email: true } },
  leadMember: { select: { id: true, fullName: true, email: true } },
  departments: {
    include: {
      department: { select: { id: true, name: true, shortLabel: true } },
    },
  },
  members: { select: { memberId: true, accessLevel: true } },
  stages: {
    select: {
      id: true,
      name: true,
      position: true,
      outcomes: {
        select: {
          id: true,
          lifecycleStatus: true,
        },
      },
    },
    orderBy: { position: 'asc' },
  },
} satisfies Prisma.ProjectInclude;

type ProjectRecord = Prisma.ProjectGetPayload<{
  include: typeof projectInclude;
}>;

function projectListSelect(currentMemberId: string) {
  return {
    id: true,
    name: true,
    description: true,
    status: true,
    leadMemberId: true,
    doneAt: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
    createdByMember: {
      select: { id: true, fullName: true, email: true },
    },
    leadMember: { select: { id: true, fullName: true, email: true } },
    departments: {
      include: {
        department: { select: { id: true, name: true, shortLabel: true } },
      },
    },
    members: {
      where: { memberId: currentMemberId },
      select: { memberId: true, accessLevel: true },
    },
    stages: {
      select: {
        id: true,
        name: true,
        position: true,
        _count: { select: { outcomes: true } },
        outcomes: {
          where: { lifecycleStatus: { not: 'ACCEPTED' as const } },
          select: { id: true },
        },
      },
      orderBy: { position: 'asc' as const },
    },
  } satisfies Prisma.ProjectSelect;
}

type ProjectListRecord = Prisma.ProjectGetPayload<{
  select: ReturnType<typeof projectListSelect>;
}>;

type ProjectStatusRow = {
  id: string;
  status: ProjectStatus;
  doneAt: Date | null;
  updatedAt: Date;
};

@Injectable()
export class ProjectsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listProjects(currentMember: Member): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      relationLoadStrategy: 'join',
      select: projectListSelect(currentMember.id),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return projects.map((project) =>
      this.toProjectListItem(project, currentMember.id),
    );
  }

  async getCreateOptions(): Promise<ProjectCreateOptionsResponse> {
    const [leads, departments] = await Promise.all([
      this.prisma.member.findMany({
        where: { status: MemberStatus.ACTIVE },
        select: { id: true, fullName: true, email: true },
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.department.findMany({
        select: { id: true, name: true, shortLabel: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return { leads, departments };
  }

  async getProject(currentMember: Member, projectId: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      relationLoadStrategy: 'join',
      include: projectInclude,
    });
    if (!project) throw new NotFoundException('Project not found.');
    return this.toProject(project, currentMember.id);
  }

  async createProject(
    currentMember: Member,
    input: CreateProjectRequest,
  ): Promise<Project> {
    const project = await this.prisma.$transaction(async (transaction) => {
      const [lead, departments] = await Promise.all([
        transaction.member.findUnique({
          where: { id: input.leadMemberId },
          select: { id: true, status: true },
        }),
        transaction.department.findMany({
          where: { id: { in: input.departmentIds } },
          select: { id: true },
        }),
      ]);

      if (!lead) {
        throw new BadRequestException('Choose an existing Project Lead.');
      }
      if (lead.status !== MemberStatus.ACTIVE) {
        throw new BadRequestException('Choose an active Project Lead.');
      }
      if (departments.length !== input.departmentIds.length) {
        throw new BadRequestException('Choose only existing departments.');
      }

      const created = await transaction.project.create({
        data: {
          name: input.name,
          description: input.description,
          createdByMemberId: currentMember.id,
          leadMemberId: lead.id,
          departments: {
            create: input.departmentIds.map((departmentId) => ({
              departmentId,
            })),
          },
          statusHistory: {
            create: {
              toStatus: 'PLANNING',
              changedByMemberId: currentMember.id,
              changeSource: 'USER',
            },
          },
        },
      });

      await transaction.activityLog.create({
        data: {
          projectId: created.id,
          actorMemberId: currentMember.id,
          entityType: 'Project',
          entityId: created.id,
          action: 'PROJECT_CREATED',
          metadata: { name: created.name },
        },
      });

      await writeNotifications(transaction, {
        type: 'PROJECT_LEAD_ASSIGNED',
        sourceEventId: created.id,
        actorMemberId: currentMember.id,
        recipientMemberIds: [lead.id],
        projectId: created.id,
      });

      return transaction.project.findUniqueOrThrow({
        where: { id: created.id },
        relationLoadStrategy: 'join',
        include: projectInclude,
      });
    });

    return this.toProject(project, currentMember.id);
  }

  async updateProjectStatus(
    currentMember: Member,
    projectId: string,
    input: UpdateProjectStatusRequest,
  ): Promise<ProjectStatusUpdateResponse> {
    const nextStatus = input.status as ProjectStatus;
    const projects = await this.prisma.$queryRaw<ProjectStatusRow[]>(
      Prisma.sql`
        WITH authorized_project AS MATERIALIZED (
          SELECT
            project.id,
            project.status,
            project.done_at,
            project.updated_at
          FROM projects AS project
          WHERE project.id = ${projectId}::uuid
            AND (
              project.lead_member_id = ${currentMember.id}::uuid
              OR EXISTS (
                SELECT 1
                FROM project_members AS project_member
                WHERE project_member.project_id = project.id
                  AND project_member.member_id = ${currentMember.id}::uuid
                  AND project_member.access_level = 'CAN_EDIT'::"ProjectAccessLevel"
              )
            )
          FOR UPDATE OF project
        ),
        updated_project AS (
          UPDATE projects AS project
          SET
            status = ${nextStatus}::"ProjectStatus",
            done_at = CASE
              WHEN ${nextStatus}::"ProjectStatus" = 'DONE'::"ProjectStatus"
                THEN CURRENT_TIMESTAMP
              WHEN authorized_project.status = 'DONE'::"ProjectStatus"
                THEN NULL
              ELSE authorized_project.done_at
            END,
            updated_at = CURRENT_TIMESTAMP
          FROM authorized_project
          WHERE project.id = authorized_project.id
            AND authorized_project.status <> ${nextStatus}::"ProjectStatus"
          RETURNING
            project.id,
            project.status,
            project.done_at AS "doneAt",
            project.updated_at AS "updatedAt",
            authorized_project.status AS "fromStatus"
        ),
        status_history AS (
          INSERT INTO project_status_history (
            project_id,
            from_status,
            to_status,
            changed_by_member_id,
            change_source
          )
          SELECT
            updated_project.id,
            updated_project."fromStatus",
            updated_project.status,
            ${currentMember.id}::uuid,
            'USER'::"ProjectStatusChangeSource"
          FROM updated_project
          RETURNING project_id
        ),
        activity_history AS (
          INSERT INTO activity_logs (
            project_id,
            actor_member_id,
            entity_type,
            entity_id,
            action,
            metadata
          )
          SELECT
            updated_project.id,
            ${currentMember.id}::uuid,
            'Project',
            updated_project.id,
            'PROJECT_STATUS_CHANGED',
            jsonb_build_object(
              'fromStatus', updated_project."fromStatus"::text,
              'toStatus', updated_project.status::text
            )
          FROM updated_project
          RETURNING id
        )
        SELECT
          updated_project.id,
          updated_project.status,
          updated_project."doneAt",
          updated_project."updatedAt"
        FROM updated_project
        CROSS JOIN (SELECT count(*) FROM status_history) AS history_write
        CROSS JOIN (SELECT count(*) FROM activity_history) AS activity_write
        UNION ALL
        SELECT
          authorized_project.id,
          authorized_project.status,
          authorized_project.done_at AS "doneAt",
          authorized_project.updated_at AS "updatedAt"
        FROM authorized_project
        WHERE NOT EXISTS (SELECT 1 FROM updated_project)
      `,
    );
    const project = projects[0];

    if (!project) {
      const existing = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Project not found.');
      throw new ForbiddenException(
        'Only the assigned Project Lead or a Project Member with CAN_EDIT may change project status.',
      );
    }

    return {
      id: project.id,
      status: project.status,
      doneAt: project.doneAt?.toISOString() ?? null,
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  private toProject(project: ProjectRecord, currentMemberId: string): Project {
    const currentProjectMember = project.members.find(
      ({ memberId }) => memberId === currentMemberId,
    );
    const stages = project.stages ?? [];
    const totalOutcomes = stages.reduce(
      (sum, stage) => sum + stage.outcomes.length,
      0,
    );
    const acceptedOutcomes = stages.reduce(
      (sum, stage) =>
        sum +
        stage.outcomes.filter(
          (outcome) => outcome.lifecycleStatus === 'ACCEPTED',
        ).length,
      0,
    );
    const openOutcomes = totalOutcomes - acceptedOutcomes;
    const activeStages = stages
      .map((stage) => ({
        id: stage.id,
        name: stage.name,
        openOutcomesCount: stage.outcomes.filter(
          (outcome) => outcome.lifecycleStatus !== 'ACCEPTED',
        ).length,
      }))
      .filter((stage) => stage.openOutcomesCount > 0);

    const progressPercentage =
      project.status === 'DONE'
        ? 100
        : totalOutcomes === 0
          ? 0
          : Math.round((acceptedOutcomes / totalOutcomes) * 100);

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      lead: project.leadMember,
      creator: project.createdByMember,
      departments: project.departments.map(({ department }) => department),
      isParticipating: project.members.some(
        ({ memberId }) => memberId === currentMemberId,
      ),
      currentMemberAccess: currentProjectMember?.accessLevel ?? null,
      canChangeStatus:
        project.leadMemberId === currentMemberId ||
        currentProjectMember?.accessLevel === 'CAN_EDIT',
      doneAt: project.doneAt?.toISOString() ?? null,
      archivedAt: project.archivedAt?.toISOString() ?? null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      metrics: {
        totalOutcomes,
        openOutcomes,
        acceptedOutcomes,
        activeStagesCount: activeStages.length,
        activeStages,
        progressPercentage,
      },
    };
  }

  private toProjectListItem(
    project: ProjectListRecord,
    currentMemberId: string,
  ): Project {
    const currentProjectMember = project.members[0];
    const stages = project.stages ?? [];
    const totalOutcomes = stages.reduce(
      (sum, stage) => sum + stage._count.outcomes,
      0,
    );
    const openOutcomes = stages.reduce(
      (sum, stage) => sum + stage.outcomes.length,
      0,
    );
    const acceptedOutcomes = totalOutcomes - openOutcomes;
    const activeStages = stages
      .map((stage) => ({
        id: stage.id,
        name: stage.name,
        openOutcomesCount: stage.outcomes.length,
      }))
      .filter((stage) => stage.openOutcomesCount > 0);

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      lead: project.leadMember,
      creator: project.createdByMember,
      departments: project.departments.map(({ department }) => department),
      isParticipating: Boolean(currentProjectMember),
      currentMemberAccess: currentProjectMember?.accessLevel ?? null,
      canChangeStatus:
        project.leadMemberId === currentMemberId ||
        currentProjectMember?.accessLevel === 'CAN_EDIT',
      doneAt: project.doneAt?.toISOString() ?? null,
      archivedAt: project.archivedAt?.toISOString() ?? null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      metrics: {
        totalOutcomes,
        openOutcomes,
        acceptedOutcomes,
        activeStagesCount: activeStages.length,
        activeStages,
        progressPercentage:
          project.status === 'DONE'
            ? 100
            : totalOutcomes === 0
              ? 0
              : Math.round((acceptedOutcomes / totalOutcomes) * 100),
      },
    };
  }
}
