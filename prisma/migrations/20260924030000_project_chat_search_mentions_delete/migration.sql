-- Keep reply chains intact after author deletion; restrict mentions to API-authorized writes.
ALTER TABLE "project_messages" ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

CREATE TABLE "project_message_mentions" (
  "message_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  CONSTRAINT "project_message_mentions_pkey" PRIMARY KEY ("message_id", "member_id"),
  CONSTRAINT "project_message_mentions_message_id_fkey" FOREIGN KEY ("message_id")
    REFERENCES "project_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_message_mentions_member_id_fkey" FOREIGN KEY ("member_id")
    REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "project_message_mentions_member_id_idx" ON "project_message_mentions" ("member_id");
ALTER TABLE "project_message_mentions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "project_message_mentions" FROM anon, authenticated;
