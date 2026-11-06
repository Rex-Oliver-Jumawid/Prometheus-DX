import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { type Member, type Prisma } from '@prisma/client';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { serverEnvironment } from '../config/env';
import type { SaveVaultItemRequest } from '../../shared/contracts/project-vault';

const itemSelect = { id: true, projectId: true, title: true, kind: true, environment: true, description: true, fileName: true, currentVersion: true, createdAt: true, updatedAt: true } as const;

@Injectable()
export class ProjectVaultService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private key(): Buffer {
    if (!serverEnvironment.vaultEncryptionKey) throw new ServiceUnavailableException('Vault encryption key is not configured.');
    const key = Buffer.from(serverEnvironment.vaultEncryptionKey, 'base64');
    if (key.length !== 32) throw new ServiceUnavailableException('Invalid Vault key.');
    return key;
  }
  private async access(db: Prisma.TransactionClient, member: Member, projectId: string) {
    await db.$queryRawUnsafe('SELECT id FROM projects WHERE id = $1::uuid FOR UPDATE', projectId);
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { leadMemberId: true, archivedAt: true,
        members: { where: { memberId: member.id }, select: { accessLevel: true, createdAt: true }, take: 1 },
        vaultGrants: { where: { memberId: member.id }, select: { approvedAt: true }, take: 1 },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    const isLead = project.leadMemberId === member.id;
    const membership = project.members[0];
    const approval = project.vaultGrants[0]?.approvedAt;
    const canRead = member.status === 'ACTIVE' && (isLead ||
      Boolean(membership && approval && approval >= membership.createdAt));
    const canWrite = canRead && !project.archivedAt && (isLead || membership?.accessLevel === 'CAN_EDIT');
    return { isLead, canRead, canWrite, archived: Boolean(project.archivedAt) };
  }
  private requireRead(a: { canRead: boolean }) {
    if (!a.canRead) throw new ForbiddenException('Project Lead approval and active Project Membership are required for Vault access.');
  }
  private requireWrite(a: { canWrite: boolean; archived: boolean }) {
    if (a.archived) throw new ConflictException('Archived project vaults are read-only.');
    if (!a.canWrite) throw new ForbiddenException('Only approved Project editors and the Project Lead may modify Vault items.');
  }
  private bytes(input: SaveVaultItemRequest) {
    const bytes = Buffer.from(input.contentBase64, 'base64');
    if (!bytes.length || bytes.length > 262144 || bytes.toString('base64') !== input.contentBase64)
      throw new BadRequestException('Vault contents must contain 1 to 262144 bytes.');
    if (['ENV_FILE', 'FILE'].includes(input.kind) !== Boolean(input.fileName))
      throw new BadRequestException('Only file entries require a filename.');
    return bytes;
  }
  private encrypt(bytes: Buffer, projectId: string, itemId: string, versionNumber: number) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), nonce);
    cipher.setAAD(Buffer.from([projectId, itemId, versionNumber].join(':')));
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return { ciphertext: ciphertext.toString('base64'), nonce: nonce.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'), keyVersion: 1, byteLength: bytes.length };
  }
  private decrypt(v: { ciphertext: string; nonce: string; authTag: string; keyVersion: number },
    projectId: string, itemId: string, versionNumber: number) {
    if (v.keyVersion !== 1) throw new ServiceUnavailableException('Vault key version unavailable.');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(v.nonce, 'base64'));
    decipher.setAAD(Buffer.from([projectId, itemId, versionNumber].join(':')));
    decipher.setAuthTag(Buffer.from(v.authTag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(v.ciphertext, 'base64')), decipher.final()]);
  }
  private async audit(db: Prisma.TransactionClient, projectId: string, actorMemberId: string,
    action: string, itemId?: string, targetMemberId?: string) {
    await db.projectVaultAuditEvent.create({ data: { projectId, actorMemberId, action, itemId, targetMemberId } });
  }
  async status(member: Member, projectId: string) {
    return this.prisma.$transaction(async db => {
      const a = await this.access(db, member, projectId);
      const members = a.isLead ? await db.projectMember.findMany({
        where: { projectId, member: { status: 'ACTIVE' } },
        include: { member: { select: { fullName: true } } },
        orderBy: [{ createdAt: 'asc' }, { memberId: 'asc' }],
      }) : [];
      const grants = a.isLead ? await db.projectVaultGrant.findMany({ where: { projectId } }) : [];
      const approvals = new Map(grants.map(g => [g.memberId, g.approvedAt]));
      return { isLead: a.isLead, canRead: a.canRead, canWrite: a.canWrite,
        members: members.map(m => ({ memberId: m.memberId, name: m.member.fullName, accessLevel: m.accessLevel,
          approved: Boolean(approvals.get(m.memberId) && approvals.get(m.memberId)! >= m.createdAt) })) };
    });
  }
  async grant(member: Member, projectId: string, targetMemberId: string, approved: boolean) {
    return this.prisma.$transaction(async db => {
      const a = await this.access(db, member, projectId);
      if (!a.isLead) throw new ForbiddenException('Only the Project Lead may approve Vault access.');
      if (a.archived) throw new ConflictException('Archived project vaults are read-only.');
      const target = await db.projectMember.findUnique({
        where: { projectId_memberId: { projectId, memberId: targetMemberId } },
        select: { member: { select: { status: true } } },
      });
      if (!target || target.member.status !== 'ACTIVE') throw new NotFoundException('Active Project Member not found.');
      await db.projectVaultGrant.upsert({
        where: { projectId_memberId: { projectId, memberId: targetMemberId } },
        create: { projectId, memberId: targetMemberId, approvedAt: approved ? new Date() : null,
          approvedByMemberId: approved ? member.id : null },
        update: { approvedAt: approved ? new Date() : null, approvedByMemberId: approved ? member.id : null },
      });
      await this.audit(db, projectId, member.id, approved ? 'ACCESS_APPROVED' : 'ACCESS_REVOKED', undefined, targetMemberId);
      return { success: true };
    });
  }
  async list(member: Member, projectId: string) {
    return this.prisma.$transaction(async db => {
      const a = await this.access(db, member, projectId);
      this.requireRead(a);
      return { canWrite: a.canWrite, items: await db.projectVaultItem.findMany({
        where: { projectId, deletedAt: null }, select: itemSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }) };
    });
  }
  async create(member: Member, projectId: string, input: SaveVaultItemRequest) {
    const bytes = this.bytes(input);
    this.key();
    return this.prisma.$transaction(async db => {
      this.requireWrite(await this.access(db, member, projectId));
      const itemId = randomUUID();
      const result = await db.projectVaultItem.create({
        data: { id: itemId, projectId, title: input.title, kind: input.kind, environment: input.environment,
          description: input.description, fileName: input.fileName, createdByMemberId: member.id,
          versions: { create: { versionNumber: 1, ...this.encrypt(bytes, projectId, itemId, 1),
            createdByMemberId: member.id } } },
        select: itemSelect,
      });
      await this.audit(db, projectId, member.id, 'ITEM_CREATED', itemId);
      return result;
    });
  }
  private async item(db: Prisma.TransactionClient, projectId: string, itemId: string) {
    const result = await db.projectVaultItem.findFirst({ where: { id: itemId, projectId, deletedAt: null } });
    if (!result) throw new NotFoundException('Vault item not found.');
    return result;
  }
  async update(member: Member, projectId: string, itemId: string, input: SaveVaultItemRequest) {
    const bytes = this.bytes(input);
    this.key();
    return this.prisma.$transaction(async db => {
      this.requireWrite(await this.access(db, member, projectId));
      const original = await this.item(db, projectId, itemId);
      const versionNumber = original.currentVersion + 1;
      const updated = await db.projectVaultItem.update({
        where: { id: itemId },
        data: { title: input.title, kind: input.kind, environment: input.environment, description: input.description,
          fileName: input.fileName, currentVersion: versionNumber,
          versions: { create: { versionNumber, ...this.encrypt(bytes, projectId, itemId, versionNumber),
            createdByMemberId: member.id } } },
        select: itemSelect,
      });
      await this.audit(db, projectId, member.id, 'ITEM_UPDATED', itemId);
      return updated;
    });
  }
  async remove(member: Member, projectId: string, itemId: string) {
    return this.prisma.$transaction(async db => {
      this.requireWrite(await this.access(db, member, projectId));
      await this.item(db, projectId, itemId);
      await db.projectVaultItem.update({ where: { id: itemId }, data: { deletedAt: new Date() } });
      await this.audit(db, projectId, member.id, 'ITEM_DELETED', itemId);
      return { success: true };
    });
  }
  async versions(member: Member, projectId: string, itemId: string) {
    return this.prisma.$transaction(async db => {
      this.requireRead(await this.access(db, member, projectId));
      await this.item(db, projectId, itemId);
      return { versions: await db.projectVaultVersion.findMany({ where: { itemId },
        select: { versionNumber: true, createdAt: true, byteLength: true },
        orderBy: { versionNumber: 'desc' } }) };
    });
  }
  async reveal(member: Member, projectId: string, itemId: string, purpose: 'REVEAL' | 'DOWNLOAD') {
    this.key();
    return this.prisma.$transaction(async db => {
      this.requireRead(await this.access(db, member, projectId));
      const item = await this.item(db, projectId, itemId);
      const v = await db.projectVaultVersion.findUniqueOrThrow({
        where: { itemId_versionNumber: { itemId, versionNumber: item.currentVersion } },
      });
      const contentBase64 = this.decrypt(v, projectId, itemId, item.currentVersion).toString('base64');
      await this.audit(db, projectId, member.id,
        purpose === 'DOWNLOAD' ? 'ITEM_DOWNLOADED' : 'ITEM_REVEALED', itemId);
      return { contentBase64, fileName: item.fileName, kind: item.kind };
    });
  }
}
