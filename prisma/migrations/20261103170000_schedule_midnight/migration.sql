-- Midnight end times represent the end of the selected day.
-- Prisma TIME values use 00:00 in storage; the API exposes these as 24:00.
ALTER TABLE "schedule_blocks"
  DROP CONSTRAINT "schedule_blocks_time_order_check",
  ADD CONSTRAINT "schedule_blocks_time_order_check"
    CHECK ("start_time" < "end_time" OR "end_time" = TIME '00:00:00');
