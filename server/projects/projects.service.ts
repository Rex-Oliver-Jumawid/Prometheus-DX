import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberStatus, Prisma, type Member } from '@prisma/client';
import type {
  CreateProjectRequest,
  Project,
} from '../../shared/contracts/project';
import { PrismaService } from '../database/prisma.service';

const projectInclude = {
  createdByMember: { select: { id: true, fullName: true, email: true } },
  leadMember: { select: { id: true, fullName: true, email: true } },
  departments: {
    include: {
      department: { select: { id: true, name: true, shortLabel: true } },
    },
  },
} satisfies Prisma.ProjectInclude;

type ProjectRecord = Prisma.ProjectGetPayload<{
  include: typeof projectInclude;
}>;

@Injectable()
export class ProjectsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listProjects(): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      include: projectInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return projects.map((project) => this.toProject(project));
  }

  async getProject(projectId: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: projectInclude,
    });
    if (!project) throw new NotFoundException('Project not found.');
    return this.toProject(project);
  }

  async createProject(
    currentMember: Member,
    input: CreateProjectRequest,
  ): Promise<Project> {
    const project = await this.prisma.$transaction(async (transaction) => {
      const [lead, departments] = await Promise.all([
        transaction.member.findUnique({
          where: { id: input.leadMemberId },
          select: { id: true, status: true },
        }),
        transaction.department.findMany({
          where: { id: { in: input.departmentIds } },
          select: { id: true },
        }),
      ]);

      if (!lead) {
        throw new BadRequestException('Choose an existing Project Lead.');
      }
      if (lead.status !== MemberStatus.ACTIVE) {
        throw new BadRequestException('Choose an active Project Lead.');
      }
      if (departments.length !== input.departmentIds.length) {
        throw new BadRequestException('Choose only existing departments.');
      }

      return transaction.project.create({
        data: {
          name: input.name,
          description: input.description,
          createdByMemberId: currentMember.id,
          leadMemberId: lead.id,
          departments: {
            create: input.departmentIds.map((departmentId) => ({
              departmentId,
            })),
          },
          statusHistory: {
            create: {
              toStatus: 'PLANNING',
              changedByMemberId: currentMember.id,
              changeSource: 'USER',
            },
          },
        },
        include: projectInclude,
      });
    });

    return this.toProject(project);
  }

  private toProject(project: ProjectRecord): Project {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      lead: project.leadMember,
      creator: project.createdByMember,
      departments: project.departments.map(({ department }) => department),
      doneAt: project.doneAt?.toISOString() ?? null,
      archivedAt: project.archivedAt?.toISOString() ?? null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}
