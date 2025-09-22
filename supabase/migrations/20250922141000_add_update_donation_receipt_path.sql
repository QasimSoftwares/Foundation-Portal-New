-- This migration adds a function to update the receipt path for a donation
-- It uses SECURITY DEFINER to bypass RLS on the donations table

CREATE OR REPLACE FUNCTION public.update_donation_receipt_path(
  p_donation_id uuid,
  p_receipt_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function is for admin use only
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can update receipt paths';
  END IF;

  -- Update the donation record with the new receipt path
  UPDATE public.donations
  SET receipt_pdf_path = p_receipt_path,
      updated_at = now()
  WHERE donation_id = p_donation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation not found' USING ERRCODE 'P0002';
  END IF;
END;
$$;

-- Grant execute permission to authenticated users (will be checked by is_admin())
GRANT EXECUTE ON FUNCTION public.update_donation_receipt_path(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.update_donation_receipt_path(uuid, text) IS 
'Updates the receipt_pdf_path for a donation. Admin-only. SECURITY DEFINER.';

RAISE NOTICE 'Successfully created update_donation_receipt_path(uuid, text) function.';
