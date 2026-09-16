import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Member } from '@prisma/client';
import { z } from 'zod';
import {
  EditWorkItemSchema,
  TaskStateInputSchema,
  WorkItemInputSchema,
} from '../../shared/contracts/outcome-work';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { OutcomeWorkService } from './outcome-work.service';

const RouteSchema = z.object({
  projectId: z.string().uuid(),
  outcomeId: z.string().uuid(),
});
const FeatureRouteSchema = RouteSchema.extend({ featureId: z.string().uuid() });
const TaskRouteSchema = RouteSchema.extend({ taskId: z.string().uuid() });
function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException(
      parsed.error.issues[0]?.message ?? 'Invalid request.',
    );
  return parsed.data;
}

@Controller('projects/:projectId/outcomes/:outcomeId/work')
@UseGuards(SupabaseAuthGuard)
export class OutcomeWorkController {
  constructor(
    @Inject(OutcomeWorkService) private readonly work: OutcomeWorkService,
  ) {}

  @Get()
  get(@CurrentMember() member: Member, @Param() params: unknown) {
    const { projectId, outcomeId } = parse(RouteSchema, params);
    return this.work.getWork(member, projectId, outcomeId);
  }

  @Post('features')
  createFeature(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId } = parse(RouteSchema, params);
    return this.work.createFeature(
      member,
      projectId,
      outcomeId,
      parse(WorkItemInputSchema, body),
    );
  }

  @Patch('features/:featureId')
  editFeature(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId, featureId } = parse(
      FeatureRouteSchema,
      params,
    );
    return this.work.editFeature(
      member,
      projectId,
      outcomeId,
      featureId,
      parse(EditWorkItemSchema, body),
    );
  }

  @Delete('features/:featureId')
  deleteFeature(@CurrentMember() member: Member, @Param() params: unknown) {
    const { projectId, outcomeId, featureId } = parse(
      FeatureRouteSchema,
      params,
    );
    return this.work.deleteFeature(member, projectId, outcomeId, featureId);
  }

  @Post('features/:featureId/tasks')
  createTask(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId, featureId } = parse(
      FeatureRouteSchema,
      params,
    );
    return this.work.createTask(
      member,
      projectId,
      outcomeId,
      featureId,
      parse(WorkItemInputSchema, body),
    );
  }

  @Patch('tasks/:taskId')
  editTask(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId, taskId } = parse(TaskRouteSchema, params);
    return this.work.editTask(
      member,
      projectId,
      outcomeId,
      taskId,
      parse(EditWorkItemSchema, body),
    );
  }

  @Patch('tasks/:taskId/state')
  setTaskState(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId, taskId } = parse(TaskRouteSchema, params);
    return this.work.setTaskState(
      member,
      projectId,
      outcomeId,
      taskId,
      parse(TaskStateInputSchema, body),
    );
  }

  @Delete('tasks/:taskId')
  deleteTask(@CurrentMember() member: Member, @Param() params: unknown) {
    const { projectId, outcomeId, taskId } = parse(TaskRouteSchema, params);
    return this.work.deleteTask(member, projectId, outcomeId, taskId);
  }
}
