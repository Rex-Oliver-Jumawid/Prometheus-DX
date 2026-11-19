import { appendFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

async function main() {
  // This script can only provision the disposable local CI stack.
  if (
    process.env.CI_AUTHENTICATED_E2E !== '1' ||
    !process.env.GITHUB_ENV ||
    !['localhost', '127.0.0.1'].includes(
      new URL(process.env.SUPABASE_URL!).hostname,
    )
  ) {
    throw new Error('Disposable local CI Supabase is required.');
  }
  const email = `ci-${randomUUID()}@prometheus.test`;
  const password = `P5!${randomUUID()}aA1`;
  const auth = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data, error } = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw error ?? new Error('Could not provision CI identity.');
  const prisma = new PrismaClient();
  try {
    const department = await prisma.department.create({
      data: { name: 'CI fixtures', shortLabel: 'CI' },
    });
    await prisma.member.create({
      data: {
        authUserId: data.user.id,
        email,
        fullName: 'CI Administrator',
        status: 'ACTIVE',
        workspaceRole: 'ADMINISTRATOR',
        departmentId: department.id,
      },
    });
    appendFileSync(
      process.env.GITHUB_ENV,
      `E2E_MEMBER_EMAIL=${email}\nE2E_MEMBER_PASSWORD=${password}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
