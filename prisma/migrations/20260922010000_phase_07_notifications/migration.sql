BEGIN;

-- This migration also adopts the compatible Phase 7 table left in some
-- databases by an earlier branch. It is additive for a fresh database.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type AS t
    JOIN pg_namespace AS n ON n.oid = t.typnamespace
    WHERE n.nspname = current_schema()
      AND t.typname = 'NotificationType'
  ) THEN
    CREATE TYPE "NotificationType" AS ENUM (
      'PROJECT_LEAD_ASSIGNED',
      'PROJECT_MEMBER_ACCESS_CHANGED',
      'OUTCOME_JOINED',
      'SUBMISSION_CREATED',
      'REVISION_REQUESTED',
      'OUTCOME_ACCEPTED',
      'OUTCOME_REOPENED',
      'DEPENDENCY_UNLOCKED'
    );
  END IF;
END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_LEAD_ASSIGNED' BEFORE 'OUTCOME_JOINED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_MEMBER_ACCESS_CHANGED' BEFORE 'OUTCOME_JOINED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEPENDENCY_UNLOCKED' AFTER 'OUTCOME_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OUTCOME_REOPENED' AFTER 'OUTCOME_ACCEPTED';

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "recipient_member_id" UUID NOT NULL,
  "actor_member_id" UUID,
  "project_id" UUID,
  "outcome_id" UUID,
  "type" "NotificationType" NOT NULL,
  "event_key" VARCHAR(200) NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "data" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "notifications" ALTER COLUMN "project_id" DROP NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "event_key" TYPE VARCHAR(200);

ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_event_key_not_blank";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_key_not_blank"
  CHECK (length(btrim("event_key")) > 0);

CREATE UNIQUE INDEX IF NOT EXISTS "notifications_recipient_member_id_event_key_key"
  ON "notifications"("recipient_member_id", "event_key");
CREATE INDEX IF NOT EXISTS "notifications_recipient_member_id_created_at_id_idx"
  ON "notifications"("recipient_member_id", "created_at", "id");
CREATE INDEX IF NOT EXISTS "notifications_recipient_member_id_read_at_created_at_id_idx"
  ON "notifications"("recipient_member_id", "read_at", "created_at", "id");
CREATE INDEX IF NOT EXISTS "notifications_actor_member_id_idx" ON "notifications"("actor_member_id");
CREATE INDEX IF NOT EXISTS "notifications_project_id_idx" ON "notifications"("project_id");
CREATE INDEX IF NOT EXISTS "notifications_outcome_id_idx" ON "notifications"("outcome_id");

DROP INDEX IF EXISTS "notifications_recipient_member_id_created_at_idx";
DROP INDEX IF EXISTS "notifications_recipient_member_id_read_at_created_at_idx";

ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_recipient_member_id_fkey";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_member_id_fkey"
  FOREIGN KEY ("recipient_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_actor_member_id_fkey";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_member_id_fkey"
  FOREIGN KEY ("actor_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_project_id_fkey";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_outcome_id_fkey";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_outcome_id_fkey"
  FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "notifications" FROM anon, authenticated;

COMMIT;
