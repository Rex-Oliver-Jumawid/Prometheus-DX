-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'OUTCOME_JOINED',
  'SUBMISSION_CREATED',
  'REVISION_REQUESTED',
  'OUTCOME_ACCEPTED'
);

-- CreateTable
CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "recipient_member_id" UUID NOT NULL,
  "type" "NotificationType" NOT NULL,
  "event_key" VARCHAR(200) NOT NULL,
  "project_id" UUID NOT NULL,
  "outcome_id" UUID,
  "actor_member_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMPTZ(6),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_event_key_not_blank" CHECK (length(btrim("event_key")) > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_recipient_member_id_event_key_key"
  ON "notifications"("recipient_member_id", "event_key");
CREATE INDEX "notifications_recipient_member_id_created_at_idx"
  ON "notifications"("recipient_member_id", "created_at" DESC);
CREATE INDEX "notifications_recipient_member_id_read_at_created_at_idx"
  ON "notifications"("recipient_member_id", "read_at", "created_at" DESC);
CREATE INDEX "notifications_project_id_idx" ON "notifications"("project_id");
CREATE INDEX "notifications_outcome_id_idx" ON "notifications"("outcome_id");
CREATE INDEX "notifications_actor_member_id_idx" ON "notifications"("actor_member_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_member_id_fkey"
  FOREIGN KEY ("recipient_member_id") REFERENCES "members"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_outcome_id_fkey"
  FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_member_id_fkey"
  FOREIGN KEY ("actor_member_id") REFERENCES "members"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep business data behind the NestJS API and Prisma server connection.
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "notifications" FROM anon, authenticated;
