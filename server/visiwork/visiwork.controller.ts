import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { Member } from '@prisma/client';
import { SetVisiWorkPresenceRequestSchema } from '../../shared/contracts/visiwork';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { VisiWorkService } from './visiwork.service';

@Controller('visiwork')
@UseGuards(SupabaseAuthGuard)
export class VisiWorkController {
  constructor(
    @Inject(VisiWorkService)
    private readonly visiworkService: VisiWorkService,
  ) {}

  @Put('presence')
  joinDepartment(
    @CurrentMember() member: Member,
    @Body() body: unknown,
  ) {
    const parsed = SetVisiWorkPresenceRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid VisiWork department.',
      );
    }
    return this.visiworkService.joinDepartment(member, parsed.data);
  }
}
