-- Migration: Add rollback function to emulate atomic approval with storage upload

-- This function reverts an approved donation by:
-- - Restoring the related donation_request status to 'Pending'
-- - Clearing approval fields on the request
-- - Deleting the donation row
-- Use this when storage upload or post-approval steps fail.
CREATE OR REPLACE FUNCTION public.rollback_approved_donation(p_donation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_donation public.donations;
BEGIN
  SELECT * INTO v_donation
  FROM public.donations
  WHERE donation_id = p_donation_id
  FOR UPDATE;

  IF v_donation.donation_id IS NULL THEN
    RAISE EXCEPTION 'Donation not found for rollback';
  END IF;

  -- If the donations table has donation_request_id, reset the original request
  IF v_donation.donation_request_id IS NOT NULL THEN
    UPDATE public.donation_requests
    SET 
      status = 'Pending'::public.enum_request_status,
      approved_by = NULL,
      approved_at = NULL,
      rejection_reason = NULL
    WHERE donation_request_id = v_donation.donation_request_id;
  END IF;

  -- Delete the donation row
  DELETE FROM public.donations
  WHERE donation_id = p_donation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rollback_approved_donation(uuid) TO authenticated;

COMMENT ON FUNCTION public.rollback_approved_donation(uuid) IS 'Reverts a donation approval when subsequent steps (e.g., storage upload) fail.';
