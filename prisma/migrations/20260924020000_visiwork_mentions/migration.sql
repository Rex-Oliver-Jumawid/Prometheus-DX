ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VISIWORK_MENTION';

CREATE TABLE "visiwork_message_mentions" (
  "message_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  CONSTRAINT "visiwork_message_mentions_pkey"
    PRIMARY KEY ("message_id", "member_id"),
  CONSTRAINT "visiwork_message_mentions_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "visiwork_messages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "visiwork_message_mentions_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "members"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "visiwork_message_mentions_member_id_message_id_idx"
  ON "visiwork_message_mentions" ("member_id", "message_id");
