/**
 * Optional visual QA fixture from .model/finalmodel.html.
 * Strictly limited to the dedicated local schedule Docker database.
 * Does not create Supabase Auth users or change the production database.
 *
 * SCHEDULE_DEMO_EMAIL=your-existing-local-member@example.com \\
 *   pnpm exec tsx scripts/seed-schedule-visual-demo.ts
 */
import 'dotenv/config';
import { PrismaClient, type Weekday } from '@prisma/client';

function assertIsolatedDatabase(name: string, value: string | undefined): void {
  if (!value) throw new Error(name + ' must be configured.');
  const url = new URL(value);
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.port !== '55432' ||
    url.pathname !== '/prometheus_schedule'
  ) {
    throw new Error(
      name + ' must point to the isolated local prometheus_schedule database on 127.0.0.1:55432. Refusing to change any other database.',
    );
  }
}

assertIsolatedDatabase('DATABASE_URL', process.env.DATABASE_URL);
assertIsolatedDatabase('DIRECT_URL', process.env.DIRECT_URL);
if (process.env.NODE_ENV === 'production') {
  throw new Error('The Schedule demo fixture cannot run in production mode.');
}
const ownEmail = process.env.SCHEDULE_DEMO_EMAIL?.trim();
if (!ownEmail) {
  throw new Error('Set SCHEDULE_DEMO_EMAIL to the active Member email in your local database.');
}

const weekdays: Weekday[] = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
  'FRIDAY', 'SATURDAY', 'SUNDAY',
];
type Block = { weekday: Weekday; start: number; hours: number };
const ownBlocks: Block[] = [
  { weekday: 'MONDAY', start: 14, hours: 8 },
  { weekday: 'WEDNESDAY', start: 10, hours: 5 },
  { weekday: 'FRIDAY', start: 14, hours: 4 },
];

const teammates: Array<{
  name: string;
  email: string;
  department: 'owner' | 'engineering' | 'creatives' | 'sales';
  blocks: Block[];
}> = [
  {
    name: 'Ana Mendoza', email: 'ana.schedule-demo@prometheus.test',
    department: 'owner',
    blocks: [
      { weekday: 'TUESDAY', start: 9, hours: 4 },
      { weekday: 'THURSDAY', start: 13, hours: 4 },
      { weekday: 'FRIDAY', start: 15, hours: 4 },
    ],
  },
  {
    name: 'Nico Ramos', email: 'nico.schedule-demo@prometheus.test',
    department: 'engineering',
    blocks: [
      { weekday: 'MONDAY', start: 15, hours: 4 },
      { weekday: 'TUESDAY', start: 7, hours: 5 },
      { weekday: 'FRIDAY', start: 14, hours: 6 },
    ],
  },
  {
    name: 'Justin Cruz', email: 'justin.schedule-demo@prometheus.test',
    department: 'engineering',
    blocks: [
      { weekday: 'TUESDAY', start: 10, hours: 6 },
      { weekday: 'WEDNESDAY', start: 13, hours: 7 },
      { weekday: 'FRIDAY', start: 15, hours: 8 },
    ],
  },
  {
    name: 'Bea Santos', email: 'bea.schedule-demo@prometheus.test',
    department: 'creatives',
    blocks: [
      { weekday: 'TUESDAY', start: 10, hours: 6 },
      { weekday: 'THURSDAY', start: 12, hours: 6 },
      { weekday: 'FRIDAY', start: 14, hours: 7 },
    ],
  },
  {
    name: 'Marco Reyes', email: 'marco.schedule-demo@prometheus.test',
    department: 'sales',
    blocks: [
      { weekday: 'WEDNESDAY', start: 16, hours: 5 },
      { weekday: 'THURSDAY', start: 10, hours: 5 },
      { weekday: 'FRIDAY', start: 16, hours: 4 },
    ],
  },
];

const prisma = new PrismaClient();

function clock(hour: number): Date {
  return new Date('1970-01-01T' + String(hour).padStart(2, '0') + ':00:00.000Z');
}

async function replaceSchedule(memberId: string, blocks: Block[]): Promise<void> {
  const scheduledDays = new Set(blocks.map((block) => block.weekday));
  const restDays = weekdays.filter((weekday) => !scheduledDays.has(weekday)).slice(-2);
  const targetWeeklyMinutes = blocks.reduce((total, block) => total + block.hours * 60, 0);
  await prisma.$transaction(async (db) => {
    const schedule = await db.memberSchedule.upsert({
      where: { memberId },
      create: { memberId, targetWeeklyMinutes, restDays },
      update: { targetWeeklyMinutes, restDays },
    });
    await db.scheduleBlock.deleteMany({ where: { scheduleId: schedule.id } });
    await db.scheduleBlock.createMany({
      data: blocks.map((block) => ({
        scheduleId: schedule.id,
        weekday: block.weekday,
        startTime: clock(block.start),
        endTime: clock(block.start + block.hours),
      })),
    });
  });
}

async function getDepartment(name: string, shortLabel: string): Promise<string> {
  const existing = await prisma.department.findFirst({ where: { name } });
  if (existing) return existing.id;
  return (await prisma.department.create({ data: { name, shortLabel } })).id;
}

async function main(): Promise<void> {
  const member = await prisma.member.findFirst({
    where: { email: { equals: ownEmail, mode: 'insensitive' }, status: 'ACTIVE' },
    include: { schedule: true },
  });
  if (!member) {
    throw new Error('No active local Member exists with SCHEDULE_DEMO_EMAIL. Sign in to your local account first.');
  }

  const departments = {
    owner: member.departmentId,
    engineering: await getDepartment('Schedule Demo R&D', 'DEMO-RD'),
    creatives: await getDepartment('Schedule Demo Creatives', 'DEMO-CR'),
    sales: await getDepartment('Schedule Demo S&M', 'DEMO-SM'),
  };
  for (const teammate of teammates) {
    const existing = await prisma.member.findFirst({
      where: { email: { equals: teammate.email, mode: 'insensitive' } },
    });
    const data = {
      fullName: teammate.name,
      departmentId: departments[teammate.department],
      status: 'ACTIVE' as const,
      workspaceRole: 'MEMBER' as const,
      position: 'Visual schedule demo',
      deactivatedAt: null,
    };
    const saved = existing
      ? await prisma.member.update({ where: { id: existing.id }, data })
      : await prisma.member.create({ data: { ...data, email: teammate.email } });
    await replaceSchedule(saved.id, teammate.blocks);
  }

  // Respect any schedule the local member has already been editing.
  if (!member.schedule || process.env.SCHEDULE_DEMO_REPLACE_OWN === '1') {
    await replaceSchedule(member.id, ownBlocks);
    console.info('Created the reference schedule for your local Member.');
  } else {
    console.info('Kept your existing local Member schedule unchanged.');
  }
  console.info('Five example teammates and their reference shifts are ready in local PostgreSQL.');
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });
