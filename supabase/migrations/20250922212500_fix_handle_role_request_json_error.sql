-- This migration fixes a JSON parsing error in the handle_role_request function.
-- The error was caused by incorrectly reusing a JSONB variable for a 'RETURNING *' clause.

CREATE OR REPLACE FUNCTION public.handle_role_request(
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
  v_request_type TEXT;
  v_approver_id UUID := auth.uid();
  v_result JSONB;
  v_error_message TEXT;
  v_error_detail TEXT;
  v_error_hint TEXT;
  v_error_context TEXT;
  v_member_result JSONB;
  v_volunteer_result JSONB;
  v_donor_result JSONB;
BEGIN
  -- Log function entry
  RAISE LOG 'handle_role_request: Starting for request_id=%, action=%, role=%', p_request_id, p_action, p_role;
  
  -- Ensure the user is an admin using the correct function
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can approve/reject role requests';
  END IF;
  
  -- Start a transaction
  BEGIN
    -- Get the user_id and current status of the request with FOR UPDATE to lock the row
    RAISE LOG 'handle_role_request: Fetching request details for request_id=%', p_request_id;
    SELECT user_id, request_status, request_type INTO v_user_id, v_current_status, v_request_type
    FROM public.role_requests
    WHERE request_id = p_request_id
    FOR UPDATE;
    
    -- Check if request exists
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Request not found';
    END IF;
    
    -- Validate the current status
    IF v_current_status NOT IN ('pending') THEN
      RAISE EXCEPTION 'Request is not in a pending state';
    END IF;
    
    -- Validate the action
    IF p_action NOT IN ('approve', 'reject') THEN
      RAISE EXCEPTION 'Invalid action. Must be ''approve'' or ''reject''';
    END IF;
    
    -- Process the action
    IF p_action = 'approve' THEN
      RAISE LOG 'handle_role_request: Processing approval for role=%', p_role;
      
      -- Update the request status with approval details
      UPDATE public.role_requests
      SET
        request_status = 'approved',
        approved_by = v_approver_id,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE request_id = p_request_id;
      
      -- Create the appropriate role record based on the request type
      IF p_role = 'volunteer' THEN
        -- Create volunteer record if it doesn't exist
        SELECT public.create_volunteer(v_user_id) INTO v_result;
        IF v_result->>'status' = 'error' THEN
          RAISE EXCEPTION 'Failed to create volunteer record: %', v_result->>'message';
        END IF;
        
        -- Update user_roles table. The RETURNING clause has been removed to fix the error.
        INSERT INTO public.user_roles (user_id, is_volunteer, updated_at)
        VALUES (v_user_id, TRUE, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          is_volunteer = TRUE,
          updated_at = NOW();
        
      ELSEIF p_role = 'member' THEN
        -- Create member record if it doesn't exist
        SELECT public.create_member(v_user_id) INTO v_member_result;
        IF v_member_result->>'status' = 'error' THEN
          RAISE EXCEPTION 'Failed to create member record: %', v_member_result->>'message';
        END IF;

        -- Update user_roles table
        INSERT INTO public.user_roles (user_id, is_member, updated_at)
        VALUES (v_user_id, TRUE, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          is_member = TRUE,
          updated_at = NOW();
        
      ELSEIF p_role = 'donor' THEN
        -- Update user_roles table
        INSERT INTO public.user_roles (user_id, is_donor, updated_at)
        VALUES (v_user_id, TRUE, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          is_donor = TRUE,
          updated_at = NOW();
      END IF;
      
      RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Request approved successfully',
        'request_id', p_request_id,
        'user_id', v_user_id,
        'role', p_role
      );
      
    ELSIF p_action = 'reject' THEN
      RAISE LOG 'handle_role_request: Rejecting request %', p_request_id;
      
      -- Update the request status for rejection
      UPDATE public.role_requests
      SET
        request_status = 'rejected',
        rejected_by = v_approver_id,
        rejected_at = NOW(),
        updated_at = NOW(),
        rejection_reason = 'Rejected by admin'
      WHERE request_id = p_request_id;
      
      RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Request rejected successfully',
        'request_id', p_request_id,
        'user_id', v_user_id,
        'role', p_role
      );
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    -- Capture error details
    GET STACKED DIAGNOSTICS
      v_error_message = MESSAGE_TEXT,
      v_error_detail = PG_EXCEPTION_DETAIL,
      v_error_hint = PG_EXCEPTION_HINT,
      v_error_context = PG_EXCEPTION_CONTEXT;
      
    -- Log the error
    RAISE LOG 'Error in handle_role_request: %', v_error_message;
    RAISE LOG 'Detail: %', v_error_detail;
    RAISE LOG 'Hint: %', v_error_hint;
    RAISE LOG 'Context: %', v_error_context;
    
    -- Re-raise the error
    RAISE EXCEPTION '%', v_error_message
      USING HINT = v_error_hint,
            DETAIL = v_error_detail,
            ERRCODE = 'P0001';
  END;
END;
$$;

-- Grant execute permissions on the updated function
GRANT EXECUTE ON FUNCTION public.handle_role_request(UUID, TEXT, TEXT) TO authenticated;
