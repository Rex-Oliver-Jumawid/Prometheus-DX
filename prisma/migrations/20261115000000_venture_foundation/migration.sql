BEGIN;
-- CreateEnum
CREATE TYPE "VentureStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "parent_id" UUID,
ADD COLUMN     "status" "VentureStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "members" ALTER COLUMN "department_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "venture_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venture_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "founder" BOOLEAN NOT NULL DEFAULT false,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "venture_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venture_audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venture_id" UUID NOT NULL,
    "actor_member_id" UUID,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venture_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venture_memberships_member_id_ended_at_idx" ON "venture_memberships"("member_id", "ended_at");

-- CreateIndex
CREATE UNIQUE INDEX "venture_memberships_venture_id_member_id_key" ON "venture_memberships"("venture_id", "member_id");

-- CreateIndex
CREATE INDEX "venture_audit_events_venture_id_created_at_idx" ON "venture_audit_events"("venture_id", "created_at");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venture_memberships" ADD CONSTRAINT "venture_memberships_venture_id_fkey" FOREIGN KEY ("venture_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venture_memberships" ADD CONSTRAINT "venture_memberships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venture_audit_events" ADD CONSTRAINT "venture_audit_events_venture_id_fkey" FOREIGN KEY ("venture_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venture_audit_events" ADD CONSTRAINT "venture_audit_events_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Primary and focused room assignments become explicit memberships without losing IDs.
INSERT INTO venture_memberships (venture_id, member_id)
SELECT department_id, id FROM members WHERE department_id IS NOT NULL
UNION SELECT visiwork_department_id, id FROM members WHERE visiwork_department_id IS NOT NULL
ON CONFLICT (venture_id, member_id) DO NOTHING;
ALTER TABLE departments ADD CONSTRAINT venture_parent_not_self CHECK (parent_id IS DISTINCT FROM id);
ALTER TABLE venture_memberships ALTER COLUMN roles SET NOT NULL, ALTER COLUMN permissions SET NOT NULL;
ALTER TABLE venture_memberships ADD CONSTRAINT venture_roles_allowed CHECK (roles <@ ARRAY['CEO','CTO','COO','DEVOPS']::text[]);
ALTER TABLE venture_memberships ADD CONSTRAINT venture_permissions_allowed CHECK (permissions <@ ARRAY['venture.manage','venture.members.manage']::text[]);
ALTER TABLE venture_memberships ADD CONSTRAINT venture_membership_dates CHECK (ended_at IS NULL OR ended_at >= joined_at);
UPDATE chat_push_mutes SET channel_key = regexp_replace(channel_key, '^visiwork:department:', 'visiwork:venture:') WHERE channel_key LIKE 'visiwork:department:%';
UPDATE push_deliveries SET channel_key = regexp_replace(channel_key, '^visiwork:department:', 'visiwork:venture:') WHERE channel_key LIKE 'visiwork:department:%';

UPDATE notifications SET data = (data - 'departmentId') || jsonb_build_object('ventureId', data->'departmentId') WHERE data ? 'departmentId';
UPDATE push_deliveries SET payload = jsonb_set(payload, '{url}', to_jsonb(replace(payload->>'url', 'department=', 'venture='))) WHERE payload->>'url' LIKE '%department=%';
ALTER TABLE venture_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE venture_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON venture_memberships, venture_audit_events FROM anon, authenticated;

-- Registry primary selection is optional. Selecting it also establishes membership.
CREATE FUNCTION sync_primary_venture_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.department_id IS NOT NULL THEN
    INSERT INTO venture_memberships (venture_id, member_id) VALUES (NEW.department_id, NEW.id)
    ON CONFLICT (venture_id, member_id) DO UPDATE SET ended_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER member_primary_venture_membership AFTER INSERT OR UPDATE OF department_id ON members
FOR EACH ROW EXECUTE FUNCTION sync_primary_venture_membership();

COMMIT;
