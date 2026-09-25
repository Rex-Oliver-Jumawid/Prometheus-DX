-- Centralized fixed-window throttling across Vercel function instances.
-- Only privileged server-side database connections may access the ledger.
CREATE TABLE "api_rate_limits" (
  "key_hash" TEXT NOT NULL PRIMARY KEY,
  "window_start" TIMESTAMPTZ(6) NOT NULL,
  "hit_count" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "api_rate_limits_window_start_idx" ON "api_rate_limits" ("window_start");
ALTER TABLE "api_rate_limits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "api_rate_limits" FROM PUBLIC, anon, authenticated;
