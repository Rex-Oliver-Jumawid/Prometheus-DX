-- CreateEnum
CREATE TYPE "WorkSessionStatus" AS ENUM ('OPEN', 'COMPLETED', 'NEEDS_CORRECTION');

-- CreateTable
CREATE TABLE "work_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "member_id" UUID NOT NULL,
  "time_in" TIMESTAMPTZ(6) NOT NULL,
  "time_out" TIMESTAMPTZ(6),
  "status" "WorkSessionStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "work_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_sessions_time_order_check"
    CHECK ("time_out" IS NULL OR "time_out" >= "time_in"),
  CONSTRAINT "work_sessions_status_time_check"
    CHECK (
      ("status" IN ('OPEN', 'NEEDS_CORRECTION') AND "time_out" IS NULL)
      OR ("status" = 'COMPLETED' AND "time_out" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "work_session_corrections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "work_session_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "previous_time_in" TIMESTAMPTZ(6) NOT NULL,
  "previous_time_out" TIMESTAMPTZ(6),
  "new_time_in" TIMESTAMPTZ(6) NOT NULL,
  "new_time_out" TIMESTAMPTZ(6) NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_session_corrections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_session_corrections_time_order_check"
    CHECK ("new_time_out" >= "new_time_in"),
  CONSTRAINT "work_session_corrections_reason_check"
    CHECK (length(btrim("reason")) >= 3)
);

-- CreateIndex
CREATE UNIQUE INDEX "work_sessions_one_unresolved_per_member_idx"
  ON "work_sessions"("member_id")
  WHERE "time_out" IS NULL;

-- CreateIndex
CREATE INDEX "work_sessions_member_id_time_in_idx"
  ON "work_sessions"("member_id", "time_in");

-- CreateIndex
CREATE INDEX "work_sessions_member_id_status_idx"
  ON "work_sessions"("member_id", "status");

-- CreateIndex
CREATE INDEX "work_session_corrections_work_session_id_created_at_idx"
  ON "work_session_corrections"("work_session_id", "created_at");

-- CreateIndex
CREATE INDEX "work_session_corrections_member_id_created_at_idx"
  ON "work_session_corrections"("member_id", "created_at");

-- AddForeignKey
ALTER TABLE "work_sessions"
  ADD CONSTRAINT "work_sessions_member_id_fkey"
  FOREIGN KEY ("member_id") REFERENCES "members"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_session_corrections"
  ADD CONSTRAINT "work_session_corrections_work_session_id_fkey"
  FOREIGN KEY ("work_session_id") REFERENCES "work_sessions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_session_corrections"
  ADD CONSTRAINT "work_session_corrections_member_id_fkey"
  FOREIGN KEY ("member_id") REFERENCES "members"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
