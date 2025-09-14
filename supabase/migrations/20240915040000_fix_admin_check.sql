-- Create a secure wrapper function that checks admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_admin boolean;
  v_user_id uuid := auth.uid();
BEGIN
  -- Use a prepared statement to prevent SQL injection
  EXECUTE format('SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = %L AND is_admin = true
  )', v_user_id) INTO v_is_admin;
  
  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Update the handle_role_request function to use the new is_admin function
CREATE OR REPLACE FUNCTION handle_role_request(
  p_request_id UUID, 
  p_action TEXT, 
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_status TEXT;
  v_admin_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Verify admin status and validate input
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object(
      'status', 'error', 
      'message', 'User is not authorized to perform this action.'
    );
  END IF;
  
  -- Validate role parameter
  IF p_role IS NULL OR p_role NOT IN ('donor', 'volunteer', 'member') THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Invalid role specified.'
    );
  END IF;
  
  -- Validate action parameter
  IF p_action IS NULL OR p_action NOT IN ('approve', 'reject') THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Invalid action specified.'
    );
  END IF;

  -- Rest of the function remains the same...
  -- Start a transaction
  BEGIN
    -- Get the user_id and current status of the request with FOR UPDATE to lock the row
    SELECT user_id, request_status INTO v_user_id, v_current_status
    FROM public.role_requests
    WHERE request_id = p_request_id
    FOR UPDATE;

    -- Check if the request exists and is pending
    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'error', 'message', 'Request not found.');
    END IF;

    IF v_current_status <> 'pending' THEN
      RETURN jsonb_build_object('status', 'error', 'message', 'This request has already been processed.');
    END IF;

    -- Handle the approval or rejection
    IF p_action = 'approve' THEN
      -- Update the request status with approval details
      UPDATE public.role_requests
      SET 
        request_status = 'approved',
        approved_by = v_admin_id,
        approved_at = v_now,
        updated_at = v_now
      WHERE request_id = p_request_id;

      -- Handle role-specific actions
      IF p_role = 'donor' THEN
        -- Check if user already has donor role
        PERFORM 1 FROM public.user_roles WHERE user_id = v_user_id AND is_donor = TRUE;
        IF NOT FOUND THEN
          -- Call the create_donor RPC which will handle both donor creation and role update
          PERFORM create_donor(v_user_id);
        END IF;
      ELSIF p_role = 'volunteer' THEN
        UPDATE public.user_roles 
        SET is_volunteer = TRUE 
        WHERE user_id = v_user_id;
      ELSIF p_role = 'member' THEN
        UPDATE public.user_roles 
        SET is_member = TRUE 
        WHERE user_id = v_user_id;
      ELSE
        ROLLBACK;
        RETURN jsonb_build_object('status', 'error', 'message', 'Invalid role specified.');
      END IF;

      -- Success - implicit commit
      RETURN jsonb_build_object('status', 'success', 'message', 'Request approved successfully.');

    ELSIF p_action = 'reject' THEN
      -- Update the request status for rejection
      UPDATE public.role_requests
      SET 
        request_status = 'rejected',
        approved_by = v_admin_id,
        approved_at = v_now,
        updated_at = v_now
      WHERE request_id = p_request_id;

      -- Success - implicit commit
      RETURN jsonb_build_object('status', 'success', 'message', 'Request rejected successfully.');
    ELSE
      RETURN jsonb_build_object('status', 'error', 'message', 'Invalid action specified.');
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Return error with details
    RETURN jsonb_build_object(
      'status', 'error', 
      'message', 'An unexpected error occurred',
      'details', SQLERRM,
      'sqlstate', SQLSTATE
    );
  END;
END;
$$;
