-- Phase 3 Slice 1: Project persistence with distinct creator and Project Lead relationships.
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'DONE', 'ARCHIVED');

CREATE TYPE "ProjectStatusChangeSource" AS ENUM ('USER', 'SYSTEM');

CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "created_by_member_id" UUID NOT NULL,
    "lead_member_id" UUID NOT NULL,
    "done_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_departments" (
    "project_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_departments_pkey" PRIMARY KEY ("project_id", "department_id")
);

CREATE TABLE "project_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "from_status" "ProjectStatus",
    "to_status" "ProjectStatus" NOT NULL,
    "changed_by_member_id" UUID,
    "change_source" "ProjectStatusChangeSource" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "projects_created_by_member_id_idx" ON "projects"("created_by_member_id");
CREATE INDEX "projects_lead_member_id_idx" ON "projects"("lead_member_id");
CREATE INDEX "projects_status_idx" ON "projects"("status");
CREATE INDEX "project_departments_department_id_idx" ON "project_departments"("department_id");
CREATE INDEX "project_status_history_project_id_idx" ON "project_status_history"("project_id");
CREATE INDEX "project_status_history_changed_by_member_id_idx" ON "project_status_history"("changed_by_member_id");

ALTER TABLE "projects"
ADD CONSTRAINT "projects_created_by_member_id_fkey"
FOREIGN KEY ("created_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects"
ADD CONSTRAINT "projects_lead_member_id_fkey"
FOREIGN KEY ("lead_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_departments"
ADD CONSTRAINT "project_departments_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_departments"
ADD CONSTRAINT "project_departments_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_status_history"
ADD CONSTRAINT "project_status_history_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_status_history"
ADD CONSTRAINT "project_status_history_changed_by_member_id_fkey"
FOREIGN KEY ("changed_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
