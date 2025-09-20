-- Add approved_by and approved_at columns if they don't exist
ALTER TABLE public.role_requests
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS handle_role_request(UUID, TEXT, TEXT);

-- Recreate the function with proper approval tracking
CREATE OR REPLACE FUNCTION handle_role_request(
  p_request_id UUID, 
  p_action TEXT, 
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_current_status TEXT;
  v_admin_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_error_context TEXT;
  v_error_detail TEXT;
  v_error_hint TEXT;
  v_error_message TEXT;
  v_result JSONB;
  v_donor_result JSONB;
  v_in_transaction BOOLEAN;
BEGIN
  -- Log function entry
  RAISE LOG 'handle_role_request: Starting for request_id=%, action=%, role=%', p_request_id, p_action, p_role;
  
  -- Ensure the user is an admin
  IF NOT public.is_admin() THEN
    RAISE LOG 'handle_role_request: User % is not an admin', v_admin_id;
    RETURN jsonb_build_object('status', 'error', 'message', 'User is not authorized to perform this action.');
  END IF;
  
  RAISE LOG 'handle_role_request: User % is an admin', v_admin_id;

  -- Check if we're already in a transaction
  v_in_transaction := (SELECT txid_current() IS NOT NULL);
  
  -- Start a transaction only if we're not already in one
  IF NOT v_in_transaction THEN
    RAISE LOG 'handle_role_request: Starting new transaction';
  END IF;
  
  -- Get the user_id and current status of the request with FOR UPDATE to lock the row
  RAISE LOG 'handle_role_request: Fetching request details for request_id=%', p_request_id;
  SELECT user_id, request_status INTO v_user_id, v_current_status
  FROM public.role_requests
  WHERE request_id = p_request_id
  FOR UPDATE;

    -- Check if the request exists and is pending
    IF NOT FOUND THEN
      RAISE LOG 'handle_role_request: Request not found for request_id=%', p_request_id;
      RETURN jsonb_build_object('status', 'error', 'message', 'Request not found.');
    END IF;
    
    RAISE LOG 'handle_role_request: Found request for user_id=%, status=%', v_user_id, v_current_status;

    IF v_current_status <> 'pending' THEN
      RAISE LOG 'handle_role_request: Request % already processed with status=%', p_request_id, v_current_status;
      RETURN jsonb_build_object('status', 'error', 'message', 'This request has already been processed.');
    END IF;

    -- Handle the approval or rejection
    IF p_action = 'approve' THEN
      RAISE LOG 'handle_role_request: Processing approval for role=%', p_role;
      
      -- Update the request status with approval details
      UPDATE public.role_requests
      SET 
        request_status = 'approved',
        approved_by = v_admin_id,
        approved_at = v_now,
        updated_at = v_now
      WHERE request_id = p_request_id;
      
      RAISE LOG 'handle_role_request: Updated role_requests table for request_id=%', p_request_id;

      -- Handle role-specific actions
      IF p_role = 'donor' THEN
        BEGIN
          -- Check if user already has donor role
          RAISE LOG 'handle_role_request: Checking if user % already has donor role', v_user_id;
          PERFORM 1 FROM public.user_roles WHERE user_id = v_user_id AND is_donor = TRUE;
          
          IF NOT FOUND THEN
            RAISE LOG 'handle_role_request: Calling create_donor for user_id=%', v_user_id;
            -- Call the create_donor RPC and capture its result
            SELECT * INTO v_donor_result FROM create_donor(v_user_id);
            
            -- Check if create_donor was successful
            IF v_donor_result->>'status' != 'success' THEN
              RAISE EXCEPTION 'create_donor failed: %', v_donor_result->>'message';
            END IF;
            
            RAISE LOG 'handle_role_request: create_donor result: %', v_donor_result;
          ELSE
            RAISE LOG 'handle_role_request: User % already has donor role', v_user_id;
          END IF;
          
        EXCEPTION WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS 
            v_error_message = MESSAGE_TEXT,
            v_error_detail = PG_EXCEPTION_DETAIL,
            v_error_hint = PG_EXCEPTION_HINT,
            v_error_context = PG_EXCEPTION_CONTEXT;
            
          RAISE LOG 'handle_role_request: Error in donor processing: %', v_error_message;
          RAISE LOG 'handle_role_request: Error detail: %', v_error_detail;
          RAISE LOG 'handle_role_request: Error hint: %', v_error_hint;
          RAISE LOG 'handle_role_request: Error context: %', v_error_context;
          
          -- Re-raise the exception to be caught by the outer exception handler
          RAISE EXCEPTION 'Error processing donor role: %', v_error_message;
        END;
        
      ELSIF p_role = 'volunteer' THEN
        RAISE LOG 'handle_role_request: Setting is_volunteer=TRUE for user_id=%', v_user_id;
        UPDATE public.user_roles 
        SET is_volunteer = TRUE 
        WHERE user_id = v_user_id;
        
      ELSIF p_role = 'member' THEN
        RAISE LOG 'handle_role_request: Setting is_member=TRUE for user_id=%', v_user_id;
        UPDATE public.user_roles 
        SET is_member = TRUE 
        WHERE user_id = v_user_id;
        
      ELSE
        RAISE LOG 'handle_role_request: Invalid role specified: %', p_role;
        ROLLBACK;
        RETURN jsonb_build_object('status', 'error', 'message', 'Invalid role specified.');
      END IF;

      -- Commit the transaction if we started it
      IF NOT v_in_transaction THEN
        RAISE LOG 'handle_role_request: Committing transaction for request %', p_request_id;
        COMMIT;
      END IF;
      
      RAISE LOG 'handle_role_request: Successfully processed request %', p_request_id;
      RETURN jsonb_build_object('status', 'success', 'message', 'Request approved successfully.');

    ELSIF p_action = 'reject' THEN
      RAISE LOG 'handle_role_request: Rejecting request %', p_request_id;
      
      -- Update the request status for rejection
      UPDATE public.role_requests
      SET 
        request_status = 'rejected',
        approved_by = v_admin_id,
        approved_at = v_now,
        updated_at = v_now
      WHERE request_id = p_request_id;
      
      -- Commit the transaction if we started it
      IF NOT v_in_transaction THEN
        RAISE LOG 'handle_role_request: Committing transaction for rejected request %', p_request_id;
        COMMIT;
      END IF;
      
      RAISE LOG 'handle_role_request: Successfully rejected request %', p_request_id;
      RETURN jsonb_build_object('status', 'success', 'message', 'Request rejected successfully.');
      
    ELSE
      RAISE LOG 'handle_role_request: Invalid action specified: %', p_action;
      -- Rollback if we started the transaction
    IF NOT v_in_transaction THEN
      RAISE LOG 'handle_role_request: Rolling back due to invalid action';
      ROLLBACK;
    END IF;
    RETURN jsonb_build_object('status', 'error', 'message', 'Invalid action specified.');
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Get error details
    GET STACKED DIAGNOSTICS 
      v_error_message = MESSAGE_TEXT,
      v_error_detail = PG_EXCEPTION_DETAIL,
      v_error_hint = PG_EXCEPTION_HINT,
      v_error_context = PG_EXCEPTION_CONTEXT;
    
    -- Log the error details
    RAISE LOG 'handle_role_request: ERROR - %', v_error_message;
    RAISE LOG 'handle_role_request: DETAIL - %', v_error_detail;
    RAISE LOG 'handle_role_request: HINT - %', v_error_hint;
    RAISE LOG 'handle_role_request: CONTEXT - %', v_error_context;
    
    -- Rollback if we started the transaction
    IF NOT v_in_transaction THEN
      RAISE LOG 'handle_role_request: Rolling back due to error';
      ROLLBACK;
    END IF;
    
    -- Return detailed error information
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'An unexpected error occurred',
      'error', v_error_message,
      'detail', v_error_detail,
      'hint', v_error_hint,
      'context', v_error_context
    );
  END;
END;
$$;

-- Update permissions
REVOKE ALL ON FUNCTION handle_role_request(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION handle_role_request(UUID, TEXT, TEXT) TO authenticated;
