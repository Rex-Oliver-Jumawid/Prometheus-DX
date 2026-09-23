import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { Member } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { ProjectActivityService } from './project-activity.service';
import { ProjectWorkflowService } from './project-workflow.service';

const enabled = process.env.RUN_DATABASE_INTEGRATION === '1';
const db = new PrismaService();
const feed = new ProjectActivityService(db);
const workflow = new ProjectWorkflowService(db);
const runId = 'project-activity-integration-' + randomUUID();
let departmentId = '';
let projectId = '';
let outcomeId = '';
let lead: Member;

describe.runIf(enabled)('Project Activity PostgreSQL integration', () => {
  beforeAll(async () => {
    const department = await db.department.create({
      data: { name: runId, shortLabel: 'ACTLOG' },
    });
    departmentId = department.id;
    lead = await db.member.create({
      data: {
        email: runId + '@example.com',
        fullName: 'Activity Lead',
        departmentId,
        status: 'ACTIVE',
      },
    });
    const project = await db.project.create({
      data: {
        name: runId,
        description: 'Activity audit integration fixture.',
        createdByMemberId: lead.id,
        leadMemberId: lead.id,
        departments: { create: { departmentId } },
        stages: {
          create: {
            name: 'Audit stage',
            position: 0,
            outcomes: {
              create: {
                title: 'Retired audit outcome',
                position: 0,
                createdByMemberId: lead.id,
                departments: { create: { departmentId } },
              },
            },
          },
        },
      },
      include: { stages: { include: { outcomes: true } } },
    });
    projectId = project.id;
    outcomeId = project.stages[0].outcomes[0].id;
  }, 30_000);

  afterAll(async () => {
    if (projectId) await db.project.delete({ where: { id: projectId } });
    if (lead?.id) await db.member.delete({ where: { id: lead.id } });
    if (departmentId) await db.department.delete({ where: { id: departmentId } });
    await db.$disconnect();
  }, 30_000);

  it('keeps earlier events and redacts private submission text after Outcome deletion', async () => {
    const secret = 'PRIVATE-DRAFT-' + runId;
    const original = await db.activityLog.create({
      data: {
        projectId,
        outcomeId,
        actorMemberId: lead.id,
        entityType: 'OutcomeSubmission',
        entityId: randomUUID(),
        action: 'SUBMISSION_CREATED',
        metadata: { content: secret, reviewNote: secret },
      },
    });
    await workflow.deleteOutcome(lead, projectId, outcomeId);
    const surviving = await db.activityLog.findUniqueOrThrow({ where: { id: original.id } });
    expect(surviving.outcomeId).toBeNull();
    const events = await feed.list(lead, projectId);
    expect(events.items.some((item) => item.id === original.id)).toBe(true);
    expect(events.items.find((item) => item.id === original.id)?.metadata).toEqual({});
    expect(events.items.some((item) =>
      item.action === 'OUTCOME_DELETED' && item.metadata.title === 'Retired audit outcome',
    )).toBe(true);
    expect(JSON.stringify(events)).not.toContain(secret);
  });

  it('paginates existing events without duplicates when a newer event arrives', async () => {
    await db.activityLog.createMany({
      data: Array.from({ length: 27 }, (_, index) => ({
        projectId,
        actorMemberId: lead.id,
        entityType: 'Project',
        entityId: projectId,
        action: 'PROJECT_STATUS_CHANGED',
        metadata: { fromStatus: 'PLANNING', toStatus: 'IN_PROGRESS', index },
      })),
    });
    const countBefore = await db.activityLog.count({ where: { projectId } });
    const first = await feed.list(lead, projectId);
    expect(first.items).toHaveLength(25);
    expect(first.nextCursor).not.toBeNull();
    await db.activityLog.create({
      data: {
        projectId,
        actorMemberId: lead.id,
        entityType: 'Project',
        entityId: projectId,
        action: 'PROJECT_CREATED',
        metadata: { name: runId },
      },
    });
    const older = await feed.list(lead, projectId, first.nextCursor!);
    const combined = [...first.items, ...older.items];
    expect(combined).toHaveLength(countBefore);
    expect(new Set(combined.map((item) => item.id)).size).toBe(countBefore);
  });

  it('retains the SET NULL foreign key, keyset index and RLS protections', async () => {
    const fk = await db.$queryRaw<Array<{ confdeltype: string }>>`
      SELECT confdeltype::text AS confdeltype
      FROM pg_constraint WHERE conname = 'activity_logs_outcome_id_fkey'
    `;
    expect(fk).toEqual([{ confdeltype: 'n' }]);
    const index = await db.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'activity_logs_project_id_created_at_id_idx'
    `;
    expect(index).toHaveLength(1);
    expect(index[0].indexdef).toContain('created_at DESC');
    const tables = await db.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE oid IN ('public.activity_logs'::regclass, 'public.project_messages'::regclass)
    `;
    expect(tables).toHaveLength(2);
    expect(tables.every((table) => table.relrowsecurity)).toBe(true);
    const roles = await db.$queryRaw<Array<{ rolname: string }>>`
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    `;
    for (const role of roles) {
      for (const table of ['activity_logs', 'project_messages']) {
        const [privileges] = await db.$queryRaw<
          Array<{ read_access: boolean; write_access: boolean }>
        >`
          SELECT
            has_table_privilege(${role.rolname}, ${'public.' + table}, 'SELECT') AS read_access,
            has_table_privilege(${role.rolname}, ${'public.' + table}, 'INSERT,UPDATE,DELETE') AS write_access
        `;
        expect(privileges).toEqual({ read_access: false, write_access: false });
      }
    }
  });
});
