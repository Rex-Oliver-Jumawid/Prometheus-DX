-- Business tables are accessed only through the authenticated NestJS API.
ALTER TABLE "features" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "features", "tasks" FROM anon, authenticated;

ALTER TABLE "features" ADD CONSTRAINT "features_title_not_blank" CHECK (length(btrim(title)) > 0);
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_title_not_blank" CHECK (length(btrim(title)) > 0);
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completion_consistent" CHECK (
  (status = 'TODO' AND completed_at IS NULL AND completed_by_member_id IS NULL)
  OR (status = 'DONE' AND completed_at IS NOT NULL AND completed_by_member_id IS NOT NULL)
);
