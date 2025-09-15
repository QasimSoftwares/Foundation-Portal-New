-- supabase/migrations/YYYYMMDDHHMMSS_create_donor_metrics_rpc.sql

-- First, ensure the is_admin function exists as a prerequisite.
-- This function should check the user_roles table.
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id AND is_admin = TRUE
  );
$$;

-- RPC to get the total number of donors, respecting RLS.
CREATE OR REPLACE FUNCTION public.get_total_donors()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  total_donors_count integer;
  caller_id uuid := auth.uid();
  caller_is_admin boolean;
BEGIN
  -- Check if the caller is an admin using the centralized function.
  SELECT public.is_admin(caller_id) INTO caller_is_admin;

  -- Admins can see the total count of all donors.
  IF caller_is_admin THEN
    SELECT count(*) INTO total_donors_count FROM public.donors;
  -- Non-admins (including donors) can only check for their own existence.
  ELSE
    SELECT count(*) INTO total_donors_count FROM public.donors WHERE user_id = caller_id;
  END IF;

  RETURN total_donors_count;
END;
$$;
