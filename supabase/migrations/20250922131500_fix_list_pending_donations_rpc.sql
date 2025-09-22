-- This migration fixes the list_pending_donation_requests RPC.
-- 1. It changes the function to SECURITY DEFINER to bypass RLS on the underlying tables.
-- 2. It adds a canonical is_admin() check to ensure only admins can call it.

-- Drop the existing function to ensure a clean update.
DROP FUNCTION IF EXISTS public.list_pending_donation_requests();

-- Recreate the function with the corrected logic and security context.
CREATE OR REPLACE FUNCTION public.list_pending_donation_requests()
RETURNS TABLE (
  donation_request_id uuid,
  donor_number text,
  donor_name text,
  amount numeric,
  currency public.enum_donation_currency,
  category_name text,
  project_name text,
  mode_of_payment public.enum_payment_mode,
  donation_type public.enum_donation_type,
  donation_date date,
  status public.enum_request_status,
  created_at timestamptz
)
LANGUAGE plpgsql
-- Use SECURITY DEFINER to bypass RLS.
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure only admins can execute this function.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can list pending donation requests.';
  END IF;

  -- As an admin, we can now freely query the tables.
  RETURN QUERY
  SELECT
    dr.donation_request_id,
    d.donor_number,
    COALESCE(pr.full_name, '') AS donor_name,
    dr.amount,
    dr.currency,
    dc.donation_category_name AS category_name,
    p.project_name,
    dr.mode_of_payment,
    dr.donation_type,
    dr.donation_date,
    dr.status,
    dr.created_at
  FROM public.donation_requests dr
  JOIN public.donors d ON d.donor_id = dr.donor_id
  JOIN public.profiles pr ON pr.user_id = d.user_id
  JOIN public.donation_categories dc ON dc.donation_category_id = dr.category_id
  JOIN public.projects p ON p.project_id = dr.project_id
  WHERE dr.status = 'Pending'::public.enum_request_status
  ORDER BY dr.created_at DESC;
END;
$$;

-- Grant execute permission.
GRANT EXECUTE ON FUNCTION public.list_pending_donation_requests() TO authenticated;

COMMENT ON FUNCTION public.list_pending_donation_requests() IS 'Returns all pending donation requests with joined data. Admin-only. SECURITY DEFINER.';

RAISE NOTICE 'Successfully fixed and recreated the list_pending_donation_requests() function.';
