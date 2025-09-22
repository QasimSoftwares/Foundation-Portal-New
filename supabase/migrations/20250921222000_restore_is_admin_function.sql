-- supabase/migrations/20250921222000_restore_is_admin_function.sql

-- This migration restores the original, working version of the public.is_admin() function.
-- This version is SECURITY INVOKER (the default), which is required for it to function correctly
-- within Row-Level Security (RLS) policies.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
-- Defaults to SECURITY INVOKER, which is the correct context for RLS.
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
      AND ur.status = 'active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS 'Checks if the current authenticated user has the admin role. SECURITY INVOKER. Used by RLS policies.';
