CREATE TABLE "visiwork_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "department_id" UUID,
  "member_id" UUID NOT NULL,
  "body" VARCHAR(2000) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visiwork_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "visiwork_messages_body_nonblank"
    CHECK (length(btrim("body")) BETWEEN 1 AND 2000),
  CONSTRAINT "visiwork_messages_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "visiwork_messages_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "members"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "visiwork_messages_department_id_created_at_id_idx"
  ON "visiwork_messages" ("department_id", "created_at", "id");

CREATE INDEX "visiwork_messages_created_at_id_idx"
  ON "visiwork_messages" ("created_at", "id");

CREATE INDEX "visiwork_messages_member_id_idx"
  ON "visiwork_messages" ("member_id");

ALTER TABLE "visiwork_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "visiwork_messages" FROM anon, authenticated;
