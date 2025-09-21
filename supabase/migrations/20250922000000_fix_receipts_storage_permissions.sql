-- Migration: Fix permissions for receipts storage setup
-- This migration ensures all necessary extensions and permissions are in place

-- 1. Ensure the storage extension is installed
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- 2. Create the storage schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS storage;

-- 3. Grant necessary permissions to the authenticated role
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA storage TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA storage TO authenticated;

-- 4. Create the donor_receipt_access view first since it's used by other functions
CREATE OR REPLACE VIEW public.donor_receipt_access AS
SELECT 
  d.user_id,
  d.donor_id,
  dn.donation_id,
  'donations/' || dn.donation_id::text || '.pdf' as receipt_path
FROM public.donors d
JOIN public.donations dn ON dn.donor_id = d.donor_id
WHERE d.user_id = auth.uid() OR public.is_admin();

-- 5. Create the can_access_receipt function that's used by other functions
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

-- 6. Create the admin_receipts_view that's used by the application
CREATE OR REPLACE VIEW public.admin_receipts_view AS
SELECT 
  d.donor_id,
  dn.donation_id,
  p.full_name as donor_name,
  p.email as donor_email,
  dn.amount,
  dn.currency,
  dn.donation_date,
  dn.receipt_pdf_path,
  o.metadata as receipt_metadata,
  o.created_at as receipt_created_at,
  o.updated_at as receipt_updated_at
FROM public.donations dn
JOIN public.donors d ON d.donor_id = dn.donor_id
JOIN public.profiles p ON p.user_id = d.user_id
LEFT JOIN storage.objects o ON o.bucket_id = 'receipts' 
  AND o.name = 'donations/' || dn.donation_id::text || '.pdf'
WHERE public.is_admin();

-- 7. Ensure the receipts bucket exists and has proper permissions
DO $$
BEGIN
  -- Create the bucket if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM storage.buckets 
    WHERE name = 'receipts'
  ) THEN
    PERFORM storage.create_bucket('receipts', 'private');
  END IF;
  
  -- Create the donations folder if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM storage.objects 
    WHERE bucket_id = 'receipts' 
    AND name = 'donations/'
  ) THEN
    PERFORM storage.create_folder('receipts', 'donations/');
  END IF;
  
  -- Ensure the bucket is private by default
  UPDATE storage.buckets 
  SET public = false 
  WHERE name = 'receipts';
  
  -- Grant necessary permissions on the bucket
  PERFORM storage.bucket_acl_set('receipts', 'authenticated', 'READ');
  PERFORM storage.bucket_acl_set('receipts', 'service_role', 'FULL');
  
  RAISE NOTICE 'Successfully configured receipts bucket and permissions';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error configuring storage: %', SQLERRM;
END $$;

-- 8. Update the upload_donation_receipt function to handle storage permissions
CREATE OR REPLACE FUNCTION public.upload_donation_receipt(
  p_donation_id uuid,
  p_file_data bytea
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_path text;
  v_bucket_id text := 'receipts';
  v_file_name text;
  v_result jsonb;
  v_metadata jsonb;
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
  v_file_name := p_donation_id::text || '.pdf';
  v_path := 'donations/' || v_file_name;
  
  -- Prepare metadata
  v_metadata := jsonb_build_object(
    'donation_id', p_donation_id,
    'uploaded_at', now(),
    'uploaded_by', auth.uid()
  );
  
  -- Upload the file to storage
  INSERT INTO storage.objects (bucket_id, name, metadata, owner)
  VALUES (v_bucket_id, v_path, v_metadata, auth.uid())
  ON CONFLICT (bucket_id, name) 
  DO UPDATE SET 
    metadata = v_metadata,
    updated_at = now()
  RETURNING id, bucket_id, name, path_tokens, metadata, updated_at, created_at, last_accessed_at, owner
  INTO v_result;
  
  -- Update the donation record with the receipt path
  UPDATE public.donations
  SET receipt_pdf_path = v_bucket_id || '/' || v_path
  WHERE donation_id = p_donation_id
  RETURNING jsonb_build_object(
    'donation_id', donation_id,
    'receipt_path', receipt_pdf_path,
    'storage_result', v_result
  ) INTO v_result;
  
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to upload receipt: %', SQLERRM;
END;
$$;

-- 9. Update the get_receipt_download_url function to use the storage schema
CREATE OR REPLACE FUNCTION public.get_receipt_download_url(p_donation_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_path text;
  v_url text;
  v_has_access boolean;
  v_object_id uuid;
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
  
  -- Get the object ID if it exists
  SELECT id INTO v_object_id
  FROM storage.objects
  WHERE bucket_id = 'receipts' 
  AND name = v_path;
  
  IF v_object_id IS NULL THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;
  
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

-- 10. The can_access_receipt function was already created earlier
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

-- 11. The admin_receipts_view was already created earlier
CREATE OR REPLACE VIEW public.admin_receipts_view AS
SELECT 
  d.donor_id,
  dn.donation_id,
  p.full_name as donor_name,
  p.email as donor_email,
  dn.amount,
  dn.currency,
  dn.donation_date,
  dn.receipt_pdf_path,
  o.metadata as receipt_metadata,
  o.created_at as receipt_created_at,
  o.updated_at as receipt_updated_at
FROM public.donations dn
JOIN public.donors d ON d.donor_id = dn.donor_id
JOIN public.profiles p ON p.user_id = d.user_id
LEFT JOIN storage.objects o ON o.bucket_id = 'receipts' 
  AND o.name = 'donations/' || dn.donation_id::text || '.pdf'
WHERE public.is_admin();

-- 12. Grant permissions on the functions and views
GRANT SELECT ON public.donor_receipt_access TO authenticated;
GRANT SELECT ON public.admin_receipts_view TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_receipt_download_url(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upload_donation_receipt(uuid, bytea) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_receipt(uuid) TO authenticated;

-- 13. Create a function to check if a receipt exists for a donation
CREATE OR REPLACE FUNCTION public.receipt_exists(p_donation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM storage.objects 
    WHERE bucket_id = 'receipts' 
    AND name = 'donations/' || p_donation_id::text || '.pdf'
  );
$$;

-- 14. Create a function to get receipt metadata
CREATE OR REPLACE FUNCTION public.get_receipt_metadata(p_donation_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT metadata 
  FROM storage.objects 
  WHERE bucket_id = 'receipts' 
  AND name = 'donations/' || p_donation_id::text || '.pdf';
$$;

-- 15. Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION public.receipt_exists(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_receipt_metadata(uuid) TO authenticated;

-- 16. Create a function to list all receipts for a donor
CREATE OR REPLACE FUNCTION public.get_donor_receipts(p_donor_id uuid)
RETURNS TABLE (
  donation_id uuid,
  amount numeric,
  currency text,
  donation_date timestamptz,
  receipt_path text,
  receipt_created_at timestamptz,
  receipt_updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    d.donation_id,
    d.amount,
    d.currency,
    d.donation_date,
    d.receipt_pdf_path as receipt_path,
    o.created_at as receipt_created_at,
    o.updated_at as receipt_updated_at
  FROM public.donations d
  LEFT JOIN storage.objects o ON o.bucket_id = 'receipts' 
    AND o.name = 'donations/' || d.donation_id::text || '.pdf'
  WHERE d.donor_id = p_donor_id
  AND (
    -- Either the current user is the donor
    EXISTS (
      SELECT 1 
      FROM public.donors dd 
      WHERE dd.donor_id = p_donor_id 
      AND dd.user_id = auth.uid()
    )
    -- Or the current user is an admin
    OR public.is_admin()
  )
  ORDER BY d.donation_date DESC;
$$;

-- 17. Grant execute permission on the new function
GRANT EXECUTE ON FUNCTION public.get_donor_receipts(uuid) TO authenticated;

-- 18. Create a function to delete a receipt (admin only)
CREATE OR REPLACE FUNCTION public.delete_donation_receipt(p_donation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins can delete receipts
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can delete receipts';
  END IF;
  
  -- Delete the file from storage
  DELETE FROM storage.objects 
  WHERE bucket_id = 'receipts' 
  AND name = 'donations/' || p_donation_id::text || '.pdf';
  
  -- Update the donation record
  UPDATE public.donations
  SET receipt_pdf_path = NULL
  WHERE donation_id = p_donation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation not found';
  END IF;
END;
$$;

-- 19. Grant execute permission on the delete function
GRANT EXECUTE ON FUNCTION public.delete_donation_receipt(uuid) TO authenticated;

-- 20. Create a function to update receipt metadata (admin only)
CREATE OR REPLACE FUNCTION public.update_receipt_metadata(
  p_donation_id uuid,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only admins can update receipt metadata
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can update receipt metadata';
  END IF;
  
  -- Update the metadata
  UPDATE storage.objects 
  SET metadata = COALESCE(metadata, '{}'::jsonb) || p_metadata,
      updated_at = now()
  WHERE bucket_id = 'receipts' 
  AND name = 'donations/' || p_donation_id::text || '.pdf'
  RETURNING metadata INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;
  
  RETURN v_result;
END;
$$;

-- 21. Grant execute permission on the update metadata function
GRANT EXECUTE ON FUNCTION public.update_receipt_metadata(uuid, jsonb) TO authenticated;

-- 22. Create a function to generate a receipt (placeholder for actual implementation)
CREATE OR REPLACE FUNCTION public.generate_receipt_pdf(p_donation_id uuid)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_donation RECORD;
  v_donor RECORD;
  v_pdf_data bytea;
BEGIN
  -- Only admins can generate receipts
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can generate receipts';
  END IF;
  
  -- Get donation details
  SELECT * INTO v_donation
  FROM public.donations
  WHERE donation_id = p_donation_id;
  
  IF v_donation IS NULL THEN
    RAISE EXCEPTION 'Donation not found';
  END IF;
  
  -- Get donor details
  SELECT p.full_name, p.email, p.phone_number
  INTO v_donor
  FROM public.donors d
  JOIN public.profiles p ON p.user_id = d.user_id
  WHERE d.donor_id = v_donation.donor_id;
  
  -- TODO: Replace this with actual PDF generation logic
  -- For now, return a simple PDF with the donation details
  v_pdf_data := convert_to(
    'Receipt for Donation #' || v_donation.donation_id || E'\n\n' ||
    'Donor: ' || COALESCE(v_donor.full_name, 'N/A') || E'\n' ||
    'Amount: ' || v_donation.amount || ' ' || v_donation.currency || E'\n' ||
    'Date: ' || v_donation.donation_date::date || E'\n' ||
    'Status: ' || v_donation.status || E'\n\n' ||
    'Thank you for your donation!',
    'UTF-8'
  );
  
  RETURN v_pdf_data;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to generate receipt: %', SQLERRM;
END;
$$;

-- 23. Grant execute permission on the generate receipt function
GRANT EXECUTE ON FUNCTION public.generate_receipt_pdf(uuid) TO authenticated;
