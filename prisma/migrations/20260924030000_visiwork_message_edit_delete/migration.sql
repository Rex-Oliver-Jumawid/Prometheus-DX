ALTER TABLE "visiwork_messages"
ADD COLUMN "edited_at" TIMESTAMPTZ(6),
ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

CREATE INDEX "visiwork_messages_deleted_at_idx"
  ON "visiwork_messages" ("deleted_at");
