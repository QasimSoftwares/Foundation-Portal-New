-- Fix for get_total_donors function to ensure it exists and works correctly

-- Drop the function if it exists to ensure clean creation
DROP FUNCTION IF EXISTS public.get_total_donors();

-- Recreate the function with proper error handling
CREATE OR REPLACE FUNCTION public.get_total_donors()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_donors_count integer;
  caller_id uuid;
  caller_is_admin boolean;
BEGIN
  -- Safely get the authenticated user ID
  caller_id := auth.uid();
  
  -- Check if the caller is an admin using the centralized function.
  SELECT public.is_admin(caller_id) INTO caller_is_admin;

  -- Admins can see the total count of all donors.
  IF caller_is_admin THEN
    SELECT count(*) INTO total_donors_count FROM public.donors;
  -- Non-admins (including donors) can only check for their own existence.
  ELSE
    SELECT count(*) INTO total_donors_count FROM public.donors WHERE user_id = caller_id;
  END IF;

  RETURN COALESCE(total_donors_count, 0);
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE WARNING 'Error in get_total_donors: %', SQLERRM;
    RETURN 0;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_total_donors() TO authenticated;
