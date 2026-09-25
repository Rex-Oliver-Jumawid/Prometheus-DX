import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import type {
  CompleteAccountSetupRequest,
  CompleteAccountSetupResponse,
  CreateDepartmentRequest,
  CreateMemberRequest,
  RegistryDepartment,
  RegistryMember,
  RegistryOverviewResponse,
  UpdateDepartmentRequest,
  UpdateMemberRequest,
} from '../../shared/contracts/registry';
import { serverEnvironment } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import {
  INVITATION_DELIVERY,
  type InvitationDelivery,
} from './invitation.service';

@Injectable()
export class RegistryService {
  private readonly logger = new Logger(RegistryService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(INVITATION_DELIVERY)
    private readonly invitationDelivery: InvitationDelivery,
  ) {}

  async completeAccountSetup(
    input: CompleteAccountSetupRequest,
  ): Promise<CompleteAccountSetupResponse> {
    const member = await this.prisma.member.findFirst({
      where: {
        email: { equals: input.email, mode: 'insensitive' },
        authUserId: null,
        status: { in: ['INVITED', 'ACTIVE'] },
        invitationSentAt: { not: null },
      },
      select: { id: true, email: true },
    });
    if (!member) {
      throw new BadRequestException(
        'This invitation is no longer available. Ask an administrator for a new invitation.',
      );
    }

    const supabaseUrl = serverEnvironment.supabaseUrl;
    const serviceRoleKey = serverEnvironment.supabaseServiceRoleKey;
    if (!supabaseUrl || !serviceRoleKey) {
      throw new ServiceUnavailableException(
        'Account setup is temporarily unavailable.',
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const { data, error } = await admin.auth.admin.createUser({
      email: member.email,
      password: input.password,
      email_confirm: true,
    });
    if (error || !data.user) {
      this.logger.error(
        `Failed to create Supabase Auth user for member ${member.id}: ${error?.message ?? 'No user returned.'}`,
      );
      throw new BadRequestException(
        error?.message?.toLowerCase().includes('already')
          ? 'An account already exists for this email. Sign in instead.'
          : 'The account could not be created. Ask an administrator to resend the invitation.',
      );
    }

    try {
      const linked = await this.prisma.member.updateMany({
        where: {
          id: member.id,
          authUserId: null,
          status: { in: ['INVITED', 'ACTIVE'] },
        },
        data: {
          authUserId: data.user.id,
          status: 'ACTIVE',
          deactivatedAt: null,
        },
      });
      if (linked.count !== 1) {
        await admin.auth.admin.deleteUser(data.user.id);
        throw new BadRequestException(
          'This invitation has already been used. Sign in instead.',
        );
      }
    } catch (error) {
      if (!(error instanceof BadRequestException)) {
        await admin.auth.admin.deleteUser(data.user.id);
      }
      throw error;
    }

    return { readyToSignIn: true };
  }

  async getOverview(): Promise<RegistryOverviewResponse> {
    const [departments, members] = await Promise.all([
      this.listDepartments(),
      this.listMembers(),
    ]);
    return { departments, members };
  }

  async listDepartments(): Promise<RegistryDepartment[]> {
    const departments = await this.prisma.department.findMany({
      include: {
        _count: {
          select: {
            members: {
              where: {
                NOT: {
                  status: 'DEACTIVATED',
                  authUserId: null,
                  invitationSentAt: null,
                },
              },
            },
            projects: true,
            outcomes: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });

    return departments.map((department) => this.toDepartment(department));
  }

  async createDepartment(
    input: CreateDepartmentRequest,
  ): Promise<RegistryDepartment> {
    const department = await this.prisma.department.create({
      data: {
        name: input.name,
        shortLabel: input.shortLabel || input.name.slice(0, 8),
        description: input.description,
      },
      include: {
        _count: {
          select: { members: true, projects: true, outcomes: true },
        },
      },
    });

    return this.toDepartment(department);
  }

  async updateDepartment(
    departmentId: string,
    input: UpdateDepartmentRequest,
  ): Promise<RegistryDepartment> {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });
    if (!department) throw new NotFoundException('Department not found.');

    const updated = await this.prisma.department.update({
      where: { id: departmentId },
      data: {
        name: input.name,
        shortLabel: input.shortLabel || input.name.slice(0, 8),
        description: input.description,
      },
      include: {
        _count: {
          select: { members: true, projects: true, outcomes: true },
        },
      },
    });

    return this.toDepartment(updated);
  }

  async deleteDepartment(departmentId: string): Promise<{ id: string }> {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: {
        id: true,
        _count: {
          select: {
            members: true,
            projects: true,
            outcomes: true,
          },
        },
      },
    });
    if (!department) throw new NotFoundException('Department not found.');

    if (
      department._count.members > 0 ||
      department._count.projects > 0 ||
      department._count.outcomes > 0
    ) {
      const references: string[] = [];
      if (department._count.members > 0) {
        references.push(
          `${department._count.members} ${department._count.members === 1 ? 'member' : 'members'}`,
        );
      }
      if (department._count.projects > 0) {
        references.push(
          `${department._count.projects} ${department._count.projects === 1 ? 'project' : 'projects'}`,
        );
      }
      if (department._count.outcomes > 0) {
        references.push(
          `${department._count.outcomes} ${department._count.outcomes === 1 ? 'outcome' : 'outcomes'}`,
        );
      }
      throw new ConflictException(
        `This department is still in use: ${references.join(', ')}. Reassign or remove these references before deleting it.`,
      );
    }

    try {
      await this.prisma.department.delete({ where: { id: departmentId } });
      return { id: departmentId };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'This department is still in use. Remove its references before deleting it.',
        );
      }
      throw error;
    }
  }

  async listMembers(): Promise<RegistryMember[]> {
    const members = await this.prisma.member.findMany({
      where: {
        NOT: {
          status: 'DEACTIVATED',
          authUserId: null,
          invitationSentAt: null,
        },
      },
      include: { department: true },
      orderBy: [{ fullName: 'asc' }, { createdAt: 'asc' }],
    });

    return members.map((member) => this.toMember(member));
  }

  async createMember(input: CreateMemberRequest): Promise<RegistryMember> {
    await this.assertDepartmentExists(input.departmentId);

    const removedMember = await this.prisma.member.findFirst({
      where: {
        email: { equals: input.email, mode: 'insensitive' },
        status: 'DEACTIVATED',
        authUserId: null,
        invitationSentAt: null,
      },
      select: { id: true },
    });

    if (removedMember) {
      const restored = await this.prisma.member.update({
        where: { id: removedMember.id },
        data: {
          email: input.email,
          fullName: input.fullName,
          departmentId: input.departmentId,
          position: input.position,
          workspaceRole: input.workspaceRole,
          status: 'INVITED',
          deactivatedAt: null,
          invitationSentAt: null,
        },
        include: { department: true },
      });

      try {
        return await this.deliverInvitation(restored.id);
      } catch {
        this.logger.warn(
          `Invitation delivery is pending for restored member ${restored.id}.`,
        );
        return this.toMember(restored);
      }
    }

    await this.assertEmailAvailable(input.email);

    try {
      const member = await this.prisma.member.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          departmentId: input.departmentId,
          position: input.position,
          workspaceRole: input.workspaceRole,
          status: input.status,
          deactivatedAt: null,
        },
        include: { department: true },
      });

      const created = this.toMember({
        ...member,
        department: member.department,
        departmentId: member.departmentId,
        position: member.position,
      });

      try {
        return await this.deliverInvitation(member.id);
      } catch {
        this.logger.warn(
          `Invitation delivery is pending for newly created member ${member.id}.`,
        );
        return created;
      }
    } catch (error) {
      this.rethrowMemberWriteError(error);
    }
  }

  async updateMember(
    memberId: string,
    input: UpdateMemberRequest,
  ): Promise<RegistryMember> {
    const existing = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, authUserId: true, status: true, email: true },
    });
    if (!existing) throw new NotFoundException('Member not found.');
    if (
      input.status === 'ACTIVE' &&
      existing.status !== 'ACTIVE' &&
      !existing.authUserId
    ) {
      throw new BadRequestException(
        'This member cannot be activated until authentication is linked.',
      );
    }

    await this.assertDepartmentExists(input.departmentId);
    await this.assertEmailAvailable(input.email, memberId);

    try {
      const member = await this.prisma.member.update({
        where: { id: memberId },
        data: {
          email: input.email,
          fullName: input.fullName,
          departmentId: input.departmentId,
          position: input.position,
          workspaceRole: input.workspaceRole,
          status: input.status,
          invitationSentAt:
            existing.email.toLowerCase() === input.email.toLowerCase()
              ? undefined
              : null,
          deactivatedAt: input.status === 'DEACTIVATED' ? new Date() : null,
        },
        include: { department: true },
      });

      return this.toMember({
        ...member,
        department: member.department,
        departmentId: member.departmentId,
        position: member.position,
      });
    } catch (error) {
      this.rethrowMemberWriteError(error);
    }
  }

  async removeMember(
    memberId: string,
    actingMemberId: string,
  ): Promise<{ id: string }> {
    if (memberId === actingMemberId) {
      throw new BadRequestException(
        'You cannot remove your own administrator account.',
      );
    }

    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, authUserId: true },
    });
    if (!member) throw new NotFoundException('Member not found.');

    if (member.authUserId) {
      const supabaseUrl = serverEnvironment.supabaseUrl;
      const serviceRoleKey = serverEnvironment.supabaseServiceRoleKey;
      if (!supabaseUrl || !serviceRoleKey) {
        throw new ServiceUnavailableException(
          'Member removal is unavailable because Supabase admin credentials are not configured.',
        );
      }

      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
      const { error } = await admin.auth.admin.deleteUser(member.authUserId);
      if (error) {
        this.logger.error(
          `Failed to remove Supabase Auth user for member ${member.id}: ${error.message}`,
        );
        throw new ServiceUnavailableException(
          'The member account could not be removed from authentication. Try again.',
        );
      }
    }

    await this.prisma.member.update({
      where: { id: member.id },
      data: {
        authUserId: null,
        status: 'DEACTIVATED',
        invitationSentAt: null,
        deactivatedAt: new Date(),
        visiworkDepartmentId: null,
      },
    });

    return { id: member.id };
  }

  async sendMemberInvitation(memberId: string): Promise<RegistryMember> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, authUserId: true, status: true },
    });
    if (!member) throw new NotFoundException('Member not found.');
    if (member.authUserId) {
      throw new ConflictException(
        'This member already completed account setup.',
      );
    }
    if (member.status === 'DEACTIVATED') {
      throw new BadRequestException(
        'Reactivate this member before sending an invitation.',
      );
    }

    return this.deliverInvitation(memberId);
  }

  private async deliverInvitation(memberId: string): Promise<RegistryMember> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { department: true },
    });
    if (!member) throw new NotFoundException('Member not found.');

    await this.invitationDelivery.sendAccountSetupInvitation({
      email: member.email,
      fullName: member.fullName,
    });

    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: { invitationSentAt: new Date() },
      include: { department: true },
    });
    return this.toMember(updated);
  }

  private async assertEmailAvailable(
    email: string,
    exceptMemberId?: string,
  ): Promise<void> {
    const duplicate = await this.prisma.member.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        ...(exceptMemberId ? { id: { not: exceptMemberId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'That email already belongs to a Prometheus member.',
      );
    }
  }

  private async assertDepartmentExists(departmentId: string): Promise<void> {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });
    if (!department) {
      throw new BadRequestException('Choose an existing department.');
    }
  }

  private rethrowMemberWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'That email already belongs to a Prometheus member.',
      );
    }
    throw error;
  }

  private toDepartment(department: {
    id: string;
    name: string;
    shortLabel: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { members: number; projects: number; outcomes: number };
  }): RegistryDepartment {
    return {
      id: department.id,
      name: department.name,
      shortLabel: department.shortLabel,
      description: department.description,
      memberCount: department._count.members,
      projectCount: department._count.projects,
      outcomeCount: department._count.outcomes,
      createdAt: department.createdAt.toISOString(),
      updatedAt: department.updatedAt.toISOString(),
    };
  }

  private toMember(member: {
    id: string;
    authUserId: string | null;
    email: string;
    fullName: string;
    departmentId: string;
    department: { id: string; name: string; shortLabel: string };
    position: string | null;
    workspaceRole: 'ADMINISTRATOR' | 'MEMBER';
    status: 'INVITED' | 'ACTIVE' | 'DEACTIVATED';
    invitationSentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): RegistryMember {
    return {
      id: member.id,
      email: member.email,
      fullName: member.fullName,
      departmentId: member.departmentId,
      department: member.department,
      position: member.position,
      workspaceRole: member.workspaceRole,
      status: member.status,
      authenticationStatus: member.authUserId ? 'LINKED' : 'SETUP_PENDING',
      invitationDeliveryStatus: member.invitationSentAt ? 'SENT' : 'NOT_SENT',
      invitationSentAt: member.invitationSentAt?.toISOString() ?? null,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };
  }
}
