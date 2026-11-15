import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Member } from '@prisma/client';
import type {
  VentureMembershipRequest,
  VentureSettings,
} from '../../shared/contracts/venture';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class VenturesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async access(
    db: Prisma.TransactionClient,
    actor: Member,
    ventureId: string,
  ) {
    const venture = await db.venture.findUnique({ where: { id: ventureId } });
    if (!venture) throw new NotFoundException('Venture not found.');
    const membership = await db.ventureMembership.findUnique({
      where: { ventureId_memberId: { ventureId, memberId: actor.id } },
    });
    const admin = actor.workspaceRole === 'ADMINISTRATOR';
    if (!admin && (!membership || membership.endedAt))
      throw new NotFoundException('Venture not found.');
    const permissions = membership?.endedAt
      ? []
      : (membership?.permissions ?? []);
    return {
      ...venture,
      canManage: admin || permissions.includes('venture.manage'),
      canManageMembers: admin || permissions.includes('venture.members.manage'),
      canGrantPermissions: admin,
    };
  }

  async list(actor: Member) {
    const ventures = await this.prisma.venture.findMany({
      where:
        actor.workspaceRole === 'ADMINISTRATOR'
          ? {}
          : { memberships: { some: { memberId: actor.id, endedAt: null } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return Promise.all(
      ventures.map((v) => this.access(this.prisma, actor, v.id)),
    );
  }

  async detail(actor: Member, ventureId: string) {
    const venture = await this.access(this.prisma, actor, ventureId);
    const [members, candidates, history] = await Promise.all([
      this.prisma.ventureMembership.findMany({
        where: { ventureId },
        include: { member: { select: { fullName: true, status: true } } },
        orderBy: { joinedAt: 'asc' },
      }),
      venture.canManageMembers
        ? this.prisma.member.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, fullName: true },
            orderBy: { fullName: 'asc' },
          })
        : [],
      this.prisma.ventureAuditEvent.findMany({
        where: { ventureId },
        select: { id: true, action: true, createdAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
    ]);
    return {
      venture,
      members: members.map((m) => ({
        ...m,
        fullName: m.member.fullName,
        memberStatus: m.member.status,
        active: !m.endedAt,
      })),
      candidates,
      history,
    };
  }

  private async lock(db: Prisma.TransactionClient) {
    // One hierarchy/grant lock keeps parent changes and membership revocations ordered.
    await db.$queryRaw`SELECT pg_advisory_xact_lock(165032, 1)::text`;
  }

  async save(actor: Member, input: VentureSettings, ventureId?: string) {
    return this.prisma.$transaction(async (db) => {
      await this.lock(db);
      if (!ventureId && actor.workspaceRole !== 'ADMINISTRATOR')
        throw new ForbiddenException(
          'Only workspace administrators can create ventures.',
        );
      if (ventureId && !(await this.access(db, actor, ventureId)).canManage)
        throw new ForbiddenException(
          'Venture management permission is required.',
        );
      if (input.parentId) {
        // A manager cannot infer or connect an unrelated private venture.
        await this.access(db, actor, input.parentId);
        const seen = new Set(ventureId ? [ventureId] : []);
        let parentId: string | null = input.parentId;
        while (parentId) {
          if (seen.has(parentId))
            throw new BadRequestException(
              'Venture hierarchy cannot contain a cycle.',
            );
          seen.add(parentId);
          const parent: { parentId: string | null; status: string } | null =
            await db.venture.findUnique({
              where: { id: parentId },
              select: { parentId: true, status: true },
            });
          if (!parent || parent.status !== 'ACTIVE')
            throw new BadRequestException('Choose an active parent venture.');
          parentId = parent.parentId;
        }
      }
      const venture = ventureId
        ? await db.venture.update({ where: { id: ventureId }, data: input })
        : await db.venture.create({ data: input });
      await db.ventureAuditEvent.create({
        data: {
          ventureId: venture.id,
          actorMemberId: actor.id,
          action: ventureId ? 'VENTURE_UPDATED' : 'VENTURE_CREATED',
          metadata: input,
        },
      });
      return venture;
    });
  }

  async membership(
    actor: Member,
    ventureId: string,
    input: VentureMembershipRequest,
  ) {
    return this.prisma.$transaction(async (db) => {
      await this.lock(db);
      const venture = await this.access(db, actor, ventureId);
      if (!venture.canManageMembers)
        throw new ForbiddenException(
          'Venture member management permission is required.',
        );
      if (venture.status === 'ARCHIVED')
        throw new ConflictException(
          'Archived venture memberships are read-only.',
        );
      const member = await db.member.findUnique({
        where: { id: input.memberId },
        select: { id: true, status: true, ventureId: true },
      });
      if (!member || (input.active && member.status !== 'ACTIVE'))
        throw new BadRequestException('Choose an active workspace member.');
      const previous = await db.ventureMembership.findUnique({
        where: { ventureId_memberId: { ventureId, memberId: member.id } },
      });
      // Scoped managers cannot delegate privileges or revive grants on a past membership.
      const previousPermissions =
        previous && !previous.endedAt ? previous.permissions : [];
      if (
        !venture.canGrantPermissions &&
        JSON.stringify([...input.permissions].sort()) !==
          JSON.stringify([...previousPermissions].sort())
      )
        throw new ForbiddenException(
          'Only workspace administrators may change venture management grants.',
        );
      const result = await db.ventureMembership.upsert({
        where: { ventureId_memberId: { ventureId, memberId: member.id } },
        create: {
          ventureId,
          memberId: member.id,
          roles: input.roles,
          founder: input.founder,
          permissions: input.active ? input.permissions : [],
          endedAt: input.active ? null : new Date(),
        },
        update: {
          roles: input.roles,
          founder: input.founder,
          permissions: input.active ? input.permissions : [],
          endedAt: input.active ? null : new Date(),
        },
      });
      if (!input.active) {
        const replacement = await db.ventureMembership.findFirst({
          where: {
            memberId: member.id,
            endedAt: null,
            venture: { status: 'ACTIVE' },
          },
          orderBy: { joinedAt: 'asc' },
        });
        await db.member.updateMany({
          where: { id: member.id, ventureId },
          data: { ventureId: replacement?.ventureId ?? null },
        });
        await db.member.updateMany({
          where: { id: member.id, visiworkVentureId: ventureId },
          data: { visiworkVentureId: null },
        });
      } else if (!member.ventureId) {
        await db.member.update({
          where: { id: member.id },
          data: { ventureId },
        });
      }
      await db.ventureAuditEvent.create({
        data: {
          ventureId,
          actorMemberId: actor.id,
          action: input.active ? 'MEMBERSHIP_SAVED' : 'MEMBERSHIP_ENDED',
          metadata: {
            before: previous
              ? {
                  roles: previous.roles,
                  permissions: previous.permissions,
                  founder: previous.founder,
                  active: !previous.endedAt,
                }
              : null,
            after: input,
          },
        },
      });
      return result;
    });
  }
}
