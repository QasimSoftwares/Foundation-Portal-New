-- This migration fixes the get_total_volunteers RPC by changing it to SECURITY DEFINER.
-- This allows it to bypass RLS on the user_roles table and correctly count all volunteers for the admin metric.

-- Drop the existing function to ensure a clean update.
DROP FUNCTION IF EXISTS public.get_total_volunteers();

-- Recreate the function with SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.get_total_volunteers()
RETURNS integer
LANGUAGE plpgsql
-- Use SECURITY DEFINER to bypass RLS on the underlying user_roles table.
-- Authorization is handled internally by the is_admin() check.
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count integer;
BEGIN
  -- This RPC is for admins only.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can get total volunteers.';
  END IF;

  -- As an admin, we can now freely count the rows from the user_roles table.
  SELECT count(*)::integer
  INTO total_count
  FROM public.user_roles
  WHERE is_volunteer = TRUE;

  RETURN total_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in get_total_volunteers: %', SQLERRM;
    RETURN 0;
END;
$$;

-- Grant execute permission.
GRANT EXECUTE ON FUNCTION public.get_total_volunteers() TO authenticated;

COMMENT ON FUNCTION public.get_total_volunteers() IS 'Counts all approved volunteers. Admin-only. SECURITY DEFINER.';

RAISE NOTICE 'Successfully fixed and recreated the get_total_volunteers() function.';
