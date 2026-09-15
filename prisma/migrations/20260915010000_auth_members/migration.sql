CREATE TYPE "WorkspaceRole" AS ENUM ('ADMINISTRATOR', 'MEMBER');
CREATE TYPE "MemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'DEACTIVATED');

CREATE TABLE "members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auth_user_id" UUID,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "workspace_role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MemberStatus" NOT NULL DEFAULT 'INVITED',
    "position" TEXT,
    "profile_image_path" TEXT,
    "deactivated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "members_deactivation_state_check" CHECK (
      ("status" = 'DEACTIVATED' AND "deactivated_at" IS NOT NULL)
      OR ("status" <> 'DEACTIVATED' AND "deactivated_at" IS NULL)
    )
);

CREATE UNIQUE INDEX "members_auth_user_id_key" ON "members"("auth_user_id");
CREATE UNIQUE INDEX "members_email_normalized_key" ON "members"(LOWER("email"));
CREATE INDEX "members_status_idx" ON "members"("status");
