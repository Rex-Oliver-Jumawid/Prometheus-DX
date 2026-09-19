import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { Member } from '@prisma/client';
import {
  CurrentMemberSchema,
  UpdateCurrentMemberRequestSchema,
  type CurrentMember as CurrentMemberResponse,
} from '../../shared/contracts/member';
import { PrismaService } from '../database/prisma.service';
import { CurrentMember } from './current-member.decorator';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Controller('me')
@UseGuards(SupabaseAuthGuard)
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  private async toResponse(member: Member): Promise<CurrentMemberResponse> {
    const department = await this.prisma.department.findUnique({
      where: { id: member.departmentId },
      select: { id: true, name: true, shortLabel: true },
    });

    if (!department) {
      throw new BadRequestException(
        'Your member record is not assigned to a valid department.',
      );
    }

    return CurrentMemberSchema.parse({
      id: member.id,
      email: member.email,
      fullName: member.fullName,
      workspaceRole: member.workspaceRole,
      status: member.status,
      position: member.position,
      profileImagePath: member.profileImagePath,
      department,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    });
  }

  @Get()
  getMe(@CurrentMember() member: Member): Promise<CurrentMemberResponse> {
    return this.toResponse(member);
  }

  @Patch()
  async updateMe(
    @CurrentMember() member: Member,
    @Body() body: unknown,
  ): Promise<CurrentMemberResponse> {
    const parsed = UpdateCurrentMemberRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Profile details are invalid.');
    }

    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: {
        fullName: parsed.data.fullName,
        position: parsed.data.position,
        ...(parsed.data.profileImagePath !== undefined
          ? { profileImagePath: parsed.data.profileImagePath }
          : {}),
      },
    });

    return this.toResponse(updated);
  }
}
