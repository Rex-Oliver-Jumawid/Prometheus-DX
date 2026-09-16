-- Phase 4: Project workflow structure, permanent Outcome Membership, and derived Project Membership.
CREATE TYPE "ProjectAccessLevel" AS ENUM ('CAN_VIEW', 'CAN_EDIT');

CREATE TYPE "OutcomeLifecycleStatus" AS ENUM ('OPEN', 'NEEDS_REVISION', 'ACCEPTED');

CREATE TABLE "project_members" (
    "project_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "access_level" "ProjectAccessLevel" NOT NULL DEFAULT 'CAN_VIEW',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id", "member_id")
);

CREATE TABLE "project_member_access_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "previous_access" "ProjectAccessLevel" NOT NULL,
    "new_access" "ProjectAccessLevel" NOT NULL,
    "changed_by_member_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_member_access_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outcomes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stage_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "lifecycle_status" "OutcomeLifecycleStatus" NOT NULL DEFAULT 'OPEN',
    "position" INTEGER NOT NULL,
    "created_by_member_id" UUID NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "outcomes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outcome_departments" (
    "outcome_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outcome_departments_pkey" PRIMARY KEY ("outcome_id", "department_id")
);

CREATE TABLE "outcome_members" (
    "outcome_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outcome_members_pkey" PRIMARY KEY ("outcome_id", "member_id")
);

CREATE TABLE "outcome_dependencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outcome_id" UUID NOT NULL,
    "prerequisite_outcome_id" UUID NOT NULL,
    "override_resolved_at" TIMESTAMPTZ(6),
    "override_resolved_by_member_id" UUID,
    "override_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outcome_dependencies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outcome_dependencies_not_self" CHECK ("outcome_id" <> "prerequisite_outcome_id")
);

CREATE TABLE "acceptance_criteria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outcome_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "acceptance_criteria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stages_project_id_position_key" ON "stages"("project_id", "position");
CREATE INDEX "stages_project_id_idx" ON "stages"("project_id");
CREATE UNIQUE INDEX "outcomes_stage_id_position_key" ON "outcomes"("stage_id", "position");
CREATE INDEX "outcomes_stage_id_idx" ON "outcomes"("stage_id");
CREATE INDEX "outcomes_lifecycle_status_idx" ON "outcomes"("lifecycle_status");
CREATE INDEX "outcomes_created_by_member_id_idx" ON "outcomes"("created_by_member_id");
CREATE INDEX "project_members_member_id_idx" ON "project_members"("member_id");
CREATE INDEX "project_member_access_history_project_id_member_id_idx" ON "project_member_access_history"("project_id", "member_id");
CREATE INDEX "project_member_access_history_changed_by_member_id_idx" ON "project_member_access_history"("changed_by_member_id");
CREATE INDEX "outcome_departments_department_id_idx" ON "outcome_departments"("department_id");
CREATE INDEX "outcome_members_member_id_idx" ON "outcome_members"("member_id");
CREATE UNIQUE INDEX "outcome_dependencies_outcome_id_prerequisite_outcome_id_key" ON "outcome_dependencies"("outcome_id", "prerequisite_outcome_id");
CREATE INDEX "outcome_dependencies_outcome_id_idx" ON "outcome_dependencies"("outcome_id");
CREATE INDEX "outcome_dependencies_prerequisite_outcome_id_idx" ON "outcome_dependencies"("prerequisite_outcome_id");
CREATE INDEX "outcome_dependencies_override_resolved_by_member_id_idx" ON "outcome_dependencies"("override_resolved_by_member_id");
CREATE UNIQUE INDEX "acceptance_criteria_outcome_id_position_key" ON "acceptance_criteria"("outcome_id", "position");
CREATE INDEX "acceptance_criteria_outcome_id_idx" ON "acceptance_criteria"("outcome_id");

ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_member_access_history" ADD CONSTRAINT "project_member_access_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_member_access_history" ADD CONSTRAINT "project_member_access_history_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_member_access_history" ADD CONSTRAINT "project_member_access_history_changed_by_member_id_fkey" FOREIGN KEY ("changed_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stages" ADD CONSTRAINT "stages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outcome_departments" ADD CONSTRAINT "outcome_departments_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outcome_departments" ADD CONSTRAINT "outcome_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outcome_members" ADD CONSTRAINT "outcome_members_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outcome_members" ADD CONSTRAINT "outcome_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outcome_dependencies" ADD CONSTRAINT "outcome_dependencies_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outcome_dependencies" ADD CONSTRAINT "outcome_dependencies_prerequisite_outcome_id_fkey" FOREIGN KEY ("prerequisite_outcome_id") REFERENCES "outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outcome_dependencies" ADD CONSTRAINT "outcome_dependencies_override_resolved_by_member_id_fkey" FOREIGN KEY ("override_resolved_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acceptance_criteria" ADD CONSTRAINT "acceptance_criteria_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION enforce_same_project_outcome_dependency()
RETURNS TRIGGER AS $$
DECLARE
    dependent_project_id UUID;
    prerequisite_project_id UUID;
BEGIN
    SELECT s.project_id INTO dependent_project_id
    FROM outcomes o
    JOIN stages s ON s.id = o.stage_id
    WHERE o.id = NEW.outcome_id;

    SELECT s.project_id INTO prerequisite_project_id
    FROM outcomes o
    JOIN stages s ON s.id = o.stage_id
    WHERE o.id = NEW.prerequisite_outcome_id;

    IF dependent_project_id IS DISTINCT FROM prerequisite_project_id THEN
        RAISE EXCEPTION 'Outcome dependencies must remain within one Project';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "outcome_dependencies_same_project"
BEFORE INSERT OR UPDATE ON "outcome_dependencies"
FOR EACH ROW EXECUTE FUNCTION enforce_same_project_outcome_dependency();
