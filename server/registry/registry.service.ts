import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateDepartmentRequest,
  CreateMemberRequest,
  RegistryDepartment,
  RegistryMember,
  UpdateDepartmentRequest,
  UpdateMemberRequest,
} from '../../shared/contracts/registry';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RegistryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listDepartments(): Promise<RegistryDepartment[]> {
    const departments = await this.prisma.department.findMany({
      include: { _count: { select: { members: true } } },
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
      include: { _count: { select: { members: true } } },
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
      include: { _count: { select: { members: true } } },
    });

    return this.toDepartment(updated);
  }

  async listMembers(): Promise<RegistryMember[]> {
    const members = await this.prisma.member.findMany({
      include: { department: true },
      orderBy: [{ fullName: 'asc' }, { createdAt: 'asc' }],
    });

    return members.map((member) => this.toMember(member));
  }

  async createMember(input: CreateMemberRequest): Promise<RegistryMember> {
    await this.assertDepartmentExists(input.departmentId);
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

  async updateMember(
    memberId: string,
    input: UpdateMemberRequest,
  ): Promise<RegistryMember> {
    const existing = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, authUserId: true, status: true },
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
    _count: { members: number };
  }): RegistryDepartment {
    return {
      id: department.id,
      name: department.name,
      shortLabel: department.shortLabel,
      description: department.description,
      memberCount: department._count.members,
      createdAt: department.createdAt.toISOString(),
      updatedAt: department.updatedAt.toISOString(),
    };
  }

  private toMember(member: {
    id: string;
    authUserId: string | null;
    email: string;
    fullName: string;
    departmentId: string | null;
    department: { id: string; name: string; shortLabel: string } | null;
    position: string | null;
    workspaceRole: 'ADMINISTRATOR' | 'MEMBER';
    status: 'INVITED' | 'ACTIVE' | 'DEACTIVATED';
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
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };
  }
}
