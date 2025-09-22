-- This is the definitive and final migration to fix the is_admin function.
-- It aggressively finds and removes ALL functions named is_admin, then creates the one correct version.

DO $$
DECLARE
  func_oid oid;
BEGIN
  -- Find and drop every function named 'is_admin' in the 'public' schema, regardless of its arguments.
  FOR func_oid IN (
    SELECT oid
    FROM pg_proc
    WHERE proname = 'is_admin'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_oid::regprocedure || ' CASCADE;';
    RAISE NOTICE 'Dropped function: %', func_oid::regprocedure;
  END LOOP;
END $$;

-- Recreate the single, canonical version of is_admin().
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Correctly checks the flag on the user_roles table for the currently authenticated user.
  SELECT ur.is_admin
  INTO v_is_admin
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid();

  -- If the user has no entry, they are not an admin. Default to false.
  RETURN COALESCE(v_is_admin, false);
EXCEPTION WHEN OTHERS THEN
  -- In case of any error (e.g., auth.uid() is null), safely return false.
  RAISE WARNING 'Error in is_admin(): %', SQLERRM;
  RETURN false;
END;
$$;

-- Grant permission ONLY to authenticated users.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS 'Definitive canonical check to see if the current user is an admin. Returns true/false. Safe for RPCs.';

RAISE NOTICE 'Successfully created the definitive canonical public.is_admin() function.';
