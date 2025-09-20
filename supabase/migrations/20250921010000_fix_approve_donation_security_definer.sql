-- Migration to fix SECURITY DEFINER vulnerability in approve_donation_request RPC
-- This changes the function to SECURITY INVOKER (the default) to respect RLS policies.

CREATE OR REPLACE FUNCTION public.approve_donation_request(
  p_donation_request_id uuid
)
RETURNS public.donations
LANGUAGE plpgsql
-- SECURITY DEFINER removed, defaults to SECURITY INVOKER
AS $$
DECLARE
  v_req public.donation_requests;
  v_donation public.donations;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Admin check is still required, but now RLS is also enforced.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can approve donation requests' USING ERRCODE = '42501';
  END IF;

  -- Load request with lock to avoid double-approval
  SELECT * INTO v_req
  FROM public.donation_requests
  WHERE donation_request_id = p_donation_request_id
  FOR UPDATE;

  IF v_req.donation_request_id IS NULL THEN
    RAISE EXCEPTION 'Donation request not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status <> 'Pending'::public.enum_request_status THEN
    RAISE EXCEPTION 'Donation request is not pending (current status: %)', v_req.status USING ERRCODE = 'P0002';
  END IF;

  -- Create donation row (human IDs populated by trigger)
  INSERT INTO public.donations (
    donor_id,
    amount,
    currency,
    category_id,
    project_id,
    mode_of_payment,
    donation_type,
    donation_date,
    created_by,
    approved_by,
    approved_at
  ) VALUES (
    v_req.donor_id,
    v_req.amount,
    v_req.currency,
    v_req.category_id,
    v_req.project_id,
    v_req.mode_of_payment,
    v_req.donation_type,
    v_req.donation_date,
    v_actor, -- created_by = approving admin
    v_actor,
    now()
  ) RETURNING * INTO v_donation;

  -- Update the request status to Approved
  UPDATE public.donation_requests
  SET status = 'Approved'::public.enum_request_status,
      approved_by = v_actor,
      approved_at = now(),
      rejection_reason = NULL
  WHERE donation_request_id = v_req.donation_request_id;

  RETURN v_donation;
END;
$$;

COMMENT ON FUNCTION public.approve_donation_request(uuid) IS 'Admin-only. Approves a pending donation request, creates a corresponding donation record, and updates the request status. Runs as SECURITY INVOKER, respecting RLS.';
