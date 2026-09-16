import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Member } from '@prisma/client';
import type {
  CreateOutcomeRequest,
  CreateStageRequest,
  Outcome,
  ProjectMember as ProjectMemberView,
  ProjectMembersResponse,
  ProjectWorkflowResponse,
  Stage,
  UpdateOutcomeRequest,
  UpdateStageRequest,
  UpdateProjectMemberAccessRequest,
} from '../../shared/contracts/project-workflow';
import { PrismaService } from '../database/prisma.service';

const outcomeInclude = {
  departments: {
    include: {
      department: { select: { id: true, name: true, shortLabel: true } },
    },
  },
  acceptanceCriteria: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
  },
  prerequisites: {
    include: {
      prerequisiteOutcome: {
        select: { id: true, title: true, lifecycleStatus: true },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  members: {
    include: {
      member: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { joinedAt: 'asc' as const },
  },
} satisfies Prisma.OutcomeInclude;

const stageInclude = {
  outcomes: {
    include: outcomeInclude,
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.StageInclude;

type OutcomeRecord = Prisma.OutcomeGetPayload<{
  include: typeof outcomeInclude;
}>;
type StageRecord = Prisma.StageGetPayload<{ include: typeof stageInclude }>;

@Injectable()
export class ProjectWorkflowService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getWorkflow(
    currentMember: Member,
    projectId: string,
  ): Promise<ProjectWorkflowResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        leadMemberId: true,
        stages: {
          include: stageInclude,
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    return {
      projectId: project.id,
      canManageStructure: project.leadMemberId === currentMember.id,
      stages: project.stages.map((stage) =>
        this.toStage(stage, currentMember.id),
      ),
    };
  }

  async getProjectMembers(
    currentMember: Member,
    projectId: string,
  ): Promise<ProjectMembersResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, leadMemberId: true },
    });
    if (!project) throw new NotFoundException('Project not found.');
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            email: true,
            outcomeMemberships: {
              where: { outcome: { stage: { projectId } } },
              select: { outcome: { select: { id: true, title: true } } },
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { memberId: 'asc' }],
    });
    return {
      projectId,
      canManageAccess: project.leadMemberId === currentMember.id,
      members: members.map(({ member, accessLevel }) => ({
        member: {
          id: member.id,
          fullName: member.fullName,
          email: member.email,
        },
        accessLevel,
        outcomes: member.outcomeMemberships.map(({ outcome }) => outcome),
      })),
    };
  }

  async updateProjectMemberAccess(
    currentMember: Member,
    projectId: string,
    memberId: string,
    input: UpdateProjectMemberAccessRequest,
  ): Promise<ProjectMemberView> {
    await this.prisma.$transaction(async (transaction) => {
      await this.requireLead(transaction, projectId, currentMember.id);
      const existing = await transaction.projectMember.findUnique({
        where: { projectId_memberId: { projectId, memberId } },
        select: { accessLevel: true },
      });
      if (!existing) throw new NotFoundException('Project Member not found.');
      if (existing.accessLevel === input.accessLevel) return;
      await transaction.projectMember.update({
        where: { projectId_memberId: { projectId, memberId } },
        data: { accessLevel: input.accessLevel },
      });
      await transaction.projectMemberAccessHistory.create({
        data: {
          projectId,
          memberId,
          previousAccess: existing.accessLevel,
          newAccess: input.accessLevel,
          changedByMemberId: currentMember.id,
        },
      });
    });
    const response = await this.getProjectMembers(currentMember, projectId);
    const updated = response.members.find(({ member }) => member.id === memberId);
    if (!updated) throw new NotFoundException('Project Member not found.');
    return updated;
  }

  async createStage(
    currentMember: Member,
    projectId: string,
    input: CreateStageRequest,
  ): Promise<Stage> {
    const stage = await this.prisma.$transaction(async (transaction) => {
      await this.requireLead(transaction, projectId, currentMember.id);
      const lastStage = await transaction.stage.findFirst({
        where: { projectId },
        select: { position: true },
        orderBy: { position: 'desc' },
      });
      return transaction.stage.create({
        data: {
          projectId,
          name: input.name,
          description: input.description || null,
          position: (lastStage?.position ?? -1) + 1,
        },
        include: stageInclude,
      });
    });
    return this.toStage(stage, currentMember.id);
  }

  async updateStage(
    currentMember: Member,
    projectId: string,
    stageId: string,
    input: UpdateStageRequest,
  ): Promise<Stage> {
    const stage = await this.prisma.$transaction(async (transaction) => {
      await this.requireLead(transaction, projectId, currentMember.id);
      await this.requireStage(transaction, projectId, stageId);
      return transaction.stage.update({
        where: { id: stageId },
        data: {
          name: input.name,
          description: input.description || null,
        },
        include: stageInclude,
      });
    });
    return this.toStage(stage, currentMember.id);
  }

  async createOutcome(
    currentMember: Member,
    projectId: string,
    stageId: string,
    input: CreateOutcomeRequest,
  ): Promise<Outcome> {
    const outcome = await this.prisma.$transaction(async (transaction) => {
      await this.requireLead(transaction, projectId, currentMember.id);
      await this.requireStage(transaction, projectId, stageId);
      await this.validateOutcomeReferences(transaction, projectId, null, input);
      const lastOutcome = await transaction.outcome.findFirst({
        where: { stageId },
        select: { position: true },
        orderBy: { position: 'desc' },
      });
      return transaction.outcome.create({
        data: {
          stageId,
          title: input.title,
          description: input.description || null,
          position: (lastOutcome?.position ?? -1) + 1,
          createdByMemberId: currentMember.id,
          departments: {
            create: input.departmentIds.map((departmentId) => ({
              departmentId,
            })),
          },
          acceptanceCriteria: {
            create: input.acceptanceCriteria.map((description, position) => ({
              description,
              position,
            })),
          },
          prerequisites: {
            create: input.prerequisiteOutcomeIds.map(
              (prerequisiteOutcomeId) => ({ prerequisiteOutcomeId }),
            ),
          },
        },
        include: outcomeInclude,
      });
    });
    return this.toOutcome(outcome, currentMember.id);
  }

  async getOutcome(
    currentMember: Member,
    projectId: string,
    outcomeId: string,
  ): Promise<Outcome> {
    const outcome = await this.prisma.outcome.findUnique({
      where: { id: outcomeId },
      include: { ...outcomeInclude, stage: { select: { projectId: true } } },
    });
    if (!outcome || outcome.stage.projectId !== projectId) {
      throw new NotFoundException('Outcome not found.');
    }
    return this.toOutcome(outcome, currentMember.id);
  }

  async updateOutcome(
    currentMember: Member,
    projectId: string,
    outcomeId: string,
    input: UpdateOutcomeRequest,
  ): Promise<Outcome> {
    const outcome = await this.prisma.$transaction(async (transaction) => {
      await this.requireLead(transaction, projectId, currentMember.id);
      const existing = await transaction.outcome.findUnique({
        where: { id: outcomeId },
        select: { id: true, stage: { select: { projectId: true } } },
      });
      if (!existing || existing.stage.projectId !== projectId) {
        throw new NotFoundException('Outcome not found.');
      }
      await this.validateOutcomeReferences(
        transaction,
        projectId,
        outcomeId,
        input,
      );
      await transaction.outcomeDependency.deleteMany({
        where: { outcomeId },
      });
      await transaction.acceptanceCriterion.deleteMany({
        where: { outcomeId },
      });
      await transaction.outcomeDepartment.deleteMany({
        where: { outcomeId },
      });
      return transaction.outcome.update({
        where: { id: outcomeId },
        data: {
          title: input.title,
          description: input.description || null,
          departments: {
            create: input.departmentIds.map((departmentId) => ({
              departmentId,
            })),
          },
          acceptanceCriteria: {
            create: input.acceptanceCriteria.map((description, position) => ({
              description,
              position,
            })),
          },
          prerequisites: {
            create: input.prerequisiteOutcomeIds.map(
              (prerequisiteOutcomeId) => ({ prerequisiteOutcomeId }),
            ),
          },
        },
        include: outcomeInclude,
      });
    });
    return this.toOutcome(outcome, currentMember.id);
  }

  async joinOutcome(
    currentMember: Member,
    projectId: string,
    outcomeId: string,
  ): Promise<Outcome> {
    const outcome = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.outcome.findUnique({
        where: { id: outcomeId },
        select: {
          lifecycleStatus: true,
          stage: { select: { projectId: true } },
        },
      });
      if (!existing || existing.stage.projectId !== projectId) {
        throw new NotFoundException('Outcome not found.');
      }
      if (existing.lifecycleStatus === 'ACCEPTED') {
        throw new ConflictException(
          'Accepted Outcomes are closed to new Members.',
        );
      }
      await transaction.outcomeMember.upsert({
        where: {
          outcomeId_memberId: { outcomeId, memberId: currentMember.id },
        },
        update: {},
        create: { outcomeId, memberId: currentMember.id },
      });
      await transaction.projectMember.upsert({
        where: {
          projectId_memberId: { projectId, memberId: currentMember.id },
        },
        update: {},
        create: {
          projectId,
          memberId: currentMember.id,
          accessLevel: 'CAN_VIEW',
        },
      });
      return transaction.outcome.findUniqueOrThrow({
        where: { id: outcomeId },
        include: outcomeInclude,
      });
    });
    return this.toOutcome(outcome, currentMember.id);
  }

  async rejectOutcomeMemberRemoval(
    projectId: string,
    outcomeId: string,
    memberId: string,
  ): Promise<never> {
    const membership = await this.prisma.outcomeMember.findUnique({
      where: { outcomeId_memberId: { outcomeId, memberId } },
      select: {
        outcome: { select: { stage: { select: { projectId: true } } } },
      },
    });
    if (!membership || membership.outcome.stage.projectId !== projectId) {
      throw new NotFoundException('Outcome Membership not found.');
    }
    throw new ForbiddenException('Outcome Membership is permanent.');
  }

  private async requireLead(
    transaction: Prisma.TransactionClient,
    projectId: string,
    memberId: string,
  ) {
    const project = await transaction.project.findUnique({
      where: { id: projectId },
      select: { leadMemberId: true },
    });
    if (!project) throw new NotFoundException('Project not found.');
    if (project.leadMemberId !== memberId) {
      throw new ForbiddenException(
        'Only the assigned Project Lead may manage workflow structure.',
      );
    }
  }

  private async requireStage(
    transaction: Prisma.TransactionClient,
    projectId: string,
    stageId: string,
  ) {
    const stage = await transaction.stage.findUnique({
      where: { id: stageId },
      select: { projectId: true },
    });
    if (!stage || stage.projectId !== projectId) {
      throw new NotFoundException('Stage not found.');
    }
  }

  private async validateOutcomeReferences(
    transaction: Prisma.TransactionClient,
    projectId: string,
    outcomeId: string | null,
    input: CreateOutcomeRequest | UpdateOutcomeRequest,
  ) {
    if (outcomeId && input.prerequisiteOutcomeIds.includes(outcomeId)) {
      throw new BadRequestException('An Outcome cannot depend on itself.');
    }
    const [departments, prerequisites] = await Promise.all([
      transaction.department.findMany({
        where: { id: { in: input.departmentIds } },
        select: { id: true },
      }),
      transaction.outcome.findMany({
        where: { id: { in: input.prerequisiteOutcomeIds } },
        select: { id: true, stage: { select: { projectId: true } } },
      }),
    ]);
    if (departments.length !== input.departmentIds.length) {
      throw new BadRequestException('Choose only existing departments.');
    }
    if (prerequisites.length !== input.prerequisiteOutcomeIds.length) {
      throw new BadRequestException(
        'Choose only existing prerequisite Outcomes.',
      );
    }
    if (prerequisites.some((item) => item.stage.projectId !== projectId)) {
      throw new BadRequestException(
        'Prerequisite Outcomes must belong to the same Project.',
      );
    }
  }

  private toStage(stage: StageRecord, currentMemberId: string): Stage {
    return {
      id: stage.id,
      projectId: stage.projectId,
      name: stage.name,
      description: stage.description,
      position: stage.position,
      outcomes: stage.outcomes.map((outcome) =>
        this.toOutcome(outcome, currentMemberId),
      ),
      createdAt: stage.createdAt.toISOString(),
      updatedAt: stage.updatedAt.toISOString(),
    };
  }

  private toOutcome(outcome: OutcomeRecord, currentMemberId: string): Outcome {
    const prerequisites = outcome.prerequisites.map((dependency) => ({
      id: dependency.prerequisiteOutcome.id,
      title: dependency.prerequisiteOutcome.title,
      lifecycleStatus: dependency.prerequisiteOutcome.lifecycleStatus,
      resolved:
        dependency.prerequisiteOutcome.lifecycleStatus === 'ACCEPTED' ||
        dependency.overrideResolvedAt !== null,
    }));
    return {
      id: outcome.id,
      stageId: outcome.stageId,
      title: outcome.title,
      description: outcome.description,
      lifecycleStatus: outcome.lifecycleStatus,
      position: outcome.position,
      departments: outcome.departments.map(({ department }) => department),
      acceptanceCriteria: outcome.acceptanceCriteria.map((criterion) => ({
        id: criterion.id,
        description: criterion.description,
        position: criterion.position,
      })),
      prerequisites,
      members: outcome.members.map(({ member }) => member),
      isLocked: prerequisites.some((prerequisite) => !prerequisite.resolved),
      isJoined: outcome.members.some(
        ({ memberId }) => memberId === currentMemberId,
      ),
      createdAt: outcome.createdAt.toISOString(),
      updatedAt: outcome.updatedAt.toISOString(),
    };
  }
}
