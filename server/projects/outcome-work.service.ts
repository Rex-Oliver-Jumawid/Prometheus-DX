import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Member } from '@prisma/client';
import type {
  EditWorkItem,
  OutcomeWork,
  TaskStateInput,
  WorkItemInput,
} from '../../shared/contracts/outcome-work';
import { PrismaService } from '../database/prisma.service';

const workInclude = {
  stage: { select: { projectId: true } },
  members: { select: { memberId: true } },
  prerequisites: {
    include: { prerequisiteOutcome: { select: { lifecycleStatus: true } } },
  },
  features: {
    orderBy: { position: 'asc' as const },
    include: { tasks: { orderBy: { position: 'asc' as const } } },
  },
} satisfies Prisma.OutcomeInclude;

type WorkRecord = Prisma.OutcomeGetPayload<{ include: typeof workInclude }>;

export function workPermissions(
  outcome: Pick<WorkRecord, 'lifecycleStatus' | 'members' | 'prerequisites'>,
  memberId: string,
) {
  const canPlan =
    outcome.lifecycleStatus !== 'ACCEPTED' &&
    outcome.members.some((member) => member.memberId === memberId);
  const locked = outcome.prerequisites.some(
    (dependency) =>
      !dependency.overrideResolvedAt &&
      dependency.prerequisiteOutcome.lifecycleStatus !== 'ACCEPTED',
  );
  return { canPlan, canExecute: canPlan && !locked };
}

@Injectable()
export class OutcomeWorkService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async findOutcome(
    db: Prisma.TransactionClient,
    projectId: string,
    outcomeId: string,
  ) {
    const outcome = await db.outcome.findUnique({
      where: { id: outcomeId },
      include: workInclude,
    });
    if (!outcome || outcome.stage.projectId !== projectId)
      throw new NotFoundException('Outcome not found.');
    return outcome;
  }

  async getWork(
    member: Member,
    projectId: string,
    outcomeId: string,
  ): Promise<OutcomeWork> {
    const outcome = await this.findOutcome(this.prisma, projectId, outcomeId);
    const tasks = outcome.features.flatMap((feature) => feature.tasks);
    const completedTasks = tasks.filter(
      (task) => task.status === 'DONE',
    ).length;
    return {
      ...workPermissions(outcome, member.id),
      completedTasks,
      totalTasks: tasks.length,
      progress:
        outcome.lifecycleStatus === 'ACCEPTED'
          ? 100
          : tasks.length
            ? Math.round((completedTasks / tasks.length) * 100)
            : null,
      features: outcome.features.map((feature) => ({
        id: feature.id,
        title: feature.title,
        description: feature.description,
        position: feature.position,
        createdAt: feature.createdAt.toISOString(),
        updatedAt: feature.updatedAt.toISOString(),
        tasks: feature.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          position: task.position,
          status: task.status,
          completedAt: task.completedAt?.toISOString() ?? null,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
        })),
      })),
    };
  }

  private async mutate(
    member: Member,
    projectId: string,
    outcomeId: string,
    execute: boolean,
    event: string,
    action: (
      db: Prisma.TransactionClient,
      outcome: WorkRecord,
    ) => Promise<{ id: string; title: string } | void>,
  ) {
    await this.prisma.$transaction(async (db) => {
      // Serialize position allocation and lifecycle checks across this Project.
      await db.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
      const outcome = await this.findOutcome(db, projectId, outcomeId);
      const permissions = workPermissions(outcome, member.id);
      if (!outcome.members.some((item) => item.memberId === member.id))
        throw new ForbiddenException('Join this Outcome before working on it.');
      if (!permissions.canPlan)
        throw new ConflictException('Accepted Outcomes are closed to work.');
      if (execute && !permissions.canExecute)
        throw new ConflictException(
          'Resolve the prerequisite before completing or reopening Tasks.',
        );
      const result = await action(db, outcome);
      if (result)
        await db.activityLog.create({
          data: {
            actorMemberId: member.id,
            projectId,
            outcomeId,
            entityType: event.startsWith('FEATURE') ? 'Feature' : 'Task',
            entityId: result.id,
            action: event,
            metadata: { title: result.title },
          },
        });
    });
    return this.getWork(member, projectId, outcomeId);
  }

  private requireFeature(outcome: WorkRecord, featureId: string) {
    const feature = outcome.features.find((item) => item.id === featureId);
    if (!feature)
      throw new NotFoundException('Feature not found in this Outcome.');
    return feature;
  }

  private requireTask(outcome: WorkRecord, taskId: string) {
    const task = outcome.features
      .flatMap((feature) => feature.tasks)
      .find((item) => item.id === taskId);
    if (!task) throw new NotFoundException('Task not found in this Outcome.');
    return task;
  }

  private requireVersion(updatedAt: Date, expected: string) {
    if (updatedAt.toISOString() !== expected)
      throw new ConflictException(
        'This work changed since you opened it. Refresh and try again.',
      );
  }

  createFeature(
    member: Member,
    projectId: string,
    outcomeId: string,
    input: WorkItemInput,
  ) {
    return this.mutate(
      member,
      projectId,
      outcomeId,
      false,
      'FEATURE_CREATED',
      (db, outcome) =>
        db.feature.create({
          data: {
            outcomeId,
            title: input.title,
            description: input.description || null,
            position: (outcome.features.at(-1)?.position ?? -1) + 1,
            createdByMemberId: member.id,
          },
        }),
    );
  }

  editFeature(
    member: Member,
    projectId: string,
    outcomeId: string,
    featureId: string,
    input: EditWorkItem,
  ) {
    return this.mutate(
      member,
      projectId,
      outcomeId,
      false,
      'FEATURE_UPDATED',
      (db, outcome) => {
        this.requireVersion(
          this.requireFeature(outcome, featureId).updatedAt,
          input.updatedAt,
        );
        return db.feature.update({
          where: { id: featureId },
          data: { title: input.title, description: input.description || null },
        });
      },
    );
  }

  deleteFeature(
    member: Member,
    projectId: string,
    outcomeId: string,
    featureId: string,
  ) {
    return this.mutate(
      member,
      projectId,
      outcomeId,
      false,
      'FEATURE_DELETED',
      (db, outcome) => {
        this.requireFeature(outcome, featureId);
        return db.feature.delete({ where: { id: featureId } });
      },
    );
  }

  createTask(
    member: Member,
    projectId: string,
    outcomeId: string,
    featureId: string,
    input: WorkItemInput,
  ) {
    return this.mutate(
      member,
      projectId,
      outcomeId,
      false,
      'TASK_CREATED',
      (db, outcome) => {
        const feature = this.requireFeature(outcome, featureId);
        return db.task.create({
          data: {
            featureId,
            title: input.title,
            description: input.description || null,
            position: (feature.tasks.at(-1)?.position ?? -1) + 1,
            createdByMemberId: member.id,
          },
        });
      },
    );
  }

  editTask(
    member: Member,
    projectId: string,
    outcomeId: string,
    taskId: string,
    input: EditWorkItem,
  ) {
    return this.mutate(
      member,
      projectId,
      outcomeId,
      false,
      'TASK_UPDATED',
      (db, outcome) => {
        this.requireVersion(
          this.requireTask(outcome, taskId).updatedAt,
          input.updatedAt,
        );
        return db.task.update({
          where: { id: taskId },
          data: { title: input.title, description: input.description || null },
        });
      },
    );
  }

  setTaskState(
    member: Member,
    projectId: string,
    outcomeId: string,
    taskId: string,
    input: TaskStateInput,
  ) {
    return this.mutate(
      member,
      projectId,
      outcomeId,
      true,
      input.status === 'DONE' ? 'TASK_COMPLETED' : 'TASK_REOPENED',
      (db, outcome) => {
        const task = this.requireTask(outcome, taskId);
        this.requireVersion(task.updatedAt, input.updatedAt);
        if (task.status === input.status) return Promise.resolve();
        return db.task.update({
          where: { id: taskId },
          data: {
            status: input.status,
            completedAt: input.status === 'DONE' ? new Date() : null,
            completedByMemberId: input.status === 'DONE' ? member.id : null,
          },
        });
      },
    );
  }

  deleteTask(
    member: Member,
    projectId: string,
    outcomeId: string,
    taskId: string,
  ) {
    return this.mutate(
      member,
      projectId,
      outcomeId,
      false,
      'TASK_DELETED',
      (db, outcome) => {
        this.requireTask(outcome, taskId);
        return db.task.delete({ where: { id: taskId } });
      },
    );
  }
}
