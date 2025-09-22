-- This migration fixes the get_total_donations RPC by changing it to SECURITY DEFINER.
-- This allows it to bypass RLS on the donations table and correctly sum all donation amounts for the admin metric.

-- Drop the existing function to ensure a clean update.
DROP FUNCTION IF EXISTS public.get_total_donations();

-- Recreate the function with SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.get_total_donations()
RETURNS numeric
LANGUAGE plpgsql
-- Use SECURITY DEFINER to bypass RLS on the underlying tables.
-- Authorization is handled internally by the is_admin() check.
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_amount numeric;
BEGIN
  -- This RPC is for admins only. The API route already checks for admin status,
  -- but we can add a redundant check here for safety.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can get total donations.';
  END IF;

  -- As an admin, we can now freely sum the amounts from the entire table.
  SELECT COALESCE(SUM(amount), 0)
  INTO total_amount
  FROM public.donations;

  RETURN total_amount;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in get_total_donations: %', SQLERRM;
    RETURN 0;
END;
$$;

-- Grant execute permission.
GRANT EXECUTE ON FUNCTION public.get_total_donations() TO authenticated;

COMMENT ON FUNCTION public.get_total_donations() IS 'Sums all donations. Admin-only. SECURITY DEFINER to bypass RLS.';

RAISE NOTICE 'Successfully fixed and recreated the get_total_donations() function.';
