-- Create a function to generate volunteer numbers
-- Ensure old versions are dropped to avoid return type conflicts
DROP FUNCTION IF EXISTS public.generate_volunteer_number();
CREATE OR REPLACE FUNCTION public.generate_volunteer_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  next_num INTEGER;
  new_volunteer_number TEXT;
BEGIN
  -- Get the next sequence number
  SELECT COALESCE(MAX(CAST(SUBSTRING(volunteer_number FROM 2) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.volunteers
  WHERE volunteer_number ~ '^V[0-9]+$';
  
  -- Format as V followed by 6-digit number with leading zeros
  new_volunteer_number := 'V' || LPAD(next_num::TEXT, 6, '0');
  
  RETURN new_volunteer_number;
END;
$$;

-- Create a function to create a volunteer record
-- Ensure old versions are dropped to avoid return type conflicts
DROP FUNCTION IF EXISTS public.create_volunteer(UUID);
CREATE OR REPLACE FUNCTION public.create_volunteer(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_volunteer_number TEXT;
  v_volunteer_id UUID;
  v_result JSONB;
BEGIN
  -- If a volunteer record already exists for this user, return it (idempotent)
  SELECT volunteer_id INTO v_volunteer_id
  FROM public.volunteers
  WHERE user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'success',
      'volunteer_id', v_volunteer_id,
      'volunteer_number', (SELECT volunteer_number FROM public.volunteers WHERE volunteer_id = v_volunteer_id)
    );
  END IF;

  -- Generate a new volunteer number
  SELECT public.generate_volunteer_number() INTO v_volunteer_number;
  
  -- Insert the new volunteer record
  INSERT INTO public.volunteers (
    user_id,
    volunteer_number,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_volunteer_number,
    NOW(),
    NOW()
  )
  RETURNING volunteer_id INTO v_volunteer_id;
  
  RETURN jsonb_build_object(
    'status', 'success',
    'volunteer_id', v_volunteer_id,
    'volunteer_number', v_volunteer_number
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'status', 'error',
    'message', SQLERRM,
    'code', SQLSTATE
  );
END;
$$;

-- Ensure one volunteer row per user
CREATE UNIQUE INDEX IF NOT EXISTS volunteers_user_id_key ON public.volunteers(user_id);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_volunteer_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_volunteer(UUID) TO authenticated;

-- Create a new version of handle_role_request with volunteer creation
-- Ensure old versions are dropped to avoid return type conflicts
DROP FUNCTION IF EXISTS handle_role_request(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION handle_role_request(
  p_request_id UUID, 
  p_action TEXT, 
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID;
  v_current_status TEXT;
  v_admin_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_error_message TEXT;
  v_error_detail TEXT;
  v_error_hint TEXT;
  v_error_context TEXT;
  v_donor_result JSONB;
  v_volunteer_result JSONB;
  v_member_result JSONB;
  v_request_type TEXT;
BEGIN
  -- Log function entry
  RAISE LOG 'handle_role_request: Starting for request_id=%, action=%, role=%', p_request_id, p_action, p_role;
  
  -- Ensure the user is an admin
  IF NOT public.is_admin() THEN
    RAISE LOG 'handle_role_request: User % is not an admin', v_admin_id;
    RETURN jsonb_build_object('status', 'error', 'message', 'User is not authorized to perform this action.');
  END IF;
  
  RAISE LOG 'handle_role_request: User % is an admin', v_admin_id;

  BEGIN
    -- Get the user_id and current status of the request with FOR UPDATE to lock the row
    RAISE LOG 'handle_role_request: Fetching request details for request_id=%', p_request_id;
    SELECT user_id, request_status, request_type INTO v_user_id, v_current_status, v_request_type
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

    -- Optional: validate provided p_role matches stored request_type
    IF p_role IS NOT NULL AND p_role <> v_request_type THEN
      RAISE LOG 'handle_role_request: p_role % does not match request_type % for request %', p_role, v_request_type, p_request_id;
      RETURN jsonb_build_object('status', 'error', 'message', 'Role mismatch for request.');
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

      -- Handle role-specific actions using stored request_type
      IF v_request_type = 'donor' THEN
        BEGIN
          -- Check if user already has donor role
          RAISE LOG 'handle_role_request: Checking if user % already has donor role', v_user_id;
          PERFORM 1 FROM public.user_roles WHERE user_id = v_user_id AND is_donor = TRUE;
          
          IF NOT FOUND THEN
            RAISE LOG 'handle_role_request: Calling create_donor for user_id=%', v_user_id;
            -- Call the create_donor RPC and capture its result
            SELECT * INTO v_donor_result FROM create_donor(v_user_id);
            
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
        
      ELSIF v_request_type = 'volunteer' THEN
        BEGIN
          -- First update the user_roles table
          RAISE LOG 'handle_role_request: Setting is_volunteer=TRUE for user_id=%', v_user_id;
          
          -- Insert or update user_roles
          INSERT INTO public.user_roles (user_id, is_volunteer, updated_at)
          VALUES (v_user_id, TRUE, v_now)
          ON CONFLICT (user_id) 
          DO UPDATE SET 
            is_volunteer = EXCLUDED.is_volunteer,
            updated_at = EXCLUDED.updated_at;
          
          -- Then create the volunteer record
          RAISE LOG 'handle_role_request: Creating volunteer record for user_id=%', v_user_id;
          SELECT * INTO v_volunteer_result FROM public.create_volunteer(v_user_id);
          
          IF v_volunteer_result->>'status' != 'success' THEN
            RAISE EXCEPTION 'create_volunteer failed: %', v_volunteer_result->>'message';
          END IF;
          
          RAISE LOG 'handle_role_request: Created volunteer record: %', v_volunteer_result;
          
        EXCEPTION WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS
            v_error_message = MESSAGE_TEXT,
            v_error_detail = PG_EXCEPTION_DETAIL,
            v_error_hint = PG_EXCEPTION_HINT,
            v_error_context = PG_EXCEPTION_CONTEXT;
          
          RAISE LOG 'handle_role_request: Error in volunteer processing: %', v_error_message;
          RAISE LOG 'handle_role_request: Error detail: %', v_error_detail;
          RAISE LOG 'handle_role_request: Error hint: %', v_error_hint;
          RAISE LOG 'handle_role_request: Error context: %', v_error_context;
          
          -- Re-raise the exception to be caught by the outer exception handler
          RAISE EXCEPTION 'Error processing volunteer role: %', v_error_message;
        END;
        
      ELSIF v_request_type = 'member' THEN
        BEGIN
          -- First update the user_roles table
          RAISE LOG 'handle_role_request: Setting is_member=TRUE for user_id=%', v_user_id;

          -- Insert or update user_roles
          INSERT INTO public.user_roles (user_id, is_member, updated_at)
          VALUES (v_user_id, TRUE, v_now)
          ON CONFLICT (user_id)
          DO UPDATE SET
            is_member = EXCLUDED.is_member,
            updated_at = EXCLUDED.updated_at;

          -- Then create the member record
          RAISE LOG 'handle_role_request: Creating member record for user_id=%', v_user_id;
          SELECT * INTO v_member_result FROM public.create_member(v_user_id);

          IF v_member_result->>'status' != 'success' THEN
            RAISE EXCEPTION 'create_member failed: %', v_member_result->>'message';
          END IF;

          RAISE LOG 'handle_role_request: Created member record: %', v_member_result;

        EXCEPTION WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS
            v_error_message = MESSAGE_TEXT,
            v_error_detail = PG_EXCEPTION_DETAIL,
            v_error_hint = PG_EXCEPTION_HINT,
            v_error_context = PG_EXCEPTION_CONTEXT;

          RAISE LOG 'handle_role_request: Error in member processing: %', v_error_message;
          RAISE LOG 'handle_role_request: Error detail: %', v_error_detail;
          RAISE LOG 'handle_role_request: Error hint: %', v_error_hint;
          RAISE LOG 'handle_role_request: Error context: %', v_error_context;

          -- Re-raise the exception to be caught by the outer exception handler
          RAISE EXCEPTION 'Error processing member role: %', v_error_message;
        END;
        
      ELSE
        RAISE LOG 'handle_role_request: Invalid request_type in DB: %', v_request_type;
        RETURN jsonb_build_object('status', 'error', 'message', 'Invalid role specified.');
      END IF;

      RAISE LOG 'handle_role_request: Successfully processed request %', p_request_id;
      RETURN jsonb_build_object('status', 'success', 'message', 'Request approved successfully.');

    ELSIF p_action = 'reject' THEN
      RAISE LOG 'handle_role_request: Rejecting request %', p_request_id;
      
      -- Update the request status for rejection
      UPDATE public.role_requests
      SET 
        request_status = 'rejected',
        rejected_by = v_admin_id,
        rejected_at = v_now,
        updated_at = v_now
      WHERE request_id = p_request_id;
      
      RAISE LOG 'handle_role_request: Successfully rejected request %', p_request_id;
      RETURN jsonb_build_object('status', 'success', 'message', 'Request rejected successfully.');
      
    ELSE
      RAISE LOG 'handle_role_request: Invalid action: %', p_action;
      RETURN jsonb_build_object('status', 'error', 'message', 'Invalid action. Must be "approve" or "reject".');
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_error_message = MESSAGE_TEXT,
      v_error_detail = PG_EXCEPTION_DETAIL,
      v_error_hint = PG_EXCEPTION_HINT,
      v_error_context = PG_EXCEPTION_CONTEXT;
    
    -- Log the error
    RAISE LOG 'handle_role_request: ERROR - %', v_error_message;
    RAISE LOG 'handle_role_request: DETAIL - %', v_error_detail;
    RAISE LOG 'handle_role_request: HINT - %', v_error_hint;
    RAISE LOG 'handle_role_request: CONTEXT - %', v_error_context;
    
    -- Return the error
    RETURN jsonb_build_object(
      'status', 'error',
      'message', v_error_message,
      'detail', v_error_detail,
      'hint', v_error_hint
    );
  END;
END;
$$;
