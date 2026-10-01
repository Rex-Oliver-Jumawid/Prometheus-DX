CREATE TABLE "push_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "member_id" UUID NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_member_id_idx" ON "push_subscriptions"("member_id");
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "push_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "notification_id" UUID NOT NULL,
  "subscription_id" UUID NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimed_at" TIMESTAMPTZ(6),
  "claim_token" UUID,
  "delivered_at" TIMESTAMPTZ(6),
  "last_error" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_deliveries_notification_id_subscription_id_key" ON "push_deliveries"("notification_id", "subscription_id");
CREATE INDEX "push_deliveries_delivered_at_next_attempt_at_attempts_idx" ON "push_deliveries"("delivered_at", "next_attempt_at", "attempts");
CREATE INDEX "push_deliveries_claim_token_idx" ON "push_deliveries"("claim_token");
CREATE INDEX "push_deliveries_subscription_id_idx" ON "push_deliveries"("subscription_id");
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "push_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION queue_push_deliveries_for_notification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "push_deliveries" ("notification_id", "subscription_id")
  SELECT NEW."id", subscription."id"
  FROM "push_subscriptions" AS subscription
  WHERE subscription."member_id" = NEW."recipient_member_id"
  ON CONFLICT ("notification_id", "subscription_id") DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "notifications_queue_push_deliveries"
AFTER INSERT ON "notifications"
FOR EACH ROW
EXECUTE FUNCTION queue_push_deliveries_for_notification();
