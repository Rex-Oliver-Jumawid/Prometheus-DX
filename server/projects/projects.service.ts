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

@Injectable()
export class ProjectsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listProjects(currentMember: Member): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      relationLoadStrategy: 'join',
      include: projectInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return projects.map((project) => this.toProject(project, currentMember.id));
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
    const project = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.project.findUnique({
        where: { id: projectId },
        relationLoadStrategy: 'join',
        select: {
          id: true,
          status: true,
          doneAt: true,
          updatedAt: true,
          leadMemberId: true,
          members: {
            where: { memberId: currentMember.id },
            select: { accessLevel: true },
          },
        },
      });

      if (!existing) throw new NotFoundException('Project not found.');
      const currentProjectMember = existing.members[0];
      if (
        existing.leadMemberId !== currentMember.id &&
        currentProjectMember?.accessLevel !== 'CAN_EDIT'
      ) {
        throw new ForbiddenException(
          'Only the assigned Project Lead or a Project Member with CAN_EDIT may change project status.',
        );
      }

      const nextStatus = input.status as ProjectStatus;
      if (existing.status === nextStatus) return existing;

      return transaction.project.update({
        where: { id: projectId },
        data: {
          status: nextStatus,
          doneAt:
            nextStatus === 'DONE'
              ? new Date()
              : existing.status === 'DONE'
                ? null
                : existing.doneAt,
          statusHistory: {
            create: {
              fromStatus: existing.status,
              toStatus: nextStatus,
              changedByMemberId: currentMember.id,
              changeSource: 'USER',
            },
          },
        },
        select: {
          id: true,
          status: true,
          doneAt: true,
          updatedAt: true,
        },
      });
    });

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
}
