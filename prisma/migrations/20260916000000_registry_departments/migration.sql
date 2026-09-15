CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "departments_name_idx" ON "departments"("name");

ALTER TABLE "members" ADD COLUMN "department_id" UUID;

CREATE INDEX "members_department_id_idx" ON "members"("department_id");

ALTER TABLE "members"
ADD CONSTRAINT "members_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
