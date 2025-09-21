-- Migration: Add storage policies for receipts bucket
-- This migration adds the necessary storage policies to allow receipt uploads

-- 1. First, ensure we're using the correct schema
SET search_path TO storage, public, auth;

-- 2. Policy to allow authenticated users to view receipts in the donations folder
DO $$
BEGIN
  -- Drop the policy if it exists to avoid conflicts
  IF EXISTS (
    SELECT n.nspname, c.relname, p.polname
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'storage' 
    AND c.relname = 'objects' 
    AND p.polname = 'Allow view of receipts in donations folder'
  ) THEN
    DROP POLICY "Allow view of receipts in donations folder" ON storage.objects;
  END IF;
  
  -- Create the policy
  EXECUTE format('CREATE POLICY "Allow view of receipts in donations folder"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = %L AND
      (storage.foldername(name))[1] = %L
    )', 'receipts', 'donations');
    
  RAISE NOTICE 'Created view policy for receipts';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create view policy: %', SQLERRM;
END $$;

-- 3. Policy to allow admins to upload receipts to the donations folder
DO $$
BEGIN
  -- Drop the policy if it exists to avoid conflicts
  IF EXISTS (
    SELECT n.nspname, c.relname, p.polname
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'storage' 
    AND c.relname = 'objects' 
    AND p.polname = 'Allow admin uploads to donations folder'
  ) THEN
    DROP POLICY "Allow admin uploads to donations folder" ON storage.objects;
  END IF;
  
  -- Create the policy
  EXECUTE format('CREATE POLICY "Allow admin uploads to donations folder"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = %L AND
      (storage.foldername(name))[1] = %L AND
      public.is_admin()
    )', 'receipts', 'donations');
    
  RAISE NOTICE 'Created upload policy for receipts';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create upload policy: %', SQLERRM;
END $$;

-- 4. Policy to allow admins to update receipts in the donations folder
DO $$
BEGIN
  -- Drop the policy if it exists to avoid conflicts
  IF EXISTS (
    SELECT n.nspname, c.relname, p.polname
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'storage' 
    AND c.relname = 'objects' 
    AND p.polname = 'Allow admin updates to donations folder'
  ) THEN
    DROP POLICY "Allow admin updates to donations folder" ON storage.objects;
  END IF;
  
  -- Create the policy
  EXECUTE format('CREATE POLICY "Allow admin updates to donations folder"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = %L AND
      (storage.foldername(name))[1] = %L AND
      public.is_admin()
    )
    WITH CHECK (
      bucket_id = %L AND
      (storage.foldername(name))[1] = %L AND
      public.is_admin()
    )', 'receipts', 'donations', 'receipts', 'donations');
    
  RAISE NOTICE 'Created update policy for receipts';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create update policy: %', SQLERRM;
END $$;

-- 5. Policy to allow admins to delete receipts from the donations folder
DO $$
BEGIN
  -- Drop the policy if it exists to avoid conflicts
  IF EXISTS (
    SELECT n.nspname, c.relname, p.polname
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'storage' 
    AND c.relname = 'objects' 
    AND p.polname = 'Allow admin deletes from donations folder'
  ) THEN
    DROP POLICY "Allow admin deletes from donations folder" ON storage.objects;
  END IF;
  
  -- Create the policy
  EXECUTE format('CREATE POLICY "Allow admin deletes from donations folder"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = %L AND
      (storage.foldername(name))[1] = %L AND
      public.is_admin()
    )', 'receipts', 'donations');
    
  RAISE NOTICE 'Created delete policy for receipts';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create delete policy: %', SQLERRM;
END $$;

-- 6. Create a function to verify the storage policies are working
CREATE OR REPLACE FUNCTION public.test_receipts_policies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_test_file text;
  v_result jsonb;
  v_error text;
  v_is_admin boolean;
BEGIN
  -- Check if the current user is an admin
  SELECT public.is_admin() INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Admin access required',
      'timestamp', now()
    );
  END IF;
  
  -- Generate a test file name
  v_test_file := 'donations/test-' || gen_random_uuid() || '.pdf';
  
  -- Test upload
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, metadata, owner, last_accessed_at)
    VALUES ('receipts', v_test_file, 
            jsonb_build_object('test', true, 'uploaded_by', auth.uid(), 'timestamp', now()::text),
            auth.uid(),
            now())
    RETURNING 
      jsonb_build_object(
        'id', id,
        'bucket_id', bucket_id,
        'name', name,
        'path', name,
        'metadata', metadata,
        'uploaded_at', created_at
      ) INTO v_result;
      
    -- Test download
    PERFORM 1 FROM storage.objects 
    WHERE bucket_id = 'receipts' AND name = v_test_file;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Failed to verify file upload';
    END IF;
    
    -- Clean up
    DELETE FROM storage.objects 
    WHERE bucket_id = 'receipts' AND name = v_test_file;
    
    RETURN jsonb_build_object(
      'status', 'success',
      'message', 'Receipts storage policies are working correctly',
      'test_file', v_test_file,
      'result', v_result,
      'timestamp', now()
    );
    
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    
    -- Try to clean up in case of partial failure
    BEGIN
      DELETE FROM storage.objects 
      WHERE bucket_id = 'receipts' AND name = v_test_file;
    EXCEPTION WHEN OTHERS THEN
      -- Ignore cleanup errors
    END;
    
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Receipts storage test failed',
      'error', v_error,
      'test_file', v_test_file,
      'is_admin', v_is_admin,
      'user_id', auth.uid(),
      'timestamp', now()
    );
  END;
END;
$$;

-- 7. Grant execute permission to authenticated users
DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.test_receipts_policies() TO authenticated';
  RAISE NOTICE 'Granted execute permissions on test_receipts_policies';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to grant execute permissions: %', SQLERRM;
END $$;

-- 8. Add a comment to document the test function
COMMENT ON FUNCTION public.test_receipts_policies() IS 
'Tests the storage policies for the receipts bucket.

This function verifies that the storage policies are correctly configured
by performing a test upload and download of a file in the receipts bucket.

Returns:
  JSONB with the test results, including any errors encountered.
  
Example:
  SELECT * FROM public.test_receipts_policies();

Note: Only administrators can run this function.';
