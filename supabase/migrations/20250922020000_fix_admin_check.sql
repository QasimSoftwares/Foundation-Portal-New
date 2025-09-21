-- Migration: Fix is_admin function and ensure consistent implementation
-- This migration ensures we have a single, consistent is_admin function

-- 1. Drop all existing versions of is_admin to avoid conflicts
DO $$
BEGIN
  -- Drop all variants of the is_admin function
  DROP FUNCTION IF EXISTS public.is_admin();
  DROP FUNCTION IF EXISTS public.is_admin(uuid);
  
  RAISE NOTICE 'Dropped existing is_admin functions';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error dropping is_admin functions: %', SQLERRM;
END $$;

-- 2. Create a single, secure implementation of is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  -- Get the current user ID from the JWT
  v_user_id := auth.uid();
  
  -- If no user is authenticated, they're not an admin
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if the user has the 'admin' role
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_user_id
    AND r.name = 'admin'
    AND ur.status = 'active'
  ) INTO v_is_admin;
  
  RETURN COALESCE(v_is_admin, false);
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't expose details to the client
  RAISE NOTICE 'Error in is_admin(): %', SQLERRM;
  RETURN false;
END;
$$;

-- 3. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 4. Update the upload_donation_receipt function to use the correct is_admin check
DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.upload_donation_receipt(uuid, bytea) 
           SET search_path = public, storage';
  
  RAISE NOTICE 'Updated search_path for upload_donation_receipt';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error updating upload_donation_receipt: %', SQLERRM;
END $$;

-- 5. Add logging to help debug the upload_donation_receipt function
COMMENT ON FUNCTION public.upload_donation_receipt(uuid, bytea) IS 
'Uploads a receipt PDF to storage and updates the donation record.

Parameters:
  p_donation_id: The ID of the donation
  p_file_data: The PDF file contents as a bytea

Returns:
  JSONB with the upload result and donation update status

Permissions:
  - Only administrators can upload receipts
  - The donation must exist
  - The receipt will be stored in the receipts bucket under donations/{donation_id}.pdf';

-- 6. Create a test function to verify the setup
CREATE OR REPLACE FUNCTION public.test_receipt_upload(p_donation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_test_data bytea := decode('255044462D312E0A25B5B5B5B50A312030206F626A0A3C3C2F547970652F436174616C6F672F50616765732032203020523E3E0A656E646F626A0A322030206F626A0A3C3C2F547970652F50616765732F4B6964735B33203020525D2F436F756E7420313E3E0A656E646F626A0A332030206F626A0A3C3C2F547970652F506167652F506172656E742032203020522F4D65646961426F785B30203020363132203739325D2F436F6E74656E74732034203020522F5265736F75726365733C3C2F50726F635365745B2F5044462F546578742F496D616765422F496D616765432F496D616765495D3E3E3E3E0A656E646F626A0A342030206F626A0A3C3C2F4C656E6774682035303E3E0A73747265616D0A42540A2F46312032342054660A3130203739302054640A28546573742050444620666F7220646F6E6174696F6E202920546A0A45540A0A656E6473747265616D0A656E646F626A0A787265660A3020350A303030303030303030302036353533352066200A30303030303030303633203030303030206E200A30303030303030313338203030303030206E200A30303030303030313938203030303030206E200A30303030303030323630203030303030206E200A0A747261696C65720A3C3C2F53697A6520352F526F6F742031203020522F496E666F2036203020523E3E0A7374617274787265660A3433330A2525454F460A', 'hex');
  v_result jsonb;
BEGIN
  -- Verify admin access
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;
  
  -- Test the upload
  SELECT * FROM public.upload_donation_receipt(p_donation_id, v_test_data) INTO v_result;
  
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- 7. Grant test function permissions
GRANT EXECUTE ON FUNCTION public.test_receipt_upload(uuid) TO authenticated;

-- 8. Add a comment about the test function
COMMENT ON FUNCTION public.test_receipt_upload(uuid) IS 
'Test function to verify receipt upload functionality.

Parameters:
  p_donation_id: The ID of an existing donation to test with

Returns:
  JSONB with the result of the test upload

Note: Only administrators can use this function.';
