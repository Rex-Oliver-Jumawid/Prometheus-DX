import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const SeedMemberSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  departmentId: z.string().uuid(),
  workspaceRole: z.enum(['ADMINISTRATOR', 'MEMBER']).default('MEMBER'),
  status: z.enum(['INVITED', 'ACTIVE', 'DEACTIVATED']).default('INVITED'),
  authUserId: z.string().uuid().nullable().optional(),
  position: z.string().nullable().optional(),
});
const SeedSchema = z.array(SeedMemberSchema);

async function seed(): Promise<void> {
  const configured = process.env.PROMETHEUS_SEED_MEMBERS_JSON;
  if (!configured) {
    console.info(
      'No development members seeded. Set PROMETHEUS_SEED_MEMBERS_JSON to opt in.',
    );
    return;
  }

  const members = SeedSchema.parse(JSON.parse(configured) as unknown);
  const prisma = new PrismaClient();
  try {
    for (const member of members) {
      const email = member.email.trim().toLowerCase();
      const existing = await prisma.member.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      const data = {
        email,
        fullName: member.fullName,
        departmentId: member.departmentId,
        workspaceRole: member.workspaceRole,
        status: member.status,
        authUserId: member.authUserId ?? null,
        position: member.position ?? null,
        deactivatedAt: member.status === 'DEACTIVATED' ? new Date() : null,
      };
      if (existing)
        await prisma.member.update({ where: { id: existing.id }, data });
      else await prisma.member.create({ data });
    }
  } finally {
    await prisma.$disconnect();
  }
}

void seed();
