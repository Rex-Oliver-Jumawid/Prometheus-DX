import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const globalStyles = readFileSync(
  new URL('../../src/styles/globals.css', import.meta.url),
  'utf8',
);

// Exercise actual shell styles without requiring credentials or a database.
async function mountWorkspace(page: import('@playwright/test').Page) {
  await page.setContent(`
    <style>${globalStyles}</style>
    <div class="workspace-shell">
      <aside class="app-sidebar">Navigation</aside>
      <div class="workspace-main">
        <main class="workspace-content">
          <div class="workspace-content-scroll">
            <div class="workspace-content-inner">
              <p>Scrollable workspace</p>
              <div style="height: 2300px">Tall content</div>
              <p>Bottom</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  `);
}

test('desktop browser zoom pans horizontally and vertically without switching scrollports', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 650 });
  await mountWorkspace(page);

  const initial = await page.evaluate(() => ({
    rootWidth: document.scrollingElement!.scrollWidth,
    rootClientWidth: document.scrollingElement!.clientWidth,
    innerHeight: document.querySelector('.workspace-content-scroll')!.clientHeight,
    innerScrollHeight: document.querySelector('.workspace-content-scroll')!.scrollHeight,
  }));
  expect(initial.rootWidth).toBeGreaterThan(initial.rootClientWidth);
  expect(initial.innerScrollHeight).toBeGreaterThan(initial.innerHeight);

  await page.mouse.move(500, 250);
  await page.mouse.wheel(220, 0);
  await expect
    .poll(() => page.evaluate(() => document.scrollingElement!.scrollLeft))
    .toBeGreaterThan(0);

  await page.mouse.wheel(0, 220);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector('.workspace-content-scroll')!.scrollTop,
      ),
    )
    .toBeGreaterThan(0);

  const beforeReverse = await page.evaluate(
    () => document.querySelector('.workspace-content-scroll')!.scrollTop,
  );
  await page.mouse.wheel(0, -120);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector('.workspace-content-scroll')!.scrollTop,
      ),
    )
    .toBeLessThan(beforeReverse);
});

test('normal desktop retains the bounded vertically scrollable workspace', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await mountWorkspace(page);
  expect(
    await page.evaluate(
      () => document.scrollingElement!.scrollWidth <= document.scrollingElement!.clientWidth,
    ),
  ).toBe(true);

  await page.mouse.move(500, 250);
  await page.mouse.wheel(0, 220);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector('.workspace-content-scroll')!.scrollTop,
      ),
    )
    .toBeGreaterThan(0);
});
