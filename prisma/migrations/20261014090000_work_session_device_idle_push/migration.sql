-- Track activity per open session and deduplicate native device reminders.
ALTER TABLE "work_sessions"
  ADD COLUMN "last_activity_at" TIMESTAMPTZ(6),
  ADD COLUMN "idle_reminded_at" TIMESTAMPTZ(6);

CREATE INDEX "work_sessions_status_idle_reminded_at_last_activity_at_idx"
  ON "work_sessions"("status", "idle_reminded_at", "last_activity_at");
