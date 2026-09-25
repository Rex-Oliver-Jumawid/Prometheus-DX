-- A shared PostgreSQL quota across serverless function instances.
-- Only the trusted NestJS backend may access these counters.
CREATE TABLE "api_rate_limit_buckets" (
  "bucket_key" VARCHAR(128) NOT NULL,
  "hits" INTEGER NOT NULL DEFAULT 0,
  "reset_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "api_rate_limit_buckets_pkey" PRIMARY KEY ("bucket_key"),
  CONSTRAINT "api_rate_limit_buckets_hits_check" CHECK ("hits" >= 0)
);
CREATE INDEX "api_rate_limit_buckets_reset_at_idx"
  ON "api_rate_limit_buckets"("reset_at");
ALTER TABLE "api_rate_limit_buckets" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "api_rate_limit_buckets" FROM anon, authenticated;
