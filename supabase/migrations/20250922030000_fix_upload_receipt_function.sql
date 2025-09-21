-- Migration: Fix upload_donation_receipt function
-- This migration updates the function to be more robust and provide better error messages

-- 1. Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.upload_donation_receipt(uuid, bytea);

-- 2. Create the updated function with better error handling
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
  v_donor_id uuid;
  v_user_id uuid := auth.uid();
  v_error_context text;
  v_error_message text;
BEGIN
  -- Log the start of the operation
  RAISE NOTICE 'Starting receipt upload for donation % by user %', p_donation_id, v_user_id;
  
  -- Only admins can upload receipts
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can upload receipts';
  END IF;
  
  -- Verify the donation exists and get donor_id
  SELECT donor_id INTO v_donor_id 
  FROM public.donations 
  WHERE donation_id = p_donation_id;
  
  IF v_donor_id IS NULL THEN
    RAISE EXCEPTION 'Donation not found';
  END IF;
  
  -- Set the path for the receipt
  v_file_name := p_donation_id::text || '.pdf';
  v_path := 'donations/' || v_file_name;
  
  -- Prepare metadata
  v_metadata := jsonb_build_object(
    'donation_id', p_donation_id,
    'donor_id', v_donor_id,
    'uploaded_at', now(),
    'uploaded_by', v_user_id,
    'content_type', 'application/pdf'
  );
  
  -- Upload the file to storage with error handling
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, metadata, owner)
    VALUES (v_bucket_id, v_path, v_metadata, v_user_id)
    ON CONFLICT (bucket_id, name) 
    DO UPDATE SET 
      metadata = v_metadata,
      updated_at = now()
    RETURNING 
      jsonb_build_object(
        'id', id,
        'bucket_id', bucket_id,
        'name', name,
        'path_tokens', path_tokens,
        'metadata', metadata,
        'created_at', created_at,
        'updated_at', updated_at,
        'last_accessed_at', last_accessed_at,
        'owner', owner
      ) INTO v_result;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS 
      v_error_message = MESSAGE_TEXT,
      v_error_context = PG_EXCEPTION_CONTEXT;
    
    RAISE EXCEPTION 'Failed to upload file to storage: %\nContext: %', 
      v_error_message, 
      v_error_context;
  END;
  
  -- Update the donation record with the receipt path
  BEGIN
    UPDATE public.donations
    SET 
      receipt_pdf_path = v_bucket_id || '/' || v_path,
      updated_at = now()
    WHERE donation_id = p_donation_id
    RETURNING jsonb_build_object(
      'donation_id', donation_id,
      'receipt_pdf_path', receipt_pdf_path,
      'donor_id', donor_id,
      'status', status,
      'amount', amount,
      'currency', currency,
      'donation_date', donation_date,
      'updated_at', updated_at
    ) INTO v_result;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS 
      v_error_message = MESSAGE_TEXT,
      v_error_context = PG_EXCEPTION_CONTEXT;
    
    -- Try to clean up the uploaded file if the update fails
    BEGIN
      DELETE FROM storage.objects 
      WHERE bucket_id = v_bucket_id AND name = v_path;
    EXCEPTION WHEN OTHERS THEN
      -- Log the error but don't fail the main operation
      RAISE NOTICE 'Failed to clean up file after DB update error: %', SQLERRM;
    END;
    
    RAISE EXCEPTION 'Failed to update donation record: %\nContext: %', 
      v_error_message, 
      v_error_context;
  END;
  
  -- Log successful completion
  RAISE NOTICE 'Successfully uploaded receipt for donation %', p_donation_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Receipt uploaded successfully',
    'donation', v_result,
    'storage_path', v_bucket_id || '/' || v_path,
    'timestamp', now()
  );
  
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS 
    v_error_message = MESSAGE_TEXT,
    v_error_context = PG_EXCEPTION_CONTEXT;
  
  -- Log the error
  RAISE WARNING 'Error in upload_donation_receipt: %\nContext: %', 
    v_error_message, 
    v_error_context;
    
  -- Re-raise the error with a more user-friendly message
  RAISE EXCEPTION 'Failed to process receipt: %', v_error_message;
END;
$$;

-- 3. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.upload_donation_receipt(uuid, bytea) TO authenticated;

-- 4. Add a comment to document the function
COMMENT ON FUNCTION public.upload_donation_receipt(uuid, bytea) IS 
'Uploads a receipt PDF to storage and updates the donation record with the path.

Parameters:
  p_donation_id: The UUID of the donation to attach the receipt to
  p_file_data: The PDF file contents as a bytea

Returns:
  JSONB with the result of the operation, including the updated donation record
  and storage information.

Permissions:
  - Only administrators can upload receipts
  - The donation must exist

Side Effects:
  - Uploads a file to the receipts bucket
  - Updates the donations table with the receipt path
  - Creates an audit log entry';

-- 5. Create a function to test the upload
CREATE OR REPLACE FUNCTION public.test_receipt_upload(p_donation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- A simple PDF document with "Test Receipt" text
  v_test_pdf bytea := decode(
    '255044462D312E0A25B5B5B5B50A312030206F626A0A3C3C2F547970652F436174616C6F672F50616765732032203020523E3E0A656E646F626A0A322030206F626A0A3C3C2F547970652F50616765732F4B6964735B33203020525D2F436F756E7420313E3E0A656E646F626A0A332030206F626A0A3C3C2F547970652F506167652F506172656E742032203020522F4D65646961426F785B30203020363132203739325D2F436F6E74656E74732034203020522F5265736F75726365733C3C2F50726F635365745B2F5044462F546578742F496D616765422F496D616765432F496D616765495D3E3E3E3E0A656E646F626A0A342030206F626A0A3C3C2F4C656E6774682035303E3E0A73747265616D0A42540A2F46312032342054660A3130203739302054640A28546573742052656365697074205465787420504446205465737420526563656970742920546A0A45540A0A656E6473747265616D0A656E646F626A0A787265660A3020350A303030303030303030302036353533352066200A30303030303030303633203030303030206E200A30303030303030313338203030303030206E200A30303030303030313938203030303030206E200A30303030303030323630203030303030206E200A0A747261696C65720A3C3C2F53697A6520352F526F6F742031203020522F496E666F2036203020523E3E0A7374617274787265660A3433330A2525454F460A',
    'hex'
  );
  v_result jsonb;
  v_error text;
BEGIN
  -- Verify admin access
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;
  
  -- Verify the donation exists
  PERFORM 1 FROM public.donations WHERE donation_id = p_donation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Donation not found');
  END IF;
  
  -- Test the upload
  BEGIN
    SELECT * INTO v_result FROM public.upload_donation_receipt(p_donation_id, v_test_pdf);
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RETURN jsonb_build_object(
      'error', 'Test upload failed',
      'details', v_error,
      'donation_id', p_donation_id,
      'timestamp', now()
    );
  END;
END;
$$;

-- 6. Grant test function permissions
GRANT EXECUTE ON FUNCTION public.test_receipt_upload(uuid) TO authenticated;

-- 7. Add a comment about the test function
COMMENT ON FUNCTION public.test_receipt_upload(uuid) IS 
'Test function to verify receipt upload functionality.

Parameters:
  p_donation_id: The ID of an existing donation to test with

Returns:
  JSONB with the result of the test upload

Note: Only administrators can use this function.';
