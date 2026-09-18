import { PrismaClient, type Weekday } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const hasCredentials = Boolean(
  process.env.VITE_SUPABASE_URL &&
  process.env.VITE_SUPABASE_ANON_KEY &&
  process.env.E2E_MEMBER_EMAIL &&
  process.env.E2E_MEMBER_PASSWORD,
);

type OriginalSchedule = {
  targetWeeklyMinutes: number;
  blocks: Array<{ weekday: Weekday; startTime: Date; endTime: Date }>;
} | null;

let currentMemberId = '';
let fixtureMemberId = '';
let originalSchedule: OriginalSchedule = null;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  if (!hasCredentials) return;
  const member = await prisma.member.findFirst({
    where: {
      email: { equals: process.env.E2E_MEMBER_EMAIL!, mode: 'insensitive' },
    },
    include: { schedule: { include: { blocks: true } } },
  });
  if (!member) throw new Error('E2E member record was not found.');
  currentMemberId = member.id;
  originalSchedule = member.schedule
    ? {
        targetWeeklyMinutes: member.schedule.targetWeeklyMinutes,
        blocks: member.schedule.blocks.map((block) => ({
          weekday: block.weekday,
          startTime: block.startTime,
          endTime: block.endTime,
        })),
      }
    : null;
  await prisma.memberSchedule.deleteMany({ where: { memberId: member.id } });

  const teammate = await prisma.member.create({
    data: {
      email: `schedule-e2e-${Date.now()}@prometheus.test`,
      fullName: 'Schedule Teammate',
      departmentId: member.departmentId,
      position: 'Schedule Visibility Fixture',
      status: 'ACTIVE',
      schedule: {
        create: {
          targetWeeklyMinutes: 480,
          blocks: {
            create: {
              weekday: 'TUESDAY',
              startTime: new Date('1970-01-01T09:00:00.000Z'),
              endTime: new Date('1970-01-01T17:00:00.000Z'),
            },
          },
        },
      },
    },
  });
  fixtureMemberId = teammate.id;
});

test.afterAll(async () => {
  if (fixtureMemberId) {
    await prisma.member.deleteMany({ where: { id: fixtureMemberId } });
  }
  if (currentMemberId) {
    await prisma.memberSchedule.deleteMany({
      where: { memberId: currentMemberId },
    });
    if (originalSchedule) {
      await prisma.memberSchedule.create({
        data: {
          memberId: currentMemberId,
          targetWeeklyMinutes: originalSchedule.targetWeeklyMinutes,
          blocks: { create: originalSchedule.blocks },
        },
      });
    }
  }
  await prisma.$disconnect();
});

async function signIn(page: Page) {
  await page.goto('/login');
  await page
    .getByLabel('Company email')
    .fill(process.env.E2E_MEMBER_EMAIL ?? '');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.E2E_MEMBER_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
}

test('member configures, refreshes, edits, removes, and returns from Shifts to Team configuration', async ({
  page,
}) => {
  test.setTimeout(90_000);
  test.skip(!hasCredentials, 'Requires configured Prometheus E2E credentials.');

  await signIn(page);
  await page.goto('/schedule');
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(
    page.getByRole('heading', { name: 'Schedule', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Your schedule is ready to configure',
    }),
  ).toBeVisible();
  await expect(page.getByText('Schedule Teammate')).toBeVisible();

  await page
    .getByRole('button', { name: 'Configure My Schedule' })
    .first()
    .click();
  await page.getByRole('button', { name: 'Add Block' }).click();
  await page.getByLabel('Target hours per week').fill('4');
  await page.getByLabel('Start').fill('08:00');
  await page.getByLabel('End').fill('12:00');
  await page.getByRole('button', { name: 'Save Schedule' }).click();
  await expect(
    page.getByRole('heading', { name: 'Configure My Schedule' }),
  ).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('8:00 AM - 12:00 PM')).toBeVisible();
  await expect(
    prisma.scheduleBlock.count({
      where: { schedule: { memberId: currentMemberId } },
    }),
  ).resolves.toBe(1);

  await page.getByRole('tab', { name: 'Shifts' }).click();
  await expect(page.getByRole('tab', { name: 'Shifts' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Configure My Schedule' }).click();
  await expect(
    page.getByRole('tab', { name: 'Team Schedule' }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('heading', { name: 'Configure My Schedule' }),
  ).toBeVisible();

  await page.getByLabel('End').fill('13:00');
  await page.getByRole('button', { name: 'Save Schedule' }).click();
  await page.reload();
  await expect(page.getByText('8:00 AM - 1:00 PM')).toBeVisible();

  await page
    .getByRole('button', { name: 'Configure My Schedule' })
    .first()
    .click();
  await page.getByRole('button', { name: 'Remove block 1' }).click();
  await page.getByRole('button', { name: 'Save Schedule' }).click();
  await expect(
    prisma.scheduleBlock.count({
      where: { schedule: { memberId: currentMemberId } },
    }),
  ).resolves.toBe(0);
});
