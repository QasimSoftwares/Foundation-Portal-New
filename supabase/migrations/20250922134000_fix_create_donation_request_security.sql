-- This migration fixes the create_donation_request RPC by changing it to SECURITY DEFINER.
-- This allows it to bypass RLS on the underlying tables and correctly create the request.

-- Drop the existing function to ensure a clean update.
DROP FUNCTION IF EXISTS public.create_donation_request(text, numeric, public.enum_donation_currency, text, text, public.enum_payment_mode, public.enum_donation_type, date, text);

-- Recreate the function with SECURITY DEFINER.
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
-- Use SECURITY DEFINER to bypass RLS on the underlying tables.
-- Authorization is handled internally by the is_admin() check.
SECURITY DEFINER
SET search_path = public
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

-- Grant execute permission.
GRANT EXECUTE ON FUNCTION public.create_donation_request(text, numeric, public.enum_donation_currency, text, text, public.enum_payment_mode, public.enum_donation_type, date, text) TO authenticated;

COMMENT ON FUNCTION public.create_donation_request(text, numeric, public.enum_donation_currency, text, text, public.enum_payment_mode, public.enum_donation_type, date, text) IS 'Creates a new donation request. Admin-only. SECURITY DEFINER.';

RAISE NOTICE 'Successfully fixed and recreated the create_donation_request() function.';
