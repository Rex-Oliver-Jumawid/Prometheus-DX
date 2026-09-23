import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import type {
  SetVisiWorkPresenceRequest,
  VisiWorkPresenceResponse,
} from '../../shared/contracts/visiwork';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class VisiWorkService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async joinDepartment(
    member: Member,
    input: SetVisiWorkPresenceRequest,
  ): Promise<VisiWorkPresenceResponse> {
    const department = await this.prisma.department.findUnique({
      where: { id: input.departmentId },
      select: { id: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    await this.prisma.member.update({
      where: { id: member.id },
      data: { visiworkDepartmentId: department.id },
    });

    return {
      memberId: member.id,
      departmentId: department.id,
    };
  }
}
