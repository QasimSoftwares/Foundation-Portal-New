-- This migration proactively fixes the reject_donation_request RPC by changing it to SECURITY DEFINER.
-- This allows it to bypass RLS on the underlying tables and correctly update the request status.

-- Drop the existing function to ensure a clean update.
DROP FUNCTION IF EXISTS public.reject_donation_request(uuid, text);

-- Recreate the function with SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.reject_donation_request(
  p_donation_request_id uuid,
  p_reason text
)
RETURNS public.donation_requests
LANGUAGE plpgsql
-- Use SECURITY DEFINER to bypass RLS.
-- Authorization is handled internally by the is_admin() check.
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.donation_requests;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can reject donation requests' USING ERRCODE = '42501';
  END IF;

  UPDATE public.donation_requests
  SET status = 'Rejected'::public.enum_request_status,
      approved_by = v_actor, -- Use approved_by to track who actioned the request
      approved_at = now(),   -- Use approved_at to track when it was actioned
      rejection_reason = NULLIF(trim(p_reason), '')
  WHERE donation_request_id = p_donation_request_id
    AND status = 'Pending'::public.enum_request_status
  RETURNING * INTO v_req;

  IF v_req.donation_request_id IS NULL THEN
    RAISE EXCEPTION 'Donation request not found or not pending';
  END IF;

  RETURN v_req;
END;
$$;

-- Grant execute permission.
GRANT EXECUTE ON FUNCTION public.reject_donation_request(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.reject_donation_request(uuid, text) IS 'Rejects a pending donation request. Admin-only. SECURITY DEFINER.';

RAISE NOTICE 'Successfully fixed and recreated the reject_donation_request() function.';
