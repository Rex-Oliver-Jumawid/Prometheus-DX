import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

/** Test-only provisioning: no invitation email, service credential, or auth bypass in application code. */
export async function createAuthFixture(prisma: PrismaClient, prefix: string) {
  const id = randomUUID();
  const email = `${prefix}-${id}@prometheus.test`;
  const password = `P5!${randomUUID()}aA1`;
  await prisma.$transaction(async (db) => {
    await db.$executeRaw`
      INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        created_at, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000000'::uuid, ${id}::uuid,
        'authenticated', 'authenticated', ${email}, extensions.crypt(${password}, extensions.gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        '', '', '', '', now(), now())`;
    await db.$executeRaw`
      INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
      VALUES (${id}, ${id}::uuid, ${JSON.stringify({ sub: id, email, email_verified: true })}::jsonb, 'email', now(), now())`;
  });
  return { id, email, password };
}

export async function deleteAuthFixture(
  prisma: PrismaClient,
  fixture: { id: string; email: string },
) {
  // Exact ID and generated fixture email guard against deleting a pre-existing account.
  if (!fixture.email.endsWith('@prometheus.test'))
    throw new Error('Not an isolated test identity.');
  await prisma.$executeRaw`DELETE FROM auth.users WHERE id = ${fixture.id}::uuid AND email = ${fixture.email}`;
}
