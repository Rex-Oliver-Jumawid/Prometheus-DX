import { PrismaClient, type Weekday, type WorkSession } from '@prisma/client';
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
let originalUnresolvedSession: WorkSession | null = null;
let currentMemberName = '';
const createdWorkSessionIds: string[] = [];

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
  currentMemberName = member.fullName;
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
  originalUnresolvedSession = await prisma.workSession.findFirst({
    where: { memberId: member.id, timeOut: null },
  });
  if (originalUnresolvedSession) {
    await prisma.workSession.delete({
      where: { id: originalUnresolvedSession.id },
    });
  }

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
  if (createdWorkSessionIds.length) {
    await prisma.workSessionCorrection.deleteMany({
      where: { workSessionId: { in: createdWorkSessionIds } },
    });
    await prisma.workSession.deleteMany({
      where: { id: { in: createdWorkSessionIds } },
    });
  }
  if (originalUnresolvedSession) {
    await prisma.workSession.create({
      data: originalUnresolvedSession,
    });
  }
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

function currentManilaWeekday(): Weekday {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
  })
    .format(new Date())
    .toUpperCase() as Weekday;
}

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

test('desktop browser zoom retains horizontal and vertical panning', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires configured Prometheus E2E credentials.');
  await signIn(page);

  // A narrow CSS viewport simulates desktop browser zoom without replacing
  // the desktop pointer with a mobile touch device.
  await page.setViewportSize({ width: 640, height: 620 });
  await page.goto('/schedule');
  await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible();

  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo({ left: 320, top: 0 }));
  await expect.poll(() => page.evaluate(() => window.scrollX)).toBeGreaterThan(0);

  const content = page.locator('.workspace-content-scroll');
  await expect.poll(() => content.evaluate((element) =>
    element.scrollHeight - element.clientHeight,
  )).toBeGreaterThan(0);
  await content.evaluate((element) => { element.scrollTop = 240; });
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

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
      name: "You haven't set your schedule yet",
    }),
  ).toBeVisible();
  await expect(page.getByText('Schedule Teammate')).toBeVisible();

  await page
    .getByRole('button', { name: 'Configure My Schedule' })
    .first()
    .click();
  await page.getByText('Fine-tune blocks using time inputs').click();
  await page.getByRole('button', { name: 'Add Block' }).click();
  await page.getByRole('spinbutton', { name: 'Hours per week' }).fill('4');
  await page.getByLabel('Start', { exact: true }).fill('08:00');
  await page.getByLabel('End', { exact: true }).fill('12:00');
  await page.getByRole('button', { name: 'Done configuring' }).click();
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

  await page.getByText('Fine-tune blocks using time inputs').click();
  await page.getByLabel('End', { exact: true }).fill('13:00');
  await page.getByRole('button', { name: 'Done configuring' }).click();
  await expect(
    page.getByRole('heading', { name: 'Configure My Schedule' }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('8:00 AM - 1:00 PM')).toBeVisible();

  await page
    .getByRole('button', { name: 'Configure My Schedule' })
    .first()
    .click();
  await page.getByText('Fine-tune blocks using time inputs').click();
  await page.getByRole('button', { name: 'Remove block 1' }).click();
  await page.getByRole('button', { name: 'Done configuring' }).click();
  await expect(
    page.getByRole('heading', { name: 'Configure My Schedule' }),
  ).toHaveCount(0);
  await expect(
    prisma.scheduleBlock.count({
      where: { schedule: { memberId: currentMemberId } },
    }),
  ).resolves.toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('heading', { name: 'Schedule', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('planned Schedule flows through persisted Time In, Team Working Now, Time Out, and weekly history', async ({
  page,
}) => {
  test.setTimeout(90_000);
  test.skip(!hasCredentials, 'Requires configured Prometheus E2E credentials.');

  await prisma.memberSchedule.upsert({
    where: { memberId: currentMemberId },
    create: {
      memberId: currentMemberId,
      targetWeeklyMinutes: 360,
      blocks: {
        create: {
          weekday: currentManilaWeekday(),
          startTime: new Date('1970-01-01T09:00:00.000Z'),
          endTime: new Date('1970-01-01T15:00:00.000Z'),
        },
      },
    },
    update: {
      targetWeeklyMinutes: 360,
      blocks: {
        deleteMany: {},
        create: {
          weekday: currentManilaWeekday(),
          startTime: new Date('1970-01-01T09:00:00.000Z'),
          endTime: new Date('1970-01-01T15:00:00.000Z'),
        },
      },
    },
  });

  await signIn(page);
  const attendance = page.getByLabel('Time attendance');
  await attendance.getByRole('button', { name: /Time In/ }).click();
  await expect(
    attendance.getByRole('button', { name: /Time Out/ }),
  ).toBeVisible();

  const openSession = await prisma.workSession.findFirstOrThrow({
    where: { memberId: currentMemberId, timeOut: null, status: 'OPEN' },
  });
  createdWorkSessionIds.push(openSession.id);
  await prisma.workSession.update({
    where: { id: openSession.id },
    data: { timeIn: new Date(Date.now() - 5 * 60 * 1_000) },
  });

  await page.reload();
  await expect(
    attendance.getByRole('button', { name: /Time Out/ }),
  ).toBeVisible();

  await page.goto('/team');
  const memberCard = page
    .locator('.team-card')
    .filter({ hasText: currentMemberName });
  await expect(memberCard.getByText('Working Now')).toBeVisible();
  await expect(memberCard.getByText('6h')).toBeVisible();

  await attendance.getByRole('button', { name: /Time Out/ }).click();
  await expect(memberCard.getByText('Timed Out')).toBeVisible();
  await expect(
    prisma.workSession.findUnique({ where: { id: openSession.id } }),
  ).resolves.toMatchObject({ status: 'COMPLETED' });

  await page.goto('/schedule');
  await page.getByRole('tab', { name: 'Shifts' }).click();
  await expect(page.getByText('Weekly work history')).toBeVisible();
  await expect(page.getByText('COMPLETED').first()).toBeVisible();
  await expect(page.getByText('6h').first()).toBeVisible();
});
