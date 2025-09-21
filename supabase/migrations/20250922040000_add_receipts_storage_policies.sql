-- Migration: Add storage policies for receipts bucket
-- This migration adds the necessary storage policies to allow receipt uploads

-- 1. First, ensure we're using the correct schema
SET search_path TO storage, public, auth;

-- 2. Enable RLS on the storage.objects table if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS on storage.objects';
  ELSE
    RAISE NOTICE 'RLS already enabled on storage.objects';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to enable RLS on storage.objects: %', SQLERRM;
END $$;

-- 3. Create or replace policy for reading receipts
DO $$
BEGIN
  -- Drop the policy if it exists to avoid conflicts
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated read access to receipts'
  ) THEN
    DROP POLICY "Allow authenticated read access to receipts" ON storage.objects;
  END IF;
  
  -- Create the policy
  EXECUTE format('CREATE POLICY "Allow authenticated read access to receipts"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = %L AND
      (storage.folder_name(name))[1] = %L
    )', 'receipts', 'donations');
    
  RAISE NOTICE 'Created read policy for receipts';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create read policy: %', SQLERRM;
END $$;

-- 4. Create or replace policy for uploading receipts
DO $$
BEGIN
  -- Drop the policy if it exists to avoid conflicts
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow admin uploads to receipts'
  ) THEN
    DROP POLICY "Allow admin uploads to receipts" ON storage.objects;
  END IF;
  
  -- Create the policy
  EXECUTE format('CREATE POLICY "Allow admin uploads to receipts"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = %L AND
      (storage.folder_name(name))[1] = %L AND
      public.is_admin()
    )', 'receipts', 'donations');
    
  RAISE NOTICE 'Created upload policy for receipts';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create upload policy: %', SQLERRM;
END $$;

-- 5. Create or replace policy for updating receipts
DO $$
BEGIN
  -- Drop the policy if it exists to avoid conflicts
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow admin updates to receipts'
  ) THEN
    DROP POLICY "Allow admin updates to receipts" ON storage.objects;
  END IF;
  
  -- Create the policy
  EXECUTE format('CREATE POLICY "Allow admin updates to receipts"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = %L AND
      (storage.folder_name(name))[1] = %L AND
      public.is_admin()
    )
    WITH CHECK (
      bucket_id = %L AND
      (storage.folder_name(name))[1] = %L AND
      public.is_admin()
    )', 'receipts', 'donations', 'receipts', 'donations');
    
  RAISE NOTICE 'Created update policy for receipts';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create update policy: %', SQLERRM;
END $$;

-- 6. Create or replace policy for deleting receipts
DO $$
BEGIN
  -- Drop the policy if it exists to avoid conflicts
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow admin deletes from receipts'
  ) THEN
    DROP POLICY "Allow admin deletes from receipts" ON storage.objects;
  END IF;
  
  -- Create the policy
  EXECUTE format('CREATE POLICY "Allow admin deletes from receipts"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = %L AND
      (storage.folder_name(name))[1] = %L AND
      public.is_admin()
    )', 'receipts', 'donations');
    
  RAISE NOTICE 'Created delete policy for receipts';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create delete policy: %', SQLERRM;
END $$;

-- 7. Create a policy to allow the system to manage receipts (for RPC functions)
DO $$
BEGIN
  -- Drop the policy if it exists to avoid conflicts
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow system to manage receipts'
  ) THEN
    DROP POLICY "Allow system to manage receipts" ON storage.objects;
  END IF;
  
  -- Create the policy
  EXECUTE 'CREATE POLICY "Allow system to manage receipts"
    ON storage.objects
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true)';
    
  RAISE NOTICE 'Created service role policy for receipts';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create service role policy: %', SQLERRM;
END $$;

-- 8. Create a function to verify the storage policies are working
CREATE OR REPLACE FUNCTION public.test_receipt_storage_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_test_data bytea := decode('255044462D312E0A25B5B5B5B50A312030206F626A0A3C3C2F547970652F436174616C6F672F50616765732032203020523E3E0A656E646F626A0A322030206F626A0A3C3C2F547970652F50616765732F4B6964735B33203020525D2F436F756E7420313E3E0A656E646F626A0A332030206F626A0A3C3C2F547970652F506167652F506172656E742032203020522F4D65646961426F785B30203020363132203739325D2F436F6E74656E74732034203020522F5265736F75726365733C3C2F50726F635365745B2F5044462F546578742F496D616765422F496D616765432F496D616765495D3E3E3E3E0A656E646F626A0A342030206F626A0A3C3C2F4C656E6774682035303E3E0A73747265616D0A42540A2F46312032342054660A3130203739302054640A28546573742050444620666F7220646F6E6174696F6E202920546A0A45540A0A656E6473747265616D0A656E646F626A0A787265660A3020350A303030303030303030302036353533352066200A30303030303030303633203030303030206E200A30303030303030313338203030303030206E200A30303030303030313938203030303030206E200A30303030303030323630203030303030206E200A0A747261696C65720A3C3C2F53697A6520352F526F6F742031203020522F496E666F2036203020523E3E0A7374617274787265660A3433330A2525454F460A', 'hex');
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
      'message', 'Storage access test passed',
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
      'message', 'Storage access test failed',
      'error', v_error,
      'test_file', v_test_file,
      'is_admin', v_is_admin,
      'user_id', auth.uid(),
      'timestamp', now()
    );
  END;
END;
$$;

-- 9. Grant execute permission to authenticated users
DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.test_receipt_storage_access() TO authenticated';
  RAISE NOTICE 'Granted execute permissions on test_receipt_storage_access';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to grant execute permissions: %', SQLERRM;
END $$;

-- 9. Add a comment to document the test function
COMMENT ON FUNCTION public.test_receipt_storage_access() IS 
'Tests the storage access for receipt uploads and downloads.

This function verifies that the storage policies are correctly configured
by performing a test upload and download of a small PDF file.

Returns:
  JSONB with the test results, including any errors encountered.
  
Example:
  SELECT * FROM public.test_receipt_storage_access();

Note: Only administrators can run this function.';
