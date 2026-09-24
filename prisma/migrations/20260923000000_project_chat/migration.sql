-- Project communication is persistent, server-authorized, and not directly writable by browser clients.
CREATE TABLE "project_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "parent_message_id" UUID,
    "body" VARCHAR(4000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(6),
    CONSTRAINT "project_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_messages_body_nonblank"
      CHECK (length(btrim("body")) BETWEEN 1 AND 4000),
    CONSTRAINT "project_messages_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_messages_member_id_fkey"
      FOREIGN KEY ("member_id") REFERENCES "members"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "project_messages_parent_message_id_fkey"
      FOREIGN KEY ("parent_message_id") REFERENCES "project_messages"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "project_messages_project_id_created_at_id_idx"
  ON "project_messages" ("project_id", "created_at", "id");
CREATE INDEX "project_messages_member_id_idx" ON "project_messages" ("member_id");
CREATE INDEX "project_messages_parent_message_id_idx"
  ON "project_messages" ("parent_message_id");

ALTER TABLE "project_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "project_messages" FROM anon, authenticated;
