-- Drop the existing policies on user_roles to redefine them
DROP POLICY IF EXISTS "Allow all access to admins" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- RLS policy for admins to bypass other checks and prevent recursion
-- This policy must be created before other policies that might use is_admin()
CREATE POLICY "Allow all access to admins" 
ON public.user_roles
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- RLS policy for users to view their own roles
CREATE POLICY "Users can view their own roles" 
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Ensure the handle_role_request function is up-to-date
-- This ensures the latest version of the function is in place with correct logic
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
  v_donor_result JSONB;
BEGIN
  RAISE LOG 'handle_role_request started for request_id: %, action: %, role: %', p_request_id, p_action, p_role;

  IF NOT public.is_admin() THEN
    RAISE LOG 'Admin check failed for user: %', v_admin_id;
    RETURN jsonb_build_object('status', 'error', 'message', 'User is not authorized to perform this action.');
  END IF;
  RAISE LOG 'Admin check passed for user: %', v_admin_id;

  BEGIN
    RAISE LOG 'Fetching request details for request_id: %', p_request_id;
    SELECT user_id, request_status INTO v_user_id, v_current_status
    FROM public.role_requests
    WHERE request_id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE LOG 'Request not found for request_id: %', p_request_id;
      RETURN jsonb_build_object('status', 'error', 'message', 'Request not found.');
    END IF;
    RAISE LOG 'Found request for user_id: %, status: %', v_user_id, v_current_status;

    IF v_current_status <> 'pending' THEN
      RAISE LOG 'Request % already processed with status: %', p_request_id, v_current_status;
      RETURN jsonb_build_object('status', 'error', 'message', 'This request has already been processed.');
    END IF;

    IF p_action = 'approve' THEN
      RAISE LOG 'Approving request %', p_request_id;
      UPDATE public.role_requests
      SET 
        request_status = 'approved',
        approved_by = v_admin_id,
        approved_at = v_now,
        updated_at = v_now
      WHERE request_id = p_request_id;
      RAISE LOG 'Updated role_requests table for request %', p_request_id;

      IF p_role = 'donor' THEN
        RAISE LOG 'Handling donor role for user_id: %', v_user_id;
        PERFORM 1 FROM public.user_roles WHERE user_id = v_user_id AND is_donor = TRUE;
        IF NOT FOUND THEN
          RAISE LOG 'User does not have donor role, calling create_donor...';
          SELECT create_donor(v_user_id) INTO v_donor_result;
          IF v_donor_result->>'status' = 'error' THEN
            RAISE EXCEPTION 'create_donor failed: %', v_donor_result->>'message';
          END IF;
          RAISE LOG 'create_donor RPC called successfully.';
        ELSE
          RAISE LOG 'User already has donor role.';
        END IF;
      ELSIF p_role = 'volunteer' THEN
        UPDATE public.user_roles SET is_volunteer = TRUE WHERE user_id = v_user_id;
      ELSIF p_role = 'member' THEN
        UPDATE public.user_roles SET is_member = TRUE WHERE user_id = v_user_id;
      ELSE
        RETURN jsonb_build_object('status', 'error', 'message', 'Invalid role specified.');
      END IF;

      RETURN jsonb_build_object('status', 'success', 'message', 'Request approved successfully.');

    ELSIF p_action = 'reject' THEN
      UPDATE public.role_requests
      SET 
        request_status = 'rejected',
        approved_by = v_admin_id,
        approved_at = v_now,
        updated_at = v_now
      WHERE request_id = p_request_id;
      RETURN jsonb_build_object('status', 'success', 'message', 'Request rejected successfully.');
    ELSE
      RETURN jsonb_build_object('status', 'error', 'message', 'Invalid action specified.');
    END IF;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS 
      v_error_message = MESSAGE_TEXT,
      v_error_detail = PG_EXCEPTION_DETAIL,
      v_error_hint = PG_EXCEPTION_HINT,
      v_error_context = PG_EXCEPTION_CONTEXT;
    
    RAISE LOG 'handle_role_request: ERROR - %', v_error_message;
    RAISE LOG 'handle_role_request: DETAIL - %', v_error_detail;
    RAISE LOG 'handle_role_request: HINT - %', v_error_hint;
    RAISE LOG 'handle_role_request: CONTEXT - %', v_error_context;
    
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'An unexpected error occurred: ' || v_error_message,
      'detail', v_error_detail
    );
  END;
END;
$$;
