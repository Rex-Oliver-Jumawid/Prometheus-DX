-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'DONE');

-- CreateTable
CREATE TABLE "features" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outcome_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "created_by_member_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "feature_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "position" INTEGER NOT NULL,
    "created_by_member_id" UUID NOT NULL,
    "completed_by_member_id" UUID,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "features_created_by_member_id_idx" ON "features"("created_by_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "features_outcome_id_position_key" ON "features"("outcome_id", "position");

-- CreateIndex
CREATE INDEX "tasks_created_by_member_id_idx" ON "tasks"("created_by_member_id");

-- CreateIndex
CREATE INDEX "tasks_completed_by_member_id_idx" ON "tasks"("completed_by_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_feature_id_position_key" ON "tasks"("feature_id", "position");

-- AddForeignKey
ALTER TABLE "features" ADD CONSTRAINT "features_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "features" ADD CONSTRAINT "features_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_member_id_fkey" FOREIGN KEY ("completed_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
