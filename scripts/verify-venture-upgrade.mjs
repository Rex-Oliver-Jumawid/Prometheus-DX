import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// This intentionally exercises an old-schema upgrade on CI's disposable Postgres.
if (
  process.env.GITHUB_ACTIONS !== 'true' ||
  process.env.RUN_DATABASE_INTEGRATION !== '1' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
) {
  throw new Error(
    'Disposable GitHub CI database required for upgrade verification.',
  );
}
const directory = await mkdtemp(join(tmpdir(), 'prometheus-venture-upgrade-'));
const prisma = new PrismaClient();
const [a, b, member, project, notification] = Array.from({ length: 5 }, () =>
  randomUUID(),
);
try {
  await cp('prisma', directory, { recursive: true });
  await rm(join(directory, 'migrations', '20261115000000_venture_foundation'), {
    recursive: true,
  });
  execFileSync(
    'pnpm',
    [
      'exec',
      'prisma',
      'migrate',
      'deploy',
      '--schema',
      join(directory, 'schema.prisma'),
    ],
    { stdio: 'inherit' },
  );
  await prisma.$executeRaw`INSERT INTO departments (id,name,short_label,updated_at) VALUES (${a}::uuid,'Upgrade primary','UPA',now()),(${b}::uuid,'Upgrade focus','UPB',now())`;
  await prisma.$executeRaw`INSERT INTO members (id,email,full_name,department_id,visiwork_department_id,status,workspace_role,updated_at) VALUES (${member}::uuid,${`upgrade-${member}@prometheus.test`},'Upgrade member',${a}::uuid,${b}::uuid,'ACTIVE','MEMBER',now())`;
  await prisma.$executeRaw`INSERT INTO projects (id,name,description,created_by_member_id,lead_member_id,updated_at) VALUES (${project}::uuid,'Upgrade project','Preserved grouping',${member}::uuid,${member}::uuid,now())`;
  await prisma.$executeRaw`INSERT INTO project_departments (project_id,department_id) VALUES (${project}::uuid,${a}::uuid)`;
  await prisma.$executeRaw`INSERT INTO chat_push_mutes (member_id,channel_key) VALUES (${member}::uuid,${`visiwork:department:${a}`})`;
  await prisma.$executeRaw`INSERT INTO notifications (id,recipient_member_id,type,event_key,data) VALUES (${notification}::uuid,${member}::uuid,'VISIWORK_MENTION',${`upgrade-${notification}`},${JSON.stringify({ departmentId: a, roomLabel: 'UPA' })}::jsonb)`;
  execFileSync('pnpm', ['prisma:migrate:deploy'], { stdio: 'inherit' });
  const migrated = await prisma.member.findUniqueOrThrow({
    where: { id: member },
    include: { ventureMemberships: true },
  });
  assert.equal(migrated.ventureId, a);
  assert.equal(migrated.visiworkVentureId, b);
  assert.deepEqual(
    migrated.ventureMemberships.map((m) => m.ventureId).sort(),
    [a, b].sort(),
  );
  const preservedProject = await prisma.project.findUniqueOrThrow({
    where: { id: project },
    include: { ventures: true },
  });
  assert.equal(preservedProject.ventures[0].ventureId, a);
  const preservedNotification = await prisma.notification.findUniqueOrThrow({
    where: { id: notification },
  });
  assert.equal(preservedNotification.data.ventureId, a);
  assert.equal('departmentId' in preservedNotification.data, false);
  assert.equal(
    (
      await prisma.chatPushMute.findFirstOrThrow({
        where: { memberId: member },
      })
    ).channelKey,
    `visiwork:venture:${a}`,
  );
  await prisma.project.delete({ where: { id: project } });
  await prisma.notification.delete({ where: { id: notification } });
  await prisma.member.delete({ where: { id: member } });
  await prisma.venture.deleteMany({ where: { id: { in: [a, b] } } });
  console.info(
    'Venture upgrade verified: existing IDs, memberships, project grouping, notifications, and mute keys preserved.',
  );
} finally {
  await prisma.$disconnect();
  const resolved = resolve(directory);
  if (
    !resolved.startsWith(resolve(tmpdir()) + sep) ||
    !resolved.split(sep).at(-1).startsWith('prometheus-venture-upgrade-')
  )
    throw new Error('Unexpected temporary directory.');
  await rm(resolved, { recursive: true, force: true });
}
