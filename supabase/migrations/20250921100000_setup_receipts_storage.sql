-- Migration: Setup Supabase Storage bucket with secure access patterns for donation receipts
-- This migration creates helper functions and views to securely manage access to receipts
-- without requiring direct storage.objects policies

-- 1) Create a secure view to map users to their donation files
-- This view enforces access control at the application level
CREATE OR REPLACE VIEW public.donor_receipt_access AS
SELECT 
  d.user_id,
  d.donor_id,
  dn.donation_id,
  'donations/' || dn.donation_id::text || '.pdf' as receipt_path
FROM public.donors d
JOIN public.donations dn ON dn.donor_id = d.donor_id
WHERE d.user_id = auth.uid() OR public.is_admin();

-- 2) Create a function to generate signed URLs for receipts
-- This function enforces access control through the donor_receipt_access view
CREATE OR REPLACE FUNCTION public.get_receipt_download_url(p_donation_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_path text;
  v_url text;
  v_has_access boolean;
BEGIN
  -- Check if the current user has access to this donation receipt
  SELECT EXISTS (
    SELECT 1 
    FROM public.donor_receipt_access 
    WHERE donation_id = p_donation_id
    AND (user_id = auth.uid() OR public.is_admin())
  ) INTO v_has_access;
  
  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied to this receipt';
  END IF;
  
  -- Get the path to the receipt
  v_path := 'donations/' || p_donation_id::text || '.pdf';
  
  -- Generate a signed URL that's valid for 1 hour
  SELECT storage.get_presigned_url(
    'receipts', 
    v_path, 
    INTERVAL '1 hour',
    'GET'
  ) INTO v_url;
  
  RETURN v_url;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to generate download URL: %', SQLERRM;
END;
$$;

-- 3) Create a function for admins to upload receipts
CREATE OR REPLACE FUNCTION public.upload_donation_receipt(
  p_donation_id uuid,
  p_file_data bytea
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_path text;
  v_bucket_id text := 'receipts';
BEGIN
  -- Only admins can upload receipts
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can upload receipts';
  END IF;
  
  -- Verify the donation exists
  PERFORM 1 FROM public.donations WHERE donation_id = p_donation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation not found';
  END IF;
  
  -- Set the path for the receipt
  v_path := 'donations/' || p_donation_id::text || '.pdf';
  
  -- Upload the file to storage using storage.upload()
  PERFORM storage.upload(
    v_bucket_id,
    v_path,
    p_file_data,
    'application/pdf',
    jsonb_build_object('donation_id', p_donation_id)
  );
  
  -- Update the donation record with the receipt path
  UPDATE public.donations
  SET receipt_pdf_path = v_bucket_id || '/' || v_path
  WHERE donation_id = p_donation_id;
  
  RAISE NOTICE 'Receipt uploaded for donation %', p_donation_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to upload receipt: %', SQLERRM;
END;
$$;

-- 4) Create a function to check if a user can access a receipt
CREATE OR REPLACE FUNCTION public.can_access_receipt(p_donation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.donor_receipt_access 
    WHERE donation_id = p_donation_id
    AND (user_id = auth.uid() OR public.is_admin())
  );
$$;

-- 5) Create a view for admins to see all receipts
CREATE OR REPLACE VIEW public.admin_receipts_view AS
SELECT 
  d.donor_id,
  dn.donation_id,
  p.full_name as donor_name,
  dn.amount,
  dn.currency,
  dn.donation_date,
  'receipts/donations/' || dn.donation_id::text || '.pdf' as receipt_path,
  dn.receipt_pdf_path
FROM public.donations dn
JOIN public.donors d ON d.donor_id = dn.donor_id
JOIN public.profiles p ON p.user_id = d.user_id
WHERE public.is_admin();

-- 6) Grant permissions
GRANT SELECT ON public.donor_receipt_access TO authenticated;
GRANT SELECT ON public.admin_receipts_view TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_receipt_download_url(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upload_donation_receipt(uuid, bytea) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_receipt(uuid) TO authenticated;

-- 7) Create the donations folder structure if it doesn't exist
-- This is a no-op if it already exists
DO $$
BEGIN
  PERFORM storage.create_folder('receipts', 'donations/');
  RAISE NOTICE 'Created donations/ folder in receipts bucket';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create donations/ folder (may already exist): %', SQLERRM;
END;
$$;
