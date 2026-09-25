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
import { writeNotifications } from '../notifications/notification-writer';

const outcomeInclude = {
  _count: {
    select: { submissions: { where: { reviewStatus: 'FOR_REVIEW' as const } } },
  },
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
  features: {
    select: {
      tasks: { select: { status: true } },
    },
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
      relationLoadStrategy: 'join',
      select: {
        id: true,
        leadMemberId: true,
        members: {
          where: { memberId: currentMember.id },
          select: { accessLevel: true },
          take: 1,
        },
        stages: {
          include: stageInclude,
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    return {
      projectId: project.id,
      canManageStructure:
        project.leadMemberId === currentMember.id ||
        project.members[0]?.accessLevel === 'CAN_EDIT',
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
      relationLoadStrategy: 'join',
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
      const changed = await transaction.projectMember.updateMany({
        where: {
          projectId,
          memberId,
          accessLevel: existing.accessLevel,
        },
        data: { accessLevel: input.accessLevel },
      });
      if (changed.count === 0) return;
      const history = await transaction.projectMemberAccessHistory.create({
        data: {
          projectId,
          memberId,
          previousAccess: existing.accessLevel,
          newAccess: input.accessLevel,
          changedByMemberId: currentMember.id,
        },
      });
      await transaction.activityLog.create({
        data: {
          projectId,
          actorMemberId: currentMember.id,
          entityType: 'ProjectMember',
          entityId: memberId,
          action: 'PROJECT_MEMBER_ACCESS_CHANGED',
          metadata: {
            previousAccess: existing.accessLevel,
            newAccess: input.accessLevel,
          },
        },
      });
      await writeNotifications(transaction, {
        type: 'PROJECT_MEMBER_ACCESS_CHANGED',
        sourceEventId: history.id,
        actorMemberId: currentMember.id,
        recipientMemberIds: [memberId],
        projectId,
        data: { accessLevel: input.accessLevel },
      });
    });
    const response = await this.getProjectMembers(currentMember, projectId);
    const updated = response.members.find(
      ({ member }) => member.id === memberId,
    );
    if (!updated) throw new NotFoundException('Project Member not found.');
    return updated;
  }

  async createStage(
    currentMember: Member,
    projectId: string,
    input: CreateStageRequest,
  ): Promise<Stage> {
    const stage = await this.prisma.$transaction(async (transaction) => {
      await this.requireProjectEditor(transaction, projectId, currentMember.id);
      const lastStage = await transaction.stage.findFirst({
        where: { projectId },
        select: { position: true },
        orderBy: { position: 'desc' },
      });
      const created = await transaction.stage.create({
        data: {
          projectId,
          name: input.name,
          description: input.description || null,
          position: (lastStage?.position ?? -1) + 1,
        },
        include: stageInclude,
      });
      await transaction.activityLog.create({
        data: {
          projectId,
          actorMemberId: currentMember.id,
          entityType: 'Stage',
          entityId: created.id,
          action: 'STAGE_CREATED',
          metadata: { name: created.name },
        },
      });
      return created;
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
      await this.requireProjectEditor(transaction, projectId, currentMember.id);
      await this.requireStage(transaction, projectId, stageId);
      const updated = await transaction.stage.update({
        where: { id: stageId },
        data: {
          name: input.name,
          description: input.description || null,
        },
        include: stageInclude,
      });
      await transaction.activityLog.create({
        data: {
          projectId,
          actorMemberId: currentMember.id,
          entityType: 'Stage',
          entityId: stageId,
          action: 'STAGE_UPDATED',
          metadata: { name: updated.name },
        },
      });
      return updated;
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
      await this.requireProjectEditor(transaction, projectId, currentMember.id);
      await this.requireStage(transaction, projectId, stageId);
      await this.validateOutcomeReferences(transaction, projectId, null, input);
      const lastOutcome = await transaction.outcome.findFirst({
        where: { stageId },
        select: { position: true },
        orderBy: { position: 'desc' },
      });
      const created = await transaction.outcome.create({
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
          members: {
            create: (input.memberIds || []).map((memberId) => ({
              memberId,
            })),
          },
        },
        include: outcomeInclude,
      });
      for (const memberId of input.memberIds || []) {
        await transaction.projectMember.upsert({
          where: { projectId_memberId: { projectId, memberId } },
          update: {},
          create: { projectId, memberId, accessLevel: 'CAN_VIEW' },
        });
      }
      await transaction.activityLog.create({
        data: {
          projectId,
          outcomeId: created.id,
          actorMemberId: currentMember.id,
          entityType: 'Outcome',
          entityId: created.id,
          action: 'OUTCOME_CREATED',
          metadata: { title: created.title },
        },
      });
      return created;
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
      await this.requireProjectEditor(transaction, projectId, currentMember.id);
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
        where: {
          outcomeId,
          prerequisiteOutcomeId: { notIn: input.prerequisiteOutcomeIds },
        },
      });
      await transaction.acceptanceCriterion.deleteMany({
        where: { outcomeId },
      });
      await transaction.outcomeDepartment.deleteMany({
        where: { outcomeId },
      });
      if (input.memberIds) {
        for (const memberId of input.memberIds) {
          await transaction.outcomeMember.upsert({
            where: { outcomeId_memberId: { outcomeId, memberId } },
            update: {},
            create: { outcomeId, memberId },
          });
          await transaction.projectMember.upsert({
            where: { projectId_memberId: { projectId, memberId } },
            update: {},
            create: { projectId, memberId, accessLevel: 'CAN_VIEW' },
          });
        }
      }
      const updated = await transaction.outcome.update({
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
            connectOrCreate: input.prerequisiteOutcomeIds.map(
              (prerequisiteOutcomeId) => ({
                where: {
                  outcomeId_prerequisiteOutcomeId: {
                    outcomeId,
                    prerequisiteOutcomeId,
                  },
                },
                create: { prerequisiteOutcomeId },
              }),
            ),
          },
        },
        include: outcomeInclude,
      });
      await transaction.activityLog.create({
        data: {
          projectId,
          outcomeId,
          actorMemberId: currentMember.id,
          entityType: 'Outcome',
          entityId: outcomeId,
          action: 'OUTCOME_UPDATED',
          metadata: { title: updated.title },
        },
      });
      return updated;
    });
    return this.toOutcome(outcome, currentMember.id);
  }

  async joinOutcome(
    currentMember: Member,
    projectId: string,
    outcomeId: string,
  ): Promise<Outcome> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
      const existing = await transaction.outcome.findUnique({
        where: { id: outcomeId },
        select: {
          lifecycleStatus: true,
          stage: {
            select: {
              projectId: true,
              project: { select: { leadMemberId: true } },
            },
          },
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
      const joined = await transaction.outcomeMember.createMany({
        data: [{ outcomeId, memberId: currentMember.id }],
        skipDuplicates: true,
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
      if (joined.count > 0) {
        await transaction.activityLog.create({
          data: {
            projectId,
            outcomeId,
            actorMemberId: currentMember.id,
            entityType: 'Outcome',
            entityId: outcomeId,
            action: 'OUTCOME_JOINED',
            metadata: { memberId: currentMember.id },
          },
        });
        await writeNotifications(transaction, {
          type: 'OUTCOME_JOINED',
          sourceEventId: outcomeId,
          subjectId: currentMember.id,
          actorMemberId: currentMember.id,
          recipientMemberIds: [existing.stage.project.leadMemberId],
          projectId,
          outcomeId,
        });
      }
    });
    const outcome = await this.prisma.outcome.findUniqueOrThrow({
      where: { id: outcomeId },
      include: outcomeInclude,
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

  async deleteOutcome(
    currentMember: Member,
    projectId: string,
    outcomeId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await this.requireProjectEditor(transaction, projectId, currentMember.id);

      const outcome = await transaction.outcome.findUnique({
        where: { id: outcomeId },
        select: {
          stageId: true,
          position: true,
          title: true,
          stage: { select: { projectId: true } },
          _count: {
            select: {
              members: true,
              submissions: true,
              acceptances: true,
              revisionRequests: true,
              dependents: true,
              features: true,
            },
          },
        },
      });

      if (!outcome || outcome.stage.projectId !== projectId) {
        throw new NotFoundException('Outcome not found.');
      }

      this.assertOutcomeDeletable(outcome._count);

      const { stageId, position } = outcome;

      await transaction.outcome.delete({ where: { id: outcomeId } });
      await transaction.activityLog.create({
        data: {
          projectId,
          actorMemberId: currentMember.id,
          entityType: 'Outcome',
          entityId: outcomeId,
          action: 'OUTCOME_DELETED',
          metadata: { title: outcome.title },
        },
      });

      // Compact sibling positions within the same Stage.
      // Two-pass to avoid transient unique constraint violations on
      // (stageId, position): first shift all affected siblings up by a large
      // offset, then renumber them sequentially from the freed slot downward.
      const siblings = await transaction.outcome.findMany({
        where: { stageId, position: { gt: position } },
        select: { id: true, position: true },
        orderBy: { position: 'asc' },
      });
      if (siblings.length > 0) {
        const offset = 100_000;
        for (const sibling of siblings) {
          await transaction.outcome.update({
            where: { id: sibling.id },
            data: { position: sibling.position + offset },
          });
        }
        for (let i = 0; i < siblings.length; i++) {
          await transaction.outcome.update({
            where: { id: siblings[i].id },
            data: { position: position + i },
          });
        }
      }
    });
  }

  async deleteStage(
    currentMember: Member,
    projectId: string,
    stageId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await this.requireProjectEditor(transaction, projectId, currentMember.id);
      const stage = await transaction.stage.findUnique({
        where: { id: stageId },
        select: {
          projectId: true,
          position: true,
          name: true,
          outcomes: {
            select: {
              id: true,
              title: true,
              _count: {
                select: {
                  members: true,
                  submissions: true,
                  acceptances: true,
                  revisionRequests: true,
                  dependents: true,
                  features: true,
                },
              },
            },
          },
        },
      });

      if (!stage || stage.projectId !== projectId) {
        throw new NotFoundException('Stage not found.');
      }

      // Reject if any child Outcome has protected history.
      // Never partially delete - all or nothing.
      for (const outcome of stage.outcomes) {
        this.assertOutcomeDeletable(outcome._count);
      }

      const { position } = stage;

      await transaction.stage.delete({ where: { id: stageId } });
      await transaction.activityLog.create({
        data: {
          projectId,
          actorMemberId: currentMember.id,
          entityType: 'Stage',
          entityId: stageId,
          action: 'STAGE_DELETED',
          metadata: { name: stage.name },
        },
      });
      // Stage deletion cascades to safe, unassigned Outcomes. Record those
      // deletions too, preserving their IDs and titles in the Project audit.
      if (stage.outcomes.length > 0) {
        await transaction.activityLog.createMany({
          data: stage.outcomes.map((outcome) => ({
            projectId,
            actorMemberId: currentMember.id,
            entityType: 'Outcome',
            entityId: outcome.id,
            action: 'OUTCOME_DELETED',
            metadata: { title: outcome.title },
          })),
        });
      }

      // Compact sibling stage positions within the Project.
      const siblings = await transaction.stage.findMany({
        where: { projectId, position: { gt: position } },
        select: { id: true, position: true },
        orderBy: { position: 'asc' },
      });
      if (siblings.length > 0) {
        const offset = 100_000;
        for (const sibling of siblings) {
          await transaction.stage.update({
            where: { id: sibling.id },
            data: { position: sibling.position + offset },
          });
        }
        for (let i = 0; i < siblings.length; i++) {
          await transaction.stage.update({
            where: { id: siblings[i].id },
            data: { position: position + i },
          });
        }
      }
    });
  }

  private async requireProjectEditor(
    transaction: Prisma.TransactionClient,
    projectId: string,
    memberId: string,
  ) {
    await transaction.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
    const project = await transaction.project.findUnique({
      where: { id: projectId },
      select: {
        leadMemberId: true,
        members: {
          where: { memberId },
          select: { accessLevel: true },
          take: 1,
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    if (
      project.leadMemberId !== memberId &&
      project.members[0]?.accessLevel !== 'CAN_EDIT'
    ) {
      throw new ForbiddenException(
        'Only the assigned Project Lead or a Project Member with CAN_EDIT may manage workflow structure.',
      );
    }
  }

  private async requireLead(
    transaction: Prisma.TransactionClient,
    projectId: string,
    memberId: string,
  ) {
    await transaction.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
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

  private assertOutcomeDeletable(counts: {
    members: number;
    submissions: number;
    acceptances: number;
    revisionRequests: number;
    dependents: number;
    features: number;
  }): void {
    if (counts.members > 0) {
      throw new ConflictException(
        'This Outcome has permanent Membership records and cannot be deleted.',
      );
    }
    if (counts.submissions > 0) {
      throw new ConflictException(
        'This Outcome has submission history and cannot be deleted.',
      );
    }
    if (counts.acceptances > 0) {
      throw new ConflictException(
        'This Outcome has acceptance history and cannot be deleted.',
      );
    }
    if (counts.revisionRequests > 0) {
      throw new ConflictException(
        'This Outcome has revision request history and cannot be deleted.',
      );
    }
    if (counts.dependents > 0) {
      throw new ConflictException(
        'This Outcome is a prerequisite for another Outcome and cannot be deleted.',
      );
    }
    if (counts.features > 0) {
      throw new ConflictException(
        'This Outcome has work records and cannot be deleted.',
      );
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
    if (input.memberIds?.length) {
      const members = await transaction.member.findMany({
        where: { id: { in: input.memberIds } },
        select: { id: true, status: true },
      });
      if (
        members.length !== input.memberIds.length ||
        members.some((m) => m.status !== 'ACTIVE')
      ) {
        throw new BadRequestException('Choose only existing active members.');
      }
    }
    if (outcomeId) {
      const edges = await transaction.outcomeDependency.findMany({
        where: { outcome: { stage: { projectId } } },
        select: { outcomeId: true, prerequisiteOutcomeId: true },
      });
      const pending = [...input.prerequisiteOutcomeIds];
      const seen = new Set<string>();
      while (pending.length) {
        const id = pending.pop()!;
        if (id === outcomeId)
          throw new BadRequestException(
            'Outcome dependencies cannot form a cycle.',
          );
        if (seen.has(id)) continue;
        seen.add(id);
        pending.push(
          ...edges
            .filter((edge) => edge.outcomeId === id)
            .map((edge) => edge.prerequisiteOutcomeId),
        );
      }
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
    const tasks = outcome.features.flatMap((feature) => feature.tasks);
    const completedTasks = tasks.filter((task) => task.status === 'DONE').length;
    const workProgress =
      outcome.lifecycleStatus === 'ACCEPTED'
        ? 100
        : tasks.length
          ? Math.round((completedTasks / tasks.length) * 100)
          : null;
    const prerequisites = outcome.prerequisites.map((dependency) => ({
      id: dependency.prerequisiteOutcome.id,
      dependencyId: dependency.id,
      title: dependency.prerequisiteOutcome.title,
      lifecycleStatus: dependency.prerequisiteOutcome.lifecycleStatus,
      resolved:
        dependency.prerequisiteOutcome.lifecycleStatus === 'ACCEPTED' ||
        dependency.overrideResolvedAt !== null,
      resolution:
        dependency.prerequisiteOutcome.lifecycleStatus === 'ACCEPTED'
          ? ('ACCEPTED' as const)
          : dependency.overrideResolvedAt !== null
            ? ('OVERRIDDEN' as const)
            : ('WAITING' as const),
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
      isLocked:
        outcome.lifecycleStatus !== 'ACCEPTED' &&
        prerequisites.some((prerequisite) => !prerequisite.resolved),
      hasForReview: outcome._count.submissions > 0,
      workProgress,
      isJoined: outcome.members.some(
        ({ memberId }) => memberId === currentMemberId,
      ),
      createdAt: outcome.createdAt.toISOString(),
      updatedAt: outcome.updatedAt.toISOString(),
    };
  }
}
