-- Migration: Add Storage Policies for Receipts
-- This migration sets up RLS policies for the receipts bucket

-- 1. Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to ensure clean state
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Admins have full access to receipts" ON storage.objects;
  DROP POLICY IF EXISTS "Donors can view their own receipts" ON storage.objects;
  
  RAISE NOTICE 'Dropped existing storage policies';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error dropping policies: %', SQLERRM;
END $$;

-- 3. Create a function to check if a user can access a receipt
CREATE OR REPLACE FUNCTION public.can_access_receipt_file(p_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_donation_id uuid;
  v_has_access boolean;
BEGIN
  -- Extract donation_id from path (format: 'donations/<donation_id>.pdf')
  BEGIN
    v_donation_id := split_part(split_part(p_path, '/', 2), '.', 1)::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false; -- Invalid path format
  END;
  
  -- Check if user is admin
  IF public.is_admin() THEN
    RETURN true;
  END IF;
  
  -- Check if user is the donor for this receipt
  SELECT EXISTS (
    SELECT 1
    FROM public.donations d
    JOIN public.donors dr ON d.donor_id = dr.donor_id
    WHERE d.donation_id = v_donation_id
    AND dr.user_id = auth.uid()
  ) INTO v_has_access;
  
  RETURN COALESCE(v_has_access, false);
END;
$$;

-- 4. Create policy for admin access
CREATE POLICY "Admins have full access to receipts"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'receipts' AND
  (
    -- Allow all operations for admins
    public.is_admin()
  )
);

-- 5. Create policy for donor access
CREATE POLICY "Donors can view their own receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND
  (
    -- Allow viewing if the user is the donor
    public.can_access_receipt_file(name)
  )
);

-- 6. Create policy for service role (for server-side operations)
CREATE POLICY "Service role has full access"
ON storage.objects
FOR ALL
TO service_role
USING (true);

-- 7. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.can_access_receipt_file(text) TO authenticated;

-- 8. Update the bucket configuration to enforce these policies
UPDATE storage.buckets
SET public = false, file_size_limit = 10485760 -- 10MB limit
WHERE name = 'receipts';

-- 9. Create a function to get a secure download URL
CREATE OR REPLACE FUNCTION public.get_secure_receipt_url(p_donation_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_path text;
  v_url text;
BEGIN
  -- Verify the user has access to this receipt
  IF NOT public.can_access_receipt(p_donation_id) THEN
    RAISE EXCEPTION 'Access denied to this receipt';
  END IF;
  
  -- Set the path
  v_path := 'donations/' || p_donation_id::text || '.pdf';
  
  -- Generate a signed URL (valid for 1 hour)
  SELECT storage.get_presigned_url('receipts', v_path, INTERVAL '1 hour', 'GET')
  INTO v_url;
  
  RETURN v_url;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to generate download URL: %', SQLERRM;
END;
$$;

-- 10. Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_secure_receipt_url(uuid) TO authenticated;

-- 11. Create a function to check receipt access (for UI use)
CREATE OR REPLACE FUNCTION public.check_receipt_access(p_donation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_access boolean;
  v_receipt_exists boolean;
  v_result jsonb;
BEGIN
  -- Check if user has access
  SELECT public.can_access_receipt(p_donation_id) INTO v_has_access;
  
  -- Check if receipt exists
  SELECT EXISTS (
    SELECT 1 
    FROM storage.objects 
    WHERE bucket_id = 'receipts' 
    AND name = 'donations/' || p_donation_id::text || '.pdf'
  ) INTO v_receipt_exists;
  
  -- Return result
  v_result := jsonb_build_object(
    'has_access', v_has_access,
    'receipt_exists', v_receipt_exists,
    'donation_id', p_donation_id
  );
  
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', SQLERRM,
    'has_access', false,
    'receipt_exists', false,
    'donation_id', p_donation_id
  );
END;
$$;

-- 12. Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_receipt_access(uuid) TO authenticated;
