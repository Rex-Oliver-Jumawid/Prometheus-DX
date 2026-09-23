import 'dotenv/config';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { ProjectChatService } from './project-chat.service';

const enabled = process.env.RUN_DATABASE_INTEGRATION === '1';
const db = new PrismaService();
const chat = new ProjectChatService(db);
const runId = 'project-chat-integration-' + randomUUID();
let departmentId = '';
let projectId = '';
let secondProjectId = '';
let lead: Awaited<ReturnType<typeof db.member.create>>;
let participant: typeof lead;
let viewer: typeof lead;

describe.runIf(enabled)('Project Chat PostgreSQL integration', () => {
  beforeAll(async () => {
    const department = await db.department.create({
      data: { name: runId, shortLabel: 'CHAT' },
    });
    departmentId = department.id;
    [lead, participant, viewer] = await Promise.all(
      ['lead', 'participant', 'viewer'].map((label) => db.member.create({
        data: {
          email: runId + '-' + label + '@example.com',
          fullName: label,
          status: 'ACTIVE',
          departmentId,
        },
      })),
    );
    const projects = await Promise.all(
      ['primary', 'secondary'].map((name) => db.project.create({
        data: {
          name: runId + '-' + name,
          description: 'Project Chat integration fixture.',
          createdByMemberId: lead.id,
          leadMemberId: lead.id,
          departments: { create: { departmentId } },
        },
      })),
    );
    projectId = projects[0].id;
    secondProjectId = projects[1].id;
    await db.projectMember.create({
      data: { projectId, memberId: participant.id, accessLevel: 'CAN_VIEW' },
    });
  }, 30_000);

  afterAll(async () => {
    if (projectId || secondProjectId) {
      await db.project.deleteMany({
        where: { id: { in: [projectId, secondProjectId].filter(Boolean) } },
      });
    }
    if (departmentId) {
      await db.member.deleteMany({ where: { email: { startsWith: runId } } });
      await db.department.delete({ where: { id: departmentId } });
    }
    await db.$disconnect();
  }, 30_000);

  it('persists replies, restricts author edits and isolates other Project messages', async () => {
    const root = await chat.send(lead, projectId, {
      body: 'Discussion opened', parentMessageId: null,
    });
    const reply = await chat.send(participant, projectId, {
      body: 'Reply persisted', parentMessageId: root.id,
    });
    const foreign = await chat.send(lead, secondProjectId, {
      body: 'Unrelated Project', parentMessageId: null,
    });

    const read = await chat.list(viewer, projectId);
    expect(read.canWrite).toBe(false);
    expect(read.items.find((item) => item.id === reply.id)?.replyTo?.id).toBe(root.id);
    expect(read.items.some((item) => item.id === foreign.id)).toBe(false);
    await expect(chat.send(viewer, projectId, {
      body: 'Not a Project Member', parentMessageId: null,
    })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(chat.send(participant, projectId, {
      body: 'Cross-Project reply', parentMessageId: foreign.id,
    })).rejects.toBeInstanceOf(BadRequestException);
    await expect(chat.edit(lead, projectId, reply.id, {
      body: 'Not my message', expectedEditedAt: null,
    })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(chat.edit(participant, secondProjectId, reply.id, {
      body: 'Wrong Project', expectedEditedAt: null,
    })).rejects.toBeInstanceOf(ForbiddenException);
    await chat.edit(participant, projectId, reply.id, { body: 'Author edit persisted', expectedEditedAt: null });
    const persisted = await db.projectMessage.findUniqueOrThrow({ where: { id: reply.id } });
    expect(persisted.body).toBe('Author edit persisted');
    expect(persisted.editedAt).not.toBeNull();
  });

  it('paginates deterministically even if a newer message arrives', async () => {
    await db.projectMessage.createMany({
      data: Array.from({ length: 32 }, (_, i) => ({
        projectId,
        memberId: lead.id,
        body: 'Pagination item ' + i,
      })),
    });
    const countBefore = await db.projectMessage.count({ where: { projectId } });
    const first = await chat.list(lead, projectId);
    expect(first.items).toHaveLength(30);
    expect(first.nextCursor).not.toBeNull();
    await chat.send(lead, projectId, { body: 'Newer item', parentMessageId: null });
    const second = await chat.list(lead, projectId, first.nextCursor!);
    const all = [...first.items, ...second.items];
    expect(all).toHaveLength(countBefore);
    expect(new Set(all.map((item) => item.id)).size).toBe(countBefore);
    expect(all.every((item) => item.body !== 'Unrelated Project')).toBe(true);
  });

  it('enforces archived Project read-only behavior', async () => {
    await db.project.update({
      where: { id: projectId }, data: { archivedAt: new Date() },
    });
    try {
      await expect(chat.send(lead, projectId, {
        body: 'After archive', parentMessageId: null,
      })).rejects.toBeInstanceOf(ConflictException);
      const read = await chat.list(participant, projectId);
      expect(read.canWrite).toBe(false);
      expect(read.items.every((item) => !item.canEdit)).toBe(true);
    } finally {
      await db.project.update({ where: { id: projectId }, data: { archivedAt: null } });
    }
  });

  it('keeps direct browser roles from accessing the message table', async () => {
    const [{ rls }] = await db.$queryRaw<Array<{ rls: boolean }>>`
      SELECT relrowsecurity AS rls FROM pg_class
      WHERE oid = 'public.project_messages'::regclass
    `;
    expect(rls).toBe(true);
    const roles = await db.$queryRaw<Array<{ rolname: string }>>`
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    `;
    for (const { rolname } of roles) {
      const [permissions] = await db.$queryRaw<Array<{ readable: boolean; writable: boolean }>>`
        SELECT has_table_privilege(${rolname}, 'public.project_messages', 'SELECT') AS readable,
               has_table_privilege(${rolname}, 'public.project_messages', 'INSERT,UPDATE,DELETE') AS writable
      `;
      expect(permissions).toEqual({ readable: false, writable: false });
    }
  });
});
