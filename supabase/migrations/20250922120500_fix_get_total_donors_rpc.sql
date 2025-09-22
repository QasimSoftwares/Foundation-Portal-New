-- This migration fixes the get_total_donors RPC to use the correct, canonical is_admin() function.

-- Drop the existing function to ensure a clean update.
DROP FUNCTION IF EXISTS public.get_total_donors();

-- Recreate the function with the corrected admin check.
CREATE OR REPLACE FUNCTION public.get_total_donors()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_donors_count integer;
  caller_is_admin boolean;
BEGIN
  -- Check if the caller is an admin using the canonical zero-argument function.
  SELECT public.is_admin() INTO caller_is_admin;

  -- Admins can see the total count of all donors.
  IF caller_is_admin THEN
    SELECT count(*) INTO total_donors_count FROM public.donors;
  -- Non-admins should not get a total count, this RPC is admin-only.
  ELSE
    -- For non-admins, this RPC should not return a full count.
    -- Returning 0 or raising an exception are options. Raising is safer.
    RAISE EXCEPTION 'Unauthorized: Only admins can get total donor count.';
  END IF;

  RETURN COALESCE(total_donors_count, 0);
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging and return a safe default.
    RAISE WARNING 'Error in get_total_donors: %', SQLERRM;
    RETURN 0;
END;
$$;

-- Grant execute permission to authenticated users.
GRANT EXECUTE ON FUNCTION public.get_total_donors() TO authenticated;

COMMENT ON FUNCTION public.get_total_donors() IS 'Returns the total number of donors. Admin-only. Uses the canonical is_admin() for authorization.';

RAISE NOTICE 'Successfully fixed and recreated the get_total_donors() function.';
