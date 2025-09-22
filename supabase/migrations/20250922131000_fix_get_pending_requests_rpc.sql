-- This migration fixes the get_pending_role_requests RPC.
-- 1. It removes the dependency on the non-existent is_user_admin(uuid) function.
-- 2. It updates the function to use the canonical, zero-argument is_admin() function.
-- 3. It ensures the function is SECURITY DEFINER to bypass RLS on the underlying role_requests table.

-- Drop the existing function to ensure a clean update.
DROP FUNCTION IF EXISTS public.get_pending_role_requests();

-- Recreate the function with the corrected logic.
CREATE OR REPLACE FUNCTION public.get_pending_role_requests()
RETURNS SETOF public.role_requests AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Use the canonical is_admin() function for the authorization check.
  SELECT public.is_admin() INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- As an admin, we can now freely query the entire table.
  RETURN QUERY
  SELECT *
  FROM public.role_requests rr
  WHERE rr.request_status = 'pending'
  ORDER BY rr.created_at ASC;
END;
$$ LANGUAGE plpgsql
-- Use SECURITY DEFINER to bypass RLS on the role_requests table.
SECURITY DEFINER;

-- Grant execute permission.
GRANT EXECUTE ON FUNCTION public.get_pending_role_requests() TO authenticated;

COMMENT ON FUNCTION public.get_pending_role_requests() IS 'Returns all pending role requests. Admin-only. SECURITY DEFINER.';

RAISE NOTICE 'Successfully fixed and recreated the get_pending_role_requests() function.';
