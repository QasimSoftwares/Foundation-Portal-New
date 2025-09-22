-- supabase/migrations/20250921223500_definitive_fix_for_is_admin.sql

-- This migration provides a single, definitive fix for all is_admin function conflicts.
-- It drops all existing versions and re-creates the two necessary overloaded functions
-- with the correct security contexts.

-- Drop all potentially conflicting versions of is_admin. 
-- NOTE: This is safe only because we are immediately recreating them in this same transaction.
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- Version 1: is_admin() for RLS policies.
-- It MUST be SECURITY INVOKER to run as the user making the query.
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

COMMENT ON FUNCTION public.is_admin() IS 'Checks if the current user has the admin role. SECURITY INVOKER. For RLS policies.';

-- Version 2: is_admin(uuid) for RPCs and middleware.
-- It MUST be SECURITY DEFINER to check roles without being blocked by RLS.
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

COMMENT ON FUNCTION public.is_admin(uuid) IS 'Checks if a given user ID has the admin role. SECURITY DEFINER. For use in other functions.';

-- Grant permissions for both functions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
