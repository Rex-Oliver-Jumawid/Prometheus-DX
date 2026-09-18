-- CreateEnum
CREATE TYPE "Weekday" AS ENUM (
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
);

-- CreateTable
CREATE TABLE "member_schedules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "member_id" UUID NOT NULL,
  "target_weekly_minutes" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "member_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "member_schedules_target_weekly_minutes_check"
    CHECK ("target_weekly_minutes" >= 0 AND "target_weekly_minutes" <= 10080)
);

-- CreateTable
CREATE TABLE "schedule_blocks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schedule_id" UUID NOT NULL,
  "weekday" "Weekday" NOT NULL,
  "start_time" TIME(0) NOT NULL,
  "end_time" TIME(0) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "schedule_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_blocks_time_order_check" CHECK ("start_time" < "end_time")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_schedules_member_id_key" ON "member_schedules"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_blocks_schedule_id_weekday_start_time_end_time_key"
  ON "schedule_blocks"("schedule_id", "weekday", "start_time", "end_time");

-- CreateIndex
CREATE INDEX "schedule_blocks_schedule_id_weekday_start_time_idx"
  ON "schedule_blocks"("schedule_id", "weekday", "start_time");

-- AddForeignKey
ALTER TABLE "member_schedules"
  ADD CONSTRAINT "member_schedules_member_id_fkey"
  FOREIGN KEY ("member_id") REFERENCES "members"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_blocks"
  ADD CONSTRAINT "schedule_blocks_schedule_id_fkey"
  FOREIGN KEY ("schedule_id") REFERENCES "member_schedules"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
