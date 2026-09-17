import { expect, test, type Locator, type Page } from '@playwright/test';

const hasCredentials = Boolean(
  process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD,
);

type Timing = {
  usefulMs: number;
  authoritativeMs?: number;
  requests: string[];
};

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Company email').fill(process.env.E2E_MEMBER_EMAIL!);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.E2E_MEMBER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
}

async function timeNavigation(
  page: Page,
  action: () => Promise<void>,
  usefulContent: Locator,
  authoritativePath: RegExp,
): Promise<Timing> {
  const requests: string[] = [];
  const onRequest = (request: { url(): string }) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) requests.push(url.pathname);
  };
  page.on('request', onRequest);

  const startedAt = performance.now();
  const responsePromise = page
    .waitForResponse((response) => authoritativePath.test(response.url()), {
      timeout: 3_000,
    })
    .then(() => performance.now() - startedAt)
    .catch(() => undefined);
  await action();
  await expect(usefulContent).toBeVisible();
  const usefulMs = performance.now() - startedAt;
  const authoritativeMs = await responsePromise;
  page.off('request', onRequest);

  return {
    usefulMs: Number(usefulMs.toFixed(1)),
    authoritativeMs:
      authoritativeMs === undefined
        ? undefined
        : Number(authoritativeMs.toFixed(1)),
    requests,
  };
}

test('records cold and warm perceived navigation timings', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await signIn(page);

  const metrics: Record<string, Timing | { visibleMs: number }> = {};
  const projectsNavigation = page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Projects', exact: true });
  metrics.projectsCold = await timeNavigation(
    page,
    () => page.goto('/projects'),
    page.locator('.vw-projects-board, .vw-archive-shell'),
    /\/api\/projects(?:\?.*)?$/,
  );

  const workspaceLinks = page.getByRole('link', {
    name: /Open Workspace|View project/,
  });
  test.skip(
    (await workspaceLinks.count()) < 2,
    'Requires at least two Projects.',
  );
  const projectNames = await workspaceLinks.evaluateAll((links) =>
    links.slice(0, 2).map((link) => {
      const article = link.closest('article');
      return article?.querySelector('h3')?.textContent?.trim() ?? '';
    }),
  );

  await workspaceLinks.nth(0).hover();
  await page.waitForTimeout(50);
  metrics.projectAPrefetched = await timeNavigation(
    page,
    () => workspaceLinks.nth(0).click(),
    page.getByRole('heading', { name: projectNames[0], exact: true }),
    /\/api\/projects\/[^/]+$/,
  );

  metrics.projectsWarmReturn = await timeNavigation(
    page,
    () => projectsNavigation.click(),
    page.locator('.vw-projects-board, .vw-archive-shell'),
    /\/api\/projects(?:\?.*)?$/,
  );

  if ((await workspaceLinks.count()) >= 3) {
    const thirdProjectName = await workspaceLinks.nth(2).evaluate((link) => {
      const article = link.closest('article');
      return article?.querySelector('h3')?.textContent?.trim() ?? '';
    });
    metrics.projectUnprefetchedFromList = await timeNavigation(
      page,
      () =>
        workspaceLinks
          .nth(2)
          .evaluate((link: HTMLAnchorElement) => link.click()),
      page.getByRole('heading', { name: thirdProjectName, exact: true }),
      /\/api\/projects\/[^/]+$/,
    );
    await projectsNavigation.click();
    await expect(
      page.locator('.vw-projects-board, .vw-archive-shell'),
    ).toBeVisible();
  }

  await workspaceLinks.nth(1).hover();
  await page.waitForTimeout(50);
  metrics.projectBPrefetched = await timeNavigation(
    page,
    () => workspaceLinks.nth(1).click(),
    page.getByRole('heading', { name: projectNames[1], exact: true }),
    /\/api\/projects\/[^/]+$/,
  );

  await projectsNavigation.click();
  await expect(
    page.locator('.vw-projects-board, .vw-archive-shell'),
  ).toBeVisible();
  const leadProject = page
    .locator('article')
    .filter({ has: page.getByText('Lead', { exact: true }) })
    .first();
  const leadProjectLink = leadProject.getByRole('link', {
    name: /Open Workspace|View project/,
  });
  if (await leadProjectLink.isVisible()) {
    await leadProjectLink.evaluate((link: HTMLAnchorElement) => link.click());
    await expect(page.getByLabel('Project status')).toBeVisible();
  }
  const status = page.getByLabel('Project status');
  if (await status.isVisible()) {
    const current = await status.inputValue();
    const next = current === 'PLANNING' ? 'IN_PROGRESS' : 'PLANNING';
    const updated = page.waitForResponse(
      (response) =>
        /\/api\/projects\/[^/]+\/status$/.test(response.url()) &&
        response.request().method() === 'PATCH',
    );
    const startedAt = performance.now();
    await status.selectOption(next);
    await expect(status).toHaveValue(next);
    metrics.projectStatusLocal = {
      visibleMs: Number((performance.now() - startedAt).toFixed(1)),
    };
    await updated;
    const restored = page.waitForResponse(
      (response) =>
        /\/api\/projects\/[^/]+\/status$/.test(response.url()) &&
        response.request().method() === 'PATCH',
    );
    await status.selectOption(current);
    await restored;
  }

  const registryLink = page.getByRole('link', {
    name: 'Registry',
    exact: true,
  });
  if (await registryLink.isVisible()) {
    await registryLink.hover();
    await page.waitForTimeout(50);
    await registryLink.click();
    await expect(page.getByRole('heading', { name: 'Registry' })).toBeVisible();
    await projectsNavigation.click();
    await expect(
      page.locator('.vw-projects-board, .vw-archive-shell'),
    ).toBeVisible();
    metrics.registryWarm = await timeNavigation(
      page,
      () => registryLink.click(),
      page.getByRole('heading', { name: 'Registry' }),
      /\/api\/registry(?:\?.*)?$/,
    );
  }

  console.log(`PERCEIVED_LATENCY ${JSON.stringify(metrics)}`);
});
