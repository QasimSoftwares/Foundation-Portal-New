-- supabase/migrations/20250921232000_correct_is_admin_definition.sql

-- This migration provides the definitive, correct implementation of the is_admin() function
-- based on the actual database schema.
-- It removes the incorrect JOIN to a 'roles' table and instead checks the 'is_admin' boolean
-- flag directly on the 'user_roles' table.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Correct Logic: Select the is_admin flag directly from the user_roles table for the current user.
  SELECT ur.is_admin
  INTO v_is_admin
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid();

  -- If no row is found for the user, or the flag is null, they are not an admin.
  RETURN COALESCE(v_is_admin, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS 'Checks if the current user has the is_admin flag set to true in the user_roles table.';
