-- Project announcements are managed by the API and visible with Project Chat.
CREATE TABLE "project_announcements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "body" VARCHAR(1200) NOT NULL,
  "pinned_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_announcements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_announcements_title_nonblank"
    CHECK (length(btrim("title")) BETWEEN 1 AND 160),
  CONSTRAINT "project_announcements_body_nonblank"
    CHECK (length(btrim("body")) BETWEEN 1 AND 1200),
  CONSTRAINT "project_announcements_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_announcements_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "members"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "project_announcements_project_id_pinned_at_created_at_id_idx"
  ON "project_announcements" ("project_id", "pinned_at" DESC, "created_at" DESC, "id" DESC);
CREATE INDEX "project_announcements_member_id_idx"
  ON "project_announcements" ("member_id");

ALTER TABLE "project_announcements" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "project_announcements" FROM anon, authenticated;
