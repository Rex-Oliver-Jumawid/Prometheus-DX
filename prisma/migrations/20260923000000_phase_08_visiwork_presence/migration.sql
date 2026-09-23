ALTER TABLE "members"
ADD COLUMN "visiwork_department_id" UUID;

CREATE INDEX "members_visiwork_department_id_idx"
  ON "members"("visiwork_department_id");

ALTER TABLE "members"
  ADD CONSTRAINT "members_visiwork_department_id_fkey"
  FOREIGN KEY ("visiwork_department_id") REFERENCES "departments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
