ALTER TABLE "push_deliveries" ALTER COLUMN "notification_id" DROP NOT NULL;
ALTER TABLE "push_deliveries" ADD COLUMN "payload" JSONB;
ALTER TABLE "push_deliveries" ADD COLUMN "channel_key" VARCHAR(120);
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_delivery_source_check"
CHECK ((notification_id IS NOT NULL AND payload IS NULL) OR
       (notification_id IS NULL AND payload IS NOT NULL AND channel_key IS NOT NULL));
