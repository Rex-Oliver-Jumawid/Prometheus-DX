import { expect, test, type Page, type TestInfo } from '@playwright/test';

const hasCredentials = Boolean(
  process.env.VITE_SUPABASE_URL &&
  process.env.VITE_SUPABASE_ANON_KEY &&
  process.env.E2E_MEMBER_EMAIL &&
  process.env.E2E_MEMBER_PASSWORD,
);

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

async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string,
  selector: string,
) {
  await expect(page.locator(selector)).toBeVisible();
  const metrics = await page.evaluate((rootSelector) => {
    const root = document.querySelector(rootSelector);
    const visibleOverflow = [...document.querySelectorAll<HTMLElement>('*')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.right > window.innerWidth + 1
        );
      })
      .slice(0, 12)
      .map((element) => ({
        className: element.className,
        right: Math.round(element.getBoundingClientRect().right),
      }));
    return {
      viewport: { width: innerWidth, height: innerHeight },
      pageScrollWidth: document.documentElement.scrollWidth,
      rootScrollWidth: root?.scrollWidth ?? null,
      rootClientWidth: root?.clientWidth ?? null,
      visibleOverflow,
    };
  }, selector);
  console.log(`AUDIT ${name} ${JSON.stringify(metrics)}`);
  expect(metrics.pageScrollWidth).toBeLessThanOrEqual(metrics.viewport.width);
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
}

test('Phase 6 visual, responsive, route, console, and network audit', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(!hasCredentials, 'Requires configured Prometheus E2E credentials.');

  const consoleIssues: string[] = [];
  const failedRequests: string[] = [];
  const serverErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()} ${request.failure()?.errorText}`,
    );
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      serverErrors.push(
        `${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto('/schedule');
  await expect(page.locator('.schedule-panel.team-panel:not(.schedule-skeleton-panel)')).toBeVisible();
  const panelFrame = await page.locator('.workspace-content').boundingBox();
  const pageFrame = await page.locator('.schedule-page').boundingBox();
  expect(panelFrame).not.toBeNull();
  expect(pageFrame).not.toBeNull();
  const leftGutter = pageFrame!.x - panelFrame!.x;
  const rightGutter = panelFrame!.x + panelFrame!.width - pageFrame!.x - pageFrame!.width;
  // Figma uses approximately 40px of spacing inside the right glass panel.
  // The page must not add another nested 28px route gutter.
  expect(leftGutter).toBeGreaterThan(28);
  expect(leftGutter).toBeLessThan(56);
  expect(rightGutter).toBeGreaterThan(28);
  expect(rightGutter).toBeLessThan(56);
  expect(Math.abs(leftGutter - rightGutter)).toBeLessThan(13);
  await capture(page, testInfo, 'desktop-schedule', '.schedule-page');

  await page
    .getByRole('button', { name: 'Configure My Schedule' })
    .first()
    .click();
  await capture(page, testInfo, 'desktop-schedule-configure', '.schedule-page');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('tab', { name: 'Shifts' }).click();
  await capture(page, testInfo, 'desktop-shifts', '.schedule-page');

  await page.getByRole('link', { name: 'Team' }).click();
  await expect(page).toHaveURL(/\/team$/);
  await capture(page, testInfo, 'desktop-team', '.team-page');
  await page.goBack();
  await expect(page).toHaveURL(/\/schedule$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/team$/);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Team', exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/schedule');
  await expect(page.locator('.schedule-panel.team-panel:not(.schedule-skeleton-panel)')).toBeVisible();
  await capture(page, testInfo, 'tablet-schedule', '.schedule-page');
  await page.goto('/team');
  await capture(page, testInfo, 'tablet-team', '.team-page');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/schedule');
  await expect(page.locator('.schedule-panel.team-panel:not(.schedule-skeleton-panel)')).toBeVisible();
  await capture(page, testInfo, 'mobile-schedule', '.schedule-page');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('.app-sidebar')).toBeVisible();
  await expect(page.getByLabel('Time attendance')).toBeHidden();
  await page.screenshot({
    path: testInfo.outputPath('mobile-sidebar.png'),
    fullPage: false,
  });
  await page.getByRole('link', { name: 'Team' }).click();
  await capture(page, testInfo, 'mobile-team', '.team-page');

  const attendance = page.getByLabel('Time attendance');
  await expect(attendance).toBeVisible();
  const attendanceBox = await attendance.boundingBox();
  expect(attendanceBox).not.toBeNull();
  expect(
    (attendanceBox?.x ?? 0) + (attendanceBox?.width ?? 0),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath('mobile-attendance.png'),
    fullPage: false,
  });

  console.log(`AUDIT console ${JSON.stringify(consoleIssues)}`);
  console.log(`AUDIT requestfailed ${JSON.stringify(failedRequests)}`);
  console.log(`AUDIT server-errors ${JSON.stringify(serverErrors)}`);
  expect(consoleIssues).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(serverErrors).toEqual([]);
});

test('Phase 6 loading, error, long-content, and correction visual states', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(!hasCredentials, 'Requires configured Prometheus E2E credentials.');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);

  let releaseTeamSchedule: (() => void) | undefined;
  const teamScheduleReleased = new Promise<void>((resolve) => {
    releaseTeamSchedule = resolve;
  });
  await page.route('**/api/schedule/team', async (route) => {
    await teamScheduleReleased;
    await route.continue();
  });
  await page.goto('/schedule');
  await expect(page.getByRole('status', { name: 'Loading Team Schedule' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('schedule-loading.png'),
    fullPage: false,
  });
  releaseTeamSchedule?.();
  await expect(
    page.getByRole('heading', { name: 'Schedule', exact: true }),
  ).toBeVisible();
  await page.unroute('**/api/schedule/team');

  await page.route('**/api/schedule/team', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Acceptance fixture unavailable' }),
    });
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText(
    'Schedule could not be loaded',
  );
  await page.screenshot({
    path: testInfo.outputPath('schedule-error-retry.png'),
    fullPage: false,
  });
  await page.unroute('**/api/schedule/team');

  await page.route('**/api/schedule/team', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const base = data.members[0];
    const longMemberId = '40000000-0000-4000-8000-000000000001';
    const createdAt = new Date().toISOString();
    const blocks = [
      ['MONDAY', '07:30', '11:30'],
      ['MONDAY', '13:00', '17:30'],
      ['WEDNESDAY', '09:00', '12:00'],
      ['FRIDAY', '14:00', '20:00'],
    ].map(([weekday, startTime, endTime], index) => ({
      id: `41000000-0000-4000-8000-00000000000${index + 1}`,
      weekday,
      startTime,
      endTime,
    }));
    await route.fulfill({
      response,
      json: {
        ...data,
        members: [
          ...data.members,
          {
            ...base,
            id: longMemberId,
            fullName: 'Alexandria-Cassandra Very Long Schedule Member Name',
            position: 'Principal Cross-Functional Workflow Coordinator',
            schedule: {
              id: '42000000-0000-4000-8000-000000000001',
              memberId: longMemberId,
              targetWeeklyMinutes: 2_400,
              blocks,
              createdAt,
              updatedAt: createdAt,
            },
          },
        ],
      },
    });
  });
  await page.reload();
  await capture(
    page,
    testInfo,
    'desktop-schedule-populated-long',
    '.schedule-page',
  );
  await page
    .getByRole('button', { name: 'Configure My Schedule' })
    .first()
    .click();
  await page.getByText('Fine-tune blocks using time inputs').click();
  await page.getByRole('button', { name: 'Add Block' }).click();
  await page.getByRole('button', { name: 'Add Block' }).click();
  // Addition picks separate free days, so deliberately move the second block
  // onto the first to cover the invalid overlapping schedule case.
  const editorRows = page.locator('.schedule-block-row');
  const lastRowIndex = (await editorRows.count()) - 1;
  const earlierRow = editorRows.nth(lastRowIndex - 1);
  const lastRow = editorRows.nth(lastRowIndex);
  await lastRow.locator('select').selectOption(
    await earlierRow.locator('select').inputValue(),
  );
  await lastRow.locator('input[type="time"]').nth(0).fill(
    await earlierRow.locator('input[type="time"]').nth(0).inputValue(),
  );
  await lastRow.locator('input[type="time"]').nth(1).fill(
    await earlierRow.locator('input[type="time"]').nth(1).inputValue(),
  );
  await page.getByRole('button', { name: 'Done configuring' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Schedule blocks on the same day cannot overlap',
  );
  await page.screenshot({
    path: testInfo.outputPath('schedule-validation-error.png'),
    fullPage: false,
  });

  await page.getByRole('button', { name: `Remove block ${lastRowIndex + 1}` }).click();
  let releaseScheduleSave: (() => void) | undefined;
  const scheduleSaveReleased = new Promise<void>((resolve) => {
    releaseScheduleSave = resolve;
  });
  await page.route('**/api/schedule/me', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue();
      return;
    }
    await scheduleSaveReleased;
    const savedAt = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '43000000-0000-4000-8000-000000000001',
        memberId: '43000000-0000-4000-8000-000000000002',
        targetWeeklyMinutes: 2_400,
        blocks: [
          {
            id: '43000000-0000-4000-8000-000000000003',
            weekday: 'MONDAY',
            startTime: '09:00',
            endTime: '17:00',
          },
        ],
        createdAt: savedAt,
        updatedAt: savedAt,
      }),
    });
  });
  await page.getByRole('button', { name: 'Done configuring' }).click();
  await expect(page.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath('schedule-save-pending.png'),
    fullPage: false,
  });
  releaseScheduleSave?.();
  await expect(page.getByRole('button', { name: 'Saving...' })).toHaveCount(0);
  await page.unroute('**/api/schedule/me');
  await page.unroute('**/api/schedule/team');

  await page.route('**/api/team', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const base = data.members[0];
    const members = Array.from({ length: 9 }, (_, index) => ({
      ...base,
      id: `00000000-0000-4000-8000-00000000000${index + 1}`,
      fullName:
        index === 0
          ? 'Alexandria-Cassandra Very Long Prometheus Member Name'
          : `Acceptance Team Member ${index + 1}`,
      position:
        index === 0
          ? 'Principal Cross-Functional Workflow and Delivery Coordinator'
          : base.position,
      workingNow: index === 1,
      scheduledMinutes: index * 75,
      actualWorkedSeconds: index * 2_400,
      todaySchedule:
        index === 2
          ? [
              {
                id: '10000000-0000-4000-8000-000000000001',
                weekday: 'FRIDAY',
                startTime: '08:00',
                endTime: '12:00',
              },
              {
                id: '10000000-0000-4000-8000-000000000002',
                weekday: 'FRIDAY',
                startTime: '13:00',
                endTime: '18:00',
              },
            ]
          : [],
    }));
    await route.fulfill({
      response,
      json: {
        ...data,
        summary: {
          memberCount: members.length,
          workingNowCount: 1,
          scheduledMinutes: members.reduce(
            (total: number, member: { scheduledMinutes: number }) =>
              total + member.scheduledMinutes,
            0,
          ),
          actualWorkedSeconds: members.reduce(
            (total: number, member: { actualWorkedSeconds: number }) =>
              total + member.actualWorkedSeconds,
            0,
          ),
        },
        members,
      },
    });
  });
  await page.goto('/team');
  await capture(page, testInfo, 'desktop-team-many-long', '.team-page');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, testInfo, 'mobile-team-many-long', '.team-page');
  await page.unroute('**/api/team');

  const now = new Date();
  const timeIn = new Date(now.getTime() - 17 * 60 * 60 * 1_000);
  await page.route('**/api/work-sessions/current', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timezone: 'Asia/Manila',
        asOf: now.toISOString(),
        session: {
          id: '20000000-0000-4000-8000-000000000001',
          memberId: '20000000-0000-4000-8000-000000000002',
          timeIn: timeIn.toISOString(),
          timeOut: null,
          status: 'NEEDS_CORRECTION',
          durationSeconds: 0,
          createdAt: timeIn.toISOString(),
          updatedAt: now.toISOString(),
        },
      }),
    });
  });
  await page.reload();
  const correction = page.getByLabel('Time attendance');
  await expect(correction.getByText('Correction required')).toBeVisible();
  await correction.getByLabel('Correct Time In').focus();
  const correctedTimeOut = correction.getByLabel('Correct Time Out');
  for (let index = 0; index < 8; index += 1) {
    if (
      await correctedTimeOut.evaluate(
        (element) => document.activeElement === element,
      )
    )
      break;
    await page.keyboard.press('Tab');
  }
  await expect(correctedTimeOut).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath('mobile-correction-required.png'),
    fullPage: false,
  });

  await page.unroute('**/api/work-sessions/current');
  const openTimeIn = new Date(Date.now() - 5 * 60 * 1_000);
  await page.route('**/api/work-sessions/current', async (route) => {
    const asOf = new Date();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timezone: 'Asia/Manila',
        asOf: asOf.toISOString(),
        session: {
          id: '30000000-0000-4000-8000-000000000001',
          memberId: '30000000-0000-4000-8000-000000000002',
          timeIn: openTimeIn.toISOString(),
          timeOut: null,
          status: 'OPEN',
          durationSeconds: 0,
          createdAt: openTimeIn.toISOString(),
          updatedAt: asOf.toISOString(),
        },
      }),
    });
  });
  await page.reload();
  const activeAttendance = page.getByLabel('Time attendance');
  await expect(
    activeAttendance.getByRole('button', { name: /Time Out/ }),
  ).toBeVisible();
  const initialElapsed = await activeAttendance
    .getByLabel('Elapsed work session')
    .textContent();
  await page.waitForTimeout(1_100);
  await expect(
    activeAttendance.getByLabel('Elapsed work session'),
  ).not.toHaveText(initialElapsed ?? '');
  await page.screenshot({
    path: testInfo.outputPath('mobile-active-session.png'),
    fullPage: false,
  });

  let releaseTimeOut: (() => void) | undefined;
  const timeOutReleased = new Promise<void>((resolve) => {
    releaseTimeOut = resolve;
  });
  await page.route('**/api/work-sessions/time-out', async (route) => {
    await timeOutReleased;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timezone: 'Asia/Manila',
        asOf: new Date().toISOString(),
        session: null,
      }),
    });
  });
  const timeOutButton = activeAttendance.getByRole('button', {
    name: /Time Out/,
  });
  await timeOutButton.click();
  await expect(timeOutButton).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath('mobile-time-out-pending.png'),
    fullPage: false,
  });
  await page.unroute('**/api/work-sessions/current');
  await page.route('**/api/work-sessions/current', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timezone: 'Asia/Manila',
        asOf: new Date().toISOString(),
        session: null,
      }),
    });
  });
  releaseTimeOut?.();
  await expect(
    activeAttendance.getByRole('button', { name: /Time In/ }),
  ).toBeVisible();

  await page.route('**/api/work-sessions/time-in', async (route) => {
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Acceptance mutation error' }),
    });
  });
  await activeAttendance.getByRole('button', { name: /Time In/ }).click();
  await expect(activeAttendance.getByRole('alert')).toContainText(
    'Request failed with status 409',
  );
  await page.screenshot({
    path: testInfo.outputPath('mobile-attendance-error.png'),
    fullPage: false,
  });
});
