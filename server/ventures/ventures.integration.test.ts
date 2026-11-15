import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Member } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { VentureDetailSchema } from '../../shared/contracts/venture';
import { ProjectsService } from '../projects/projects.service';
import { ProjectWorkflowService } from '../projects/project-workflow.service';
import { VenturesService } from './ventures.service';

describe.runIf(process.env.RUN_DATABASE_INTEGRATION === '1')('venture persistence and authorization', () => {
  const db = new PrismaService();
  const service = new VenturesService(db);
  const prefix = `venture-test-${randomUUID()}`;
  const ids: string[] = [];
  let admin: Member;
  let founder: Member;
  let outsider: Member;
  let first: string;
  let second: string;
  const settings = (name: string) => ({ name, shortLabel: 'VT', description: null, parentId: null, status: 'ACTIVE' as const });
  beforeAll(async () => {
    [admin, founder, outsider] = await Promise.all(['admin', 'founder', 'outsider'].map(role => db.member.create({ data: { fullName: role, email: `${prefix}-${role}@example.test`, status: 'ACTIVE', workspaceRole: role === 'admin' ? 'ADMINISTRATOR' : 'MEMBER' } })));
    first = (await service.save(admin, settings(`${prefix}-parent`))).id;
    ids.push(first);
    second = (await service.save(admin, { ...settings(`${prefix}-child`), parentId: first })).id;
    ids.push(second);
  });
  afterAll(async () => {
    await db.ventureAuditEvent.deleteMany({ where: { ventureId: { in: ids } } });
    await db.ventureMembership.deleteMany({ where: { ventureId: { in: ids } } });
    await db.member.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.venture.updateMany({ where: { id: { in: ids } }, data: { parentId: null } });
    await db.venture.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  it('allows an authorized workspace member to have no venture', async () => {
    expect(founder.ventureId).toBeNull();
    expect(await service.list(founder)).toEqual([]);
  });
  it('preserves the complete project and outcome creation path with no venture assignment', async () => {
    const project = await new ProjectsService(db).createProject(admin, { name: prefix, description: 'Ungrouped delivery', leadMemberId: admin.id, ventureIds: [] });
    try {
      const workflow = new ProjectWorkflowService(db);
      const stage = await workflow.createStage(admin, project.id, { name: 'Delivery' });
      const outcome = await workflow.createOutcome(admin, project.id, stage.id, { title: 'Independent outcome', description: null, ventureIds: [], acceptanceCriteria: ['Delivery is verified.'], prerequisiteOutcomeIds: [], memberIds: [] });
      expect(outcome.ventures).toEqual([]);
      expect(await db.outcome.count({ where: { id: outcome.id } })).toBe(1);
    } finally {
      await db.project.delete({ where: { id: project.id } });
    }
  });

  it('stores several roles across two ventures without duplicate membership' , async () => {
    const input = { memberId: founder.id, roles: ['CEO', 'CTO'] as ('CEO' | 'CTO')[], permissions: [], founder: true, active: true };
    await Promise.all([service.membership(admin, first, input), service.membership(admin, second, input)]);
    await service.membership(admin, second, input);
    expect(await db.ventureMembership.count({ where: { memberId: founder.id, endedAt: null } })).toBe(2);
    const detail = VentureDetailSchema.parse(JSON.parse(JSON.stringify(await service.detail(founder, second))));
    expect(detail.members[0].roles).toEqual(['CEO', 'CTO']);
    await expect(service.detail(outsider, second)).rejects.toThrow('Venture not found');
  });
  it('rejects concurrent hierarchy changes that would form a cycle', async () => {
    await expect(service.save(admin, { ...settings('cycle'), parentId: second }, first)).rejects.toThrow('cycle');
    expect((await db.venture.findUniqueOrThrow({ where: { id: first } })).parentId).toBeNull();
  });
  it('rolls back unauthorized management without adding history', async () => {
    const count = await db.ventureAuditEvent.count({ where: { ventureId: second } });
    await expect(service.save(founder, settings('unauthorized'), second)).rejects.toThrow('permission');
    expect(await db.ventureAuditEvent.count({ where: { ventureId: second } })).toBe(count);
  });
  it('ends membership and preserves role history without leaving access or focus', async () => {
    await db.member.update({ where: { id: founder.id }, data: { visiworkVentureId: second } });
    await service.membership(admin, second, { memberId: founder.id, roles: ['CEO'], permissions: [], founder: true, active: false });
    await expect(service.detail(founder, second)).rejects.toThrow('Venture not found');
    const ended = await db.ventureMembership.findUniqueOrThrow({ where: { ventureId_memberId: { ventureId: second, memberId: founder.id } } });
    expect(ended.endedAt).not.toBeNull();
    expect((await db.member.findUniqueOrThrow({ where: { id: founder.id } })).visiworkVentureId).toBeNull();
    expect(await db.ventureAuditEvent.count({ where: { ventureId: second, action: 'MEMBERSHIP_ENDED' } })).toBe(1);
  });
  it('enforces database role constraints and blocks direct browser-role access', async () => {
    await expect(db.ventureMembership.update({ where: { ventureId_memberId: { ventureId: first, memberId: founder.id } }, data: { roles: ['INVENTED'] } })).rejects.toThrow();
    const [privileges] = await db.$queryRaw<{ allowed: boolean }[]>`SELECT has_table_privilege('authenticated', 'public.venture_memberships', 'SELECT') AS allowed`;
    expect(privileges.allowed).toBe(false);
  });
});
