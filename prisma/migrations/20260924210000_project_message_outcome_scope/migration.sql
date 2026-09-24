-- Preserve the canonical nullable Outcome scope for future Outcome-specific Project discussion.
-- General Project Chat writes NULL and explicitly queries only NULL-scoped messages.
ALTER TABLE "project_messages"
  ADD COLUMN "outcome_id" UUID;

ALTER TABLE "project_messages"
  ADD CONSTRAINT "project_messages_outcome_id_fkey"
  FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "project_messages_outcome_id_created_at_id_idx"
  ON "project_messages" ("outcome_id", "created_at", "id");
