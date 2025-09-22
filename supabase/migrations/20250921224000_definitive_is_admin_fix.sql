-- supabase/migrations/20250921224000_definitive_is_admin_fix.sql

-- This migration provides a single, definitive fix for all is_admin function conflicts.
-- It creates two overloaded versions to handle different security contexts correctly
-- without dropping any existing dependencies like RLS policies.

-- Version 1: is_admin() with no parameters for RLS and SECURITY INVOKER contexts.
-- This is the function RLS policies depend on. It runs as the calling user.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
      AND ur.status = 'active'
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS 'Checks if the current authenticated user has the admin role. SECURITY INVOKER. Safe for RLS policies.';

-- Version 2: is_admin(uuid) with a parameter for SECURITY DEFINER contexts.
-- This is for use in other RPCs to check a specific user''s role.
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND r.name = 'admin'
      AND ur.status = 'active'
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin(uuid) IS 'Checks if a given user ID has the admin role. SECURITY DEFINER. Safe for use in other functions.';

-- Grant permissions for both functions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
