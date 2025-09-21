-- Add transaction_id column to donation_requests table
ALTER TABLE public.donation_requests 
ADD COLUMN IF NOT EXISTS transaction_id text;

-- Update the create_donation_request function to accept transaction_id
CREATE OR REPLACE FUNCTION public.create_donation_request(
  p_donor_number text,
  p_amount numeric,
  p_currency public.enum_donation_currency,
  p_category_name text,
  p_project_name text,
  p_mode_of_payment public.enum_payment_mode,
  p_donation_type public.enum_donation_type,
  p_donation_date date,
  p_transaction_id text DEFAULT NULL
)
RETURNS public.donation_requests
LANGUAGE plpgsql
AS $$
DECLARE
  v_req public.donation_requests;
  v_current_user uuid := auth.uid();
  v_donor_id uuid;
  v_category_id uuid;
  v_project_id uuid;
BEGIN
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Admins only can create donation requests
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create donation requests' USING ERRCODE = '42501';
  END IF;

  -- Look up donor_id from donor_number
  SELECT donor_id INTO v_donor_id
  FROM public.donors
  WHERE donor_number = p_donor_number
  LIMIT 1;

  IF v_donor_id IS NULL THEN
    RAISE EXCEPTION 'Donor not found' USING ERRCODE = 'P0002';
  END IF;

  -- Look up category_id from category_name
  SELECT donation_category_id INTO v_category_id
  FROM public.donation_categories
  WHERE donation_category_name = p_category_name
    AND is_active = true
  LIMIT 1;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Category not found or inactive' USING ERRCODE = 'P0002';
  END IF;

  -- Look up project_id from project_name
  SELECT project_id INTO v_project_id
  FROM public.projects
  WHERE project_name = p_project_name
    AND is_active = true
    AND donation_category_id = v_category_id
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Project not found or inactive' USING ERRCODE = 'P0002';
  END IF;

  -- Insert the donation request with transaction_id
  INSERT INTO public.donation_requests (
    donor_id, amount, currency, category_id, project_id,
    mode_of_payment, donation_type, donation_date, transaction_id,
    status, created_by
  ) VALUES (
    v_donor_id, p_amount, p_currency, v_category_id, v_project_id,
    p_mode_of_payment, p_donation_type, p_donation_date, p_transaction_id,
    'Pending', v_current_user
  )
  RETURNING * INTO v_req;

  RETURN v_req;
END;
$$;

-- Update the approve_donation_request function to copy transaction_id to donations table
CREATE OR REPLACE FUNCTION public.approve_donation_request(
  p_donation_request_id uuid
)
RETURNS public.donations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req public.donation_requests;
  v_donation public.donations;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  -- Admin check (relies on existing public.is_admin())
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can approve donation requests' USING ERRCODE = '42501';
  END IF;

  RAISE NOTICE 'approve_donation_request: Starting approval for ID %', p_donation_request_id;

  -- Load request with lock to avoid double-approval
  SELECT * INTO v_req
  FROM public.donation_requests
  WHERE donation_request_id = p_donation_request_id
  FOR UPDATE;

  RAISE NOTICE 'approve_donation_request: Request loaded, status: %', v_req.status;

  IF v_req.donation_request_id IS NULL THEN
    RAISE EXCEPTION 'Donation request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.status <> 'Pending'::public.enum_request_status THEN
    RAISE EXCEPTION 'Donation request is not pending (current status: %)', v_req.status USING ERRCODE = 'P0002';
  END IF;

  RAISE NOTICE 'approve_donation_request: Creating donation record';

  -- Create donation row (human IDs populated by trigger)
  BEGIN
    INSERT INTO public.donations (
      donor_id,
      amount,
      currency,
      category_id,
      project_id,
      mode_of_payment,
      donation_type,
      donation_date,
      transaction_id,
      receipt_id,
      receipt_pdf_path,
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
      v_req.transaction_id,  -- Copy transaction_id from the request
      NULL,                 -- receipt_id (will be set by trigger if null)
      NULL,                 -- receipt_pdf_path (optional, may be set later)
      v_actor,              -- created_by = approving admin creating the donation record
      v_actor,
      now()
    ) RETURNING * INTO v_donation;
  EXCEPTION
    WHEN others THEN
      RAISE WARNING 'approve_donation_request: INSERT into donations failed. SQLSTATE: %, SQLERRM: %', SQLSTATE, SQLERRM;
      RAISE;
  END;

  RAISE NOTICE 'approve_donation_request: Donation created, updating request status';

  -- Update the request status to Approved
  UPDATE public.donation_requests
  SET status = 'Approved'::public.enum_request_status,
      approved_by = v_actor,
      approved_at = now(),
      rejection_reason = NULL
  WHERE donation_request_id = v_req.donation_request_id;

  RAISE NOTICE 'approve_donation_request: Approval completed';

  RETURN v_donation;
END;
$$;

-- Update the get_donation_requests view to include transaction_id
CREATE OR REPLACE VIEW public.donation_requests_view AS
SELECT
  dr.donation_request_id,
  d.donor_number,
  COALESCE(pr.full_name, '') AS donor_name,
  pr.email AS donor_email,
  pr.phone_number AS donor_phone,
  dr.amount,
  dr.currency,
  dc.donation_category_name AS category_name,
  p.project_name,
  dr.mode_of_payment,
  dr.donation_type,
  dr.donation_date,
  dr.transaction_id,
  dr.status,
  dr.created_at,
  dr.approved_at,
  dr.rejection_reason,
  creator.email AS created_by_email,
  approver.email AS approved_by_email
FROM
  public.donation_requests dr
  JOIN public.donors d ON dr.donor_id = d.donor_id
  JOIN public.profiles pr ON d.user_id = pr.user_id
  JOIN public.donation_categories dc ON dr.category_id = dc.donation_category_id
  JOIN public.projects p ON dr.project_id = p.project_id
  JOIN auth.users creator ON dr.created_by = creator.id
  LEFT JOIN auth.users approver ON dr.approved_by = approver.id;

-- Grant permissions
GRANT SELECT ON public.donation_requests_view TO authenticated;
