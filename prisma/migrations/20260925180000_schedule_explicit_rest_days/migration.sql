-- Persist the member's explicit rest-day selections independently of their
-- planned blocks. Existing schedules retain the legacy last-two-unscheduled
-- default on first load; subsequent saves may intentionally store zero days.
ALTER TABLE "member_schedules"
  ADD COLUMN "rest_days" "Weekday"[] NOT NULL DEFAULT ARRAY[]::"Weekday"[];

UPDATE "member_schedules" AS schedule
SET "rest_days" = ARRAY(
  SELECT picked.day
  FROM (
    SELECT days.day, days.weekday_order
    FROM (VALUES
      ('MONDAY'::"Weekday", 1),
      ('TUESDAY'::"Weekday", 2),
      ('WEDNESDAY'::"Weekday", 3),
      ('THURSDAY'::"Weekday", 4),
      ('FRIDAY'::"Weekday", 5),
      ('SATURDAY'::"Weekday", 6),
      ('SUNDAY'::"Weekday", 7)
    ) AS days(day, weekday_order)
    WHERE NOT EXISTS (
      SELECT 1 FROM "schedule_blocks" AS block
      WHERE block."schedule_id" = schedule."id"
        AND block."weekday" = days.day
    )
    ORDER BY days.weekday_order DESC
    LIMIT 2
  ) AS picked
  ORDER BY picked.weekday_order ASC
);
