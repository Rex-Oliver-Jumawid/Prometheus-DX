CREATE TABLE "chat_push_mutes" (
  "member_id" UUID NOT NULL,
  "channel_key" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_push_mutes_pkey" PRIMARY KEY ("member_id", "channel_key")
);

CREATE INDEX "chat_push_mutes_channel_key_idx"
ON "chat_push_mutes"("channel_key");

ALTER TABLE "chat_push_mutes"
ADD CONSTRAINT "chat_push_mutes_member_id_fkey"
FOREIGN KEY ("member_id")
REFERENCES "members"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "chat_push_mutes" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "chat_push_mutes" FROM anon;
REVOKE ALL ON TABLE "chat_push_mutes" FROM authenticated;
