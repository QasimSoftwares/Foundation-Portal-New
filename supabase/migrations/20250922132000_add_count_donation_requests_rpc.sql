-- This migration adds a dedicated RPC to count all donation requests.
-- It uses SECURITY DEFINER to bypass RLS and get an accurate total for admin dashboards.

CREATE OR REPLACE FUNCTION public.count_total_donation_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count integer;
BEGIN
  -- This RPC is for admins only.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can count total donation requests.';
  END IF;

  -- As an admin, count all rows in the donation_requests table.
  SELECT count(*)::integer
  INTO total_count
  FROM public.donation_requests;

  RETURN total_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in count_total_donation_requests: %', SQLERRM;
    RETURN 0;
END;
$$;

-- Grant execute permission.
GRANT EXECUTE ON FUNCTION public.count_total_donation_requests() TO authenticated;

COMMENT ON FUNCTION public.count_total_donation_requests() IS 'Counts all donation requests. Admin-only. SECURITY DEFINER.';

RAISE NOTICE 'Successfully created the count_total_donation_requests() function.';
