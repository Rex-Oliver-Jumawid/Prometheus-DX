import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();
const names = new Set<string>();
test.afterEach(async () => {
  if (!names.size) return;
  await prisma.ventureAuditEvent.deleteMany({ where: { venture: { name: { in: [...names] } } } });
  await prisma.venture.deleteMany({ where: { name: { in: [...names] } } });
  names.clear();
});
test.afterAll(async () => { await prisma.$disconnect(); });

test('administrator configures and archives a venture inside Registry with persistence', async ({ page }) => {
  test.skip(!process.env.E2E_MEMBER_EMAIL || !process.env.E2E_MEMBER_PASSWORD, 'Requires authenticated preview credentials.');
  const actor = await prisma.member.findFirstOrThrow({ where: { email: process.env.E2E_MEMBER_EMAIL } });
  test.skip(actor.workspaceRole !== 'ADMINISTRATOR', 'Requires an Administrator.');
  const original = `Registry venture ${Date.now()}`;
  const updated = original + ' edited';
  names.add(original); names.add(updated);
  await page.goto('/login');
  await page.getByLabel('Company email').fill(process.env.E2E_MEMBER_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_MEMBER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto('/registry');
  await expect(page.getByRole('heading', { name: 'Registry', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Ventures', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create venture', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill(original);
  await page.getByLabel('Short label', { exact: true }).fill('REG');
  await page.getByLabel('Description', { exact: true }).fill('Created inside Registry.');
  await page.getByRole('button', { name: 'Create venture', exact: true }).click();
  await page.getByRole('button', { name: original, exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill(updated);
  await page.getByRole('button', { name: 'Save venture', exact: true }).click();
  await expect(page.getByRole('button', { name: updated, exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: updated, exact: true }).click();
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Created inside Registry.');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('ARCHIVED');
  await page.getByRole('button', { name: 'Save venture', exact: true }).click();
  await expect(page.getByRole('button', { name: updated + ' (archived)', exact: true })).toBeVisible();
  expect(await prisma.venture.count({ where: { name: updated, status: 'ARCHIVED' } })).toBe(1);
});
