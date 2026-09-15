import { expect, test } from '@playwright/test';

test('foundation shell loads and reaches the NestJS API', async ({ page }) => {
  await page.goto('/foundation');

  await expect(
    page.getByRole('heading', { name: 'Prometheus foundation' }),
  ).toBeVisible();
  await expect(page.getByTestId('api-status')).toHaveText('Connected');
});
