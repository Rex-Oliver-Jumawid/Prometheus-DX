-- Persist exact schedule rest-day preferences instead of inferring them from empty days.
ALTER TABLE "member_schedules"
ADD COLUMN "rest_days" "Weekday"[] NOT NULL DEFAULT ARRAY[]::"Weekday"[];

-- Preserve the previous UI behavior for existing schedules by backfilling at most
-- the trailing two unscheduled weekdays as rest days.
UPDATE "member_schedules" AS schedule
SET "rest_days" = ARRAY(
  SELECT candidate.day
  FROM unnest(enum_range(NULL::"Weekday")) WITH ORDINALITY AS candidate(day, ordinal)
  WHERE NOT EXISTS (
    SELECT 1
    FROM "schedule_blocks" AS block
    WHERE block."schedule_id" = schedule."id"
      AND block."weekday" = candidate.day
  )
  ORDER BY candidate.ordinal DESC
  LIMIT 2
);
