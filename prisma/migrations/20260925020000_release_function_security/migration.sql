-- Small defensive follow-up to the Supabase security advisor findings.
-- Keep the trigger's trusted relation lookup order explicit.
ALTER FUNCTION public.enforce_same_project_outcome_dependency()
  SET search_path = pg_catalog, public, pg_temp;

-- Supabase projects may install this auto-RLS event trigger independently of
-- tracked Prisma migrations. Local CI databases may not have the function.
-- Keep it usable by its database owner for DDL event handling while removing
-- inherited browser-role EXECUTE grants when present.
DO $body$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END;
$body$;
