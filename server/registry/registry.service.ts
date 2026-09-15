import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateDepartmentRequest,
  RegistryDepartment,
  UpdateDepartmentRequest,
} from '../../shared/contracts/registry';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RegistryService {
  constructor(private readonly prisma: PrismaService) {}

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
        description: input.description,
      },
      include: { _count: { select: { members: true } } },
    });

    return this.toDepartment(updated);
  }

  private toDepartment(department: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { members: number };
  }): RegistryDepartment {
    return {
      id: department.id,
      name: department.name,
      description: department.description,
      memberCount: department._count.members,
      createdAt: department.createdAt.toISOString(),
      updatedAt: department.updatedAt.toISOString(),
    };
  }
}
