import { Controller, Get, UseGuards } from '@nestjs/common';
import type { Member } from '@prisma/client';
import {
  CurrentMemberSchema,
  type CurrentMember as CurrentMemberResponse,
} from '../../shared/contracts/member';
import { CurrentMember } from './current-member.decorator';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Controller('me')
@UseGuards(SupabaseAuthGuard)
export class MeController {
  @Get()
  getMe(@CurrentMember() member: Member): CurrentMemberResponse {
    return CurrentMemberSchema.parse({
      id: member.id,
      email: member.email,
      fullName: member.fullName,
      workspaceRole: member.workspaceRole,
      status: member.status,
      position: member.position,
      profileImagePath: member.profileImagePath,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    });
  }
}
