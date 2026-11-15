import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Member } from '@prisma/client';
import {
  VentureMembershipRequestSchema,
  VentureSettingsSchema,
} from '../../shared/contracts/venture';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { VenturesService } from './ventures.service';

@Controller('ventures')
@UseGuards(SupabaseAuthGuard)
export class VenturesController {
  constructor(
    @Inject(VenturesService) private readonly ventures: VenturesService,
  ) {}
  @Get()
  list(@CurrentMember() actor: Member) {
    return this.ventures.list(actor);
  }
  @Get(':id')
  detail(
    @CurrentMember() actor: Member,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.ventures.detail(actor, id);
  }
  @Post()
  create(@CurrentMember() actor: Member, @Body() body: unknown) {
    const result = VentureSettingsSchema.safeParse(body);
    if (!result.success)
      throw new BadRequestException(result.error.issues[0]?.message);
    return this.ventures.save(actor, result.data);
  }
  @Patch(':id')
  save(
    @CurrentMember() actor: Member,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const result = VentureSettingsSchema.safeParse(body);
    if (!result.success)
      throw new BadRequestException(result.error.issues[0]?.message);
    return this.ventures.save(actor, result.data, id);
  }
  @Post(':id/members')
  membership(
    @CurrentMember() actor: Member,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const result = VentureMembershipRequestSchema.safeParse(body);
    if (!result.success)
      throw new BadRequestException(result.error.issues[0]?.message);
    return this.ventures.membership(actor, id, result.data);
  }
}
