-- supabase/migrations/20250921231500_restore_original_is_admin.sql

-- This migration restores the single, original is_admin() function to the state it was in before it was incorrectly modified.
-- This version is SECURITY DEFINER, which is what the application's RLS policies and middleware were built to expect.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- This logic checks the roles table for an active admin role for the current user.
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
      AND ur.status = 'active'
  ) INTO v_is_admin;

  RETURN COALESCE(v_is_admin, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS 'Restores the original check to see if the current user has the admin role. SECURITY DEFINER.';
