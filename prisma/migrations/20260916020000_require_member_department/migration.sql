-- The live invariant was verified before this migration: every Member has a
-- valid Department relationship.
ALTER TABLE "members"
ALTER COLUMN "department_id" SET NOT NULL;
