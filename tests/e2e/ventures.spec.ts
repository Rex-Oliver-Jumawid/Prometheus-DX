import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const db = new PrismaClient();
test('administrator creates ventures, assigns multiple roles, and preserves them after refresh', async ({ page }) => {
  test.skip(!process.env.E2E_MEMBER_EMAIL || !process.env.E2E_MEMBER_PASSWORD, 'Requires a disposable authenticated identity.');
  const actor = await db.member.findFirstOrThrow({ where: { email: process.env.E2E_MEMBER_EMAIL } });
  test.skip(actor.workspaceRole !== 'ADMINISTRATOR', 'Requires a workspace administrator fixture.');
  const prefix = `E2E Ventures ${randomUUID().slice(0, 8)}`;
  const ids: string[] = [];
  const originalVenture = actor.ventureId;
  try {
    await page.goto('/login');
    await page.getByLabel('Company email').fill(process.env.E2E_MEMBER_EMAIL!);
    await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_MEMBER_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/);
    await page.goto('/ventures');
    for (const label of ['Parent', 'Child']) {
      const name = `${prefix} ${label}`;
      await page.getByRole('button', { name: 'Create venture', exact: true }).click();
      await page.getByLabel('Name', { exact: true }).fill(name);
      await page.getByLabel('Short label', { exact: true }).fill(label);
      if (label === 'Child') await page.getByLabel('Parent venture').selectOption({ label: `${prefix} Parent` });
      await page.getByRole('button', { name: 'Create venture', exact: true }).last().click();
      const button = page.getByRole('button', { name, exact: true });
      await expect(button).toBeVisible();
      ids.push((await db.venture.findFirstOrThrow({ where: { name } })).id);
      await button.click();
      await page.getByRole('combobox', { name: 'Member', exact: true }).selectOption(actor.id);
      await page.getByLabel('Founder', { exact: true }).check();
      await page.getByLabel('CEO', { exact: true }).check();
      await page.getByLabel('CTO', { exact: true }).check();
      await page.getByRole('button', { name: 'Save membership', exact: true }).click();
      await expect(page.getByText('CEO, CTO', { exact: true })).toBeVisible();
      await page.reload();
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.getByText('CEO, CTO', { exact: true })).toBeVisible();
    }
    expect(await db.ventureMembership.count({ where: { ventureId: { in: ids }, memberId: actor.id, endedAt: null } })).toBe(2);
    expect((await db.venture.findUniqueOrThrow({ where: { id: ids[1] } })).parentId).toBe(ids[0]);
    expect(await db.ventureAuditEvent.count({ where: { ventureId: { in: ids }, action: 'MEMBERSHIP_SAVED' } })).toBe(2);
  } finally {
    const fixtures = await db.venture.findMany({ where: { name: { startsWith: prefix } }, select: { id: true } });
    const cleanupIds = fixtures.map(v => v.id);
    await db.member.update({ where: { id: actor.id }, data: { ventureId: originalVenture } });
    await db.ventureAuditEvent.deleteMany({ where: { ventureId: { in: cleanupIds } } });
    await db.ventureMembership.deleteMany({ where: { ventureId: { in: cleanupIds } } });
    await db.venture.updateMany({ where: { id: { in: cleanupIds } }, data: { parentId: null } });
    await db.venture.deleteMany({ where: { id: { in: cleanupIds } } });
    await db.$disconnect();
  }
});
