-- Preserve the append-only Project activity timeline after permitted Outcome deletion.
-- Existing activity rows retain their entity IDs for audit/display, but lose the
-- nullable FK pointing to a deleted Outcome.
ALTER TABLE "activity_logs"
  DROP CONSTRAINT "activity_logs_outcome_id_fkey";

ALTER TABLE "activity_logs"
  ADD CONSTRAINT "activity_logs_outcome_id_fkey"
  FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Stable, newest-first pagination with a deterministic tie-breaker.
CREATE INDEX "activity_logs_project_id_created_at_id_idx"
  ON "activity_logs"("project_id", "created_at" DESC, "id" DESC);
