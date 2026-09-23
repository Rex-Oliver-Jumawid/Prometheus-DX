import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@prisma/client';
import type { PrismaService } from '../database/prisma.service';
import { VisiWorkService } from './visiwork.service';

describe('VisiWorkService', () => {
  it('moves the current member focus to the joined department', async () => {
    const departmentId = '22222222-2222-4222-8222-222222222222';
    const memberId = '11111111-1111-4111-8111-111111111111';
    const prisma = {
      department: {
        findUnique: vi.fn().mockResolvedValue({ id: departmentId }),
      },
      member: {
        update: vi.fn().mockResolvedValue({ id: memberId }),
      },
    } as unknown as PrismaService;
    const member = { id: memberId } as Member;

    const result = await new VisiWorkService(prisma).joinDepartment(member, {
      departmentId,
    });

    expect(prisma.department.findUnique).toHaveBeenCalledWith({
      where: { id: departmentId },
      select: { id: true },
    });
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: memberId },
      data: { visiworkDepartmentId: departmentId },
    });
    expect(result).toEqual({ memberId, departmentId });
  });
});
