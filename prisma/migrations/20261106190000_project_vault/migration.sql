-- Project Vault data is encrypted by the NestJS service before persistence.
-- Direct browser roles cannot read ciphertext or grant access.
CREATE TYPE "VaultItemKind" AS ENUM ('ENV_FILE', 'API_KEY', 'CREDENTIAL', 'SECURE_NOTE', 'FILE');

CREATE TABLE "project_vault_grants" (
  "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "member_id" UUID NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "approved_at" TIMESTAMPTZ(6),
  "approved_by_member_id" UUID REFERENCES "members"("id") ON DELETE RESTRICT,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_vault_grants_pkey" PRIMARY KEY ("project_id", "member_id")
);
CREATE INDEX "project_vault_grants_member_id_idx" ON "project_vault_grants" ("member_id");

CREATE TABLE "project_vault_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "title" VARCHAR(160) NOT NULL,
  "kind" "VaultItemKind" NOT NULL,
  "environment" VARCHAR(24) NOT NULL,
  "description" VARCHAR(1000) NOT NULL DEFAULT '',
  "file_name" VARCHAR(180),
  "current_version" INTEGER NOT NULL DEFAULT 1,
  "created_by_member_id" UUID NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "project_vault_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_vault_items_version_positive" CHECK ("current_version" >= 1),
  CONSTRAINT "project_vault_items_title_nonblank" CHECK (length(btrim("title")) > 0)
);
CREATE INDEX "project_vault_items_project_id_deleted_at_updated_at_idx"
  ON "project_vault_items" ("project_id", "deleted_at", "updated_at");

CREATE TABLE "project_vault_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "item_id" UUID NOT NULL REFERENCES "project_vault_items"("id") ON DELETE CASCADE,
  "version_number" INTEGER NOT NULL,
  "ciphertext" TEXT NOT NULL,
  "nonce" VARCHAR(24) NOT NULL,
  "auth_tag" VARCHAR(24) NOT NULL,
  "key_version" INTEGER NOT NULL DEFAULT 1,
  "byte_length" INTEGER NOT NULL,
  "created_by_member_id" UUID NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_vault_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_vault_versions_item_id_version_number_key" UNIQUE ("item_id", "version_number"),
  CONSTRAINT "project_vault_versions_length" CHECK ("byte_length" > 0 AND "byte_length" <= 262144),
  CONSTRAINT "project_vault_versions_version_positive" CHECK ("version_number" >= 1)
);
CREATE INDEX "project_vault_versions_created_by_member_id_idx"
  ON "project_vault_versions" ("created_by_member_id");

CREATE TABLE "project_vault_audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "item_id" UUID,
  "target_member_id" UUID,
  "actor_member_id" UUID NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "action" VARCHAR(32) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_vault_audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_vault_audit_events_project_id_created_at_id_idx"
  ON "project_vault_audit_events" ("project_id", "created_at", "id");
CREATE INDEX "project_vault_audit_events_actor_member_id_idx"
  ON "project_vault_audit_events" ("actor_member_id");

ALTER TABLE "project_vault_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_vault_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_vault_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_vault_audit_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "project_vault_grants", "project_vault_items",
  "project_vault_versions", "project_vault_audit_events" FROM anon, authenticated;
