-- supabase/migrations/20250921222500_create_parameterized_is_admin.sql

-- This migration creates a new, parameterized version of is_admin(uuid).
-- This version is safe to call from any context (middleware, other RPCs) because it does not rely on auth.uid().
-- It coexists with the non-parameterized is_admin() used by RLS policies.

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

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_admin(uuid) IS 'Checks if a given user ID has the admin role. SECURITY DEFINER. Safe for use in middleware and other DEFINER functions.';
