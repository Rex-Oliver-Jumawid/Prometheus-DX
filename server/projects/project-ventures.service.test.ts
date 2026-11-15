import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { ProjectsService } from './projects.service';

const actor = { id: 'lead', workspaceRole: 'ADMINISTRATOR' } as Member;
function setup(leadMemberId: string, status = 'PLANNING') {
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    project: { findUnique: vi.fn().mockResolvedValue({ leadMemberId }), findUniqueOrThrow: vi.fn().mockResolvedValue({ status }) },
    venture: { findMany: vi.fn().mockResolvedValue([]) },
    projectVenture: { deleteMany: vi.fn(), createMany: vi.fn() },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  const service = new ProjectsService(db as unknown as PrismaService);
  return { service, db };
}
describe('project venture reassignment', () => {
  it('does not let a workspace administrator bypass Project Lead authority', async () => {
    const { service, db } = setup('another-lead');
    await expect(service.updateVentures(actor, 'project', [])).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.projectVenture.deleteMany).not.toHaveBeenCalled();
  });
  it('enforces archived read-only behavior below the UI', async () => {
    const { service, db } = setup(actor.id, 'ARCHIVED');
    await expect(service.updateVentures(actor, 'project', [])).rejects.toBeInstanceOf(BadRequestException);
    expect(db.projectVenture.deleteMany).not.toHaveBeenCalled();
  });
  it('allows the Lead to clear optional grouping and records the change', async () => {
    const { service, db } = setup(actor.id);
    vi.spyOn(service, 'getProject').mockResolvedValue({} as Awaited<ReturnType<ProjectsService['getProject']>>);
    await service.updateVentures(actor, 'project', []);
    expect(db.projectVenture.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'project' } });
    expect(db.projectVenture.createMany).not.toHaveBeenCalled();
    expect(db.activityLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'PROJECT_VENTURES_UPDATED', metadata: { ventureIds: [] } }) }));
  });
});
