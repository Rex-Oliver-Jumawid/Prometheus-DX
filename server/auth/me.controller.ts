import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async toResponse(member: Member): Promise<CurrentMemberResponse> {
    const venture = member.ventureId ? await this.prisma.venture.findUnique({
      where: { id: member.ventureId },
      select: { id: true, name: true, shortLabel: true },
    }) : null;

    return CurrentMemberSchema.parse({
      id: member.id,
      email: member.email,
      fullName: member.fullName,
      workspaceRole: member.workspaceRole,
      status: member.status,
      position: member.position,
      nickname: member.nickname,
      phoneNumber: member.phoneNumber,
      about: member.about,
      profileImagePath: member.profileImagePath,
      venture,
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
        nickname: parsed.data.nickname,
        phoneNumber: parsed.data.phoneNumber,
        about: parsed.data.about,
        ...(parsed.data.profileImagePath !== undefined
          ? { profileImagePath: parsed.data.profileImagePath }
          : {}),
      },
    });

    return this.toResponse(updated);
  }
}
