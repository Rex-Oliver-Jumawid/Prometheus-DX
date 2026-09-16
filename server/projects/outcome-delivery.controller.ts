import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { Member } from '@prisma/client';
import { z } from 'zod';
import {
  OutputDraftInputSchema,
  SubmitOutputInputSchema,
  ReviewDraftInputSchema,
  ReviewDecisionInputSchema,
  RevisionInputSchema,
  OutcomeVersionInputSchema,
  DependencyOverrideInputSchema,
} from '../../shared/contracts/outcome-delivery';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { OutcomeDeliveryService } from './outcome-delivery.service';

const RouteSchema = z.object({
  projectId: z.string().uuid(),
  outcomeId: z.string().uuid(),
});
function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException(
      parsed.error.issues[0]?.message ?? 'Invalid request.',
    );
  return parsed.data;
}

@Controller('projects/:projectId/outcomes/:outcomeId/delivery')
@UseGuards(SupabaseAuthGuard)
export class OutcomeDeliveryController {
  constructor(
    @Inject(OutcomeDeliveryService)
    private readonly delivery: OutcomeDeliveryService,
  ) {}
  @Get()
  get(@CurrentMember() member: Member, @Param() params: unknown) {
    const { projectId, outcomeId } = parse(RouteSchema, params);
    return this.delivery.getDelivery(member, projectId, outcomeId);
  }
  @Put('draft')
  draft(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId } = parse(RouteSchema, params);
    return this.delivery.saveDraft(
      member,
      projectId,
      outcomeId,
      parse(OutputDraftInputSchema, body),
    );
  }
  @Post('submissions')
  submit(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId } = parse(RouteSchema, params);
    return this.delivery.submit(
      member,
      projectId,
      outcomeId,
      parse(SubmitOutputInputSchema, body),
    );
  }

  @Put('review-draft')
  reviewDraft(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId } = parse(RouteSchema, params);
    return this.delivery.saveReviewDraft(
      member,
      projectId,
      outcomeId,
      parse(ReviewDraftInputSchema, body),
    );
  }

  @Post('submissions/:submissionId/reviews')
  review(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId, submissionId } = parse(
      RouteSchema.extend({ submissionId: z.string().uuid() }),
      params,
    );
    return this.delivery.reviewSubmission(
      member,
      projectId,
      outcomeId,
      submissionId,
      parse(ReviewDecisionInputSchema, body),
    );
  }

  @Post('request-revision')
  requestRevision(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId } = parse(RouteSchema, params);
    return this.delivery.requestRevision(
      member,
      projectId,
      outcomeId,
      parse(RevisionInputSchema, body),
    );
  }

  @Post('resolve-revision')
  resolveRevision(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId } = parse(RouteSchema, params);
    return this.delivery.resolveRevision(
      member,
      projectId,
      outcomeId,
      parse(OutcomeVersionInputSchema, body).outcomeUpdatedAt,
    );
  }

  @Post('accept')
  accept(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId } = parse(RouteSchema, params);
    return this.delivery.accept(
      member,
      projectId,
      outcomeId,
      parse(ReviewDecisionInputSchema, body),
    );
  }

  @Post('reopen')
  reopen(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId } = parse(RouteSchema, params);
    return this.delivery.reopen(
      member,
      projectId,
      outcomeId,
      parse(OutcomeVersionInputSchema, body).outcomeUpdatedAt,
    );
  }

  @Post('dependencies/:dependencyId/override')
  overrideDependency(
    @CurrentMember() member: Member,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { projectId, outcomeId, dependencyId } = parse(
      RouteSchema.extend({ dependencyId: z.string().uuid() }),
      params,
    );
    return this.delivery.overrideDependency(
      member,
      projectId,
      outcomeId,
      dependencyId,
      parse(DependencyOverrideInputSchema, body).reason,
    );
  }
}
