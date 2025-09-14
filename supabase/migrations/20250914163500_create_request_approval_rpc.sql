-- First drop the function if it exists
DROP FUNCTION IF EXISTS get_pending_role_requests();

-- RPC to get all pending role requests, joining with user profiles
CREATE OR REPLACE FUNCTION get_pending_role_requests()
RETURNS TABLE(
  request_id UUID,
  user_id UUID,
  request_type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  full_name TEXT,
  email TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Debug: Check if the function is being called
  RAISE NOTICE 'get_pending_role_requests function called';
  
  -- Ensure the user is an admin before proceeding
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'User is not authorized to view pending requests.';
  END IF;
  
  -- Debug: Check if there are any pending requests
  SELECT COUNT(*) INTO v_count FROM public.role_requests WHERE request_status = 'pending';
  RAISE NOTICE 'Found % pending requests', v_count;
  
  -- Debug: Check if there are any profiles
  SELECT COUNT(*) INTO v_count FROM public.profiles;
  RAISE NOTICE 'Total profiles in database: %', v_count;
  
  -- Debug: Check the specific pending request
  PERFORM 1 FROM public.role_requests WHERE request_id = '85cc37d8-e804-4858-a6b4-1fcab35056d0';
  IF FOUND THEN
    RAISE NOTICE 'Found specific pending request with ID 85cc37d8-e804-4858-a6b4-1fcab35056d0';
  ELSE
    RAISE NOTICE 'Specific pending request with ID 85cc37d8-e804-4858-a6b4-1fcab35056d0 NOT FOUND';
  END IF;

  RETURN QUERY
  SELECT
    rr.request_id,
    rr.user_id,
    rr.request_type,
    rr.request_status as status,
    rr.created_at,
    COALESCE(p.full_name, 'Unknown') as full_name,
    COALESCE(p.email, 'no-email@example.com') as email
  FROM
    public.role_requests rr
  LEFT JOIN
    public.profiles p ON rr.user_id = p.user_id
  WHERE
    rr.request_status = 'pending'
  ORDER BY
    rr.created_at ASC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_pending_role_requests() TO authenticated;

-- RPC to handle approving or rejecting a role request
-- First drop the function if it exists
DROP FUNCTION IF EXISTS handle_role_request(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION handle_role_request(p_request_id UUID, p_action TEXT, p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_current_status TEXT;
BEGIN
  -- Ensure the user is an admin
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'User is not authorized to perform this action.');
  END IF;

  -- Get the user_id and current status of the request
  SELECT user_id, request_status INTO v_user_id, v_current_status
  FROM public.role_requests
  WHERE request_id = p_request_id;

  -- Check if the request exists and is pending
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Request not found.');
  END IF;

  IF v_current_status <> 'pending' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'This request has already been processed.');
  END IF;

  -- Handle the approval or rejection
  IF p_action = 'approve' THEN
    -- Update the request status
    UPDATE public.role_requests
    SET request_status = 'approved', updated_at = NOW()
    WHERE request_id = p_request_id;

    -- Handle role-specific actions
    IF p_role = 'donor' THEN
      -- Call the specialized RPC to create a donor, which also handles the user_roles update
      PERFORM create_donor(v_user_id);
    ELSIF p_role = 'volunteer' THEN
      -- Placeholder for volunteer creation logic
      UPDATE public.user_roles SET is_volunteer = TRUE WHERE user_id = v_user_id;
      -- INSERT INTO public.volunteers (user_id) VALUES (v_user_id) ON CONFLICT (user_id) DO NOTHING;
    ELSIF p_role = 'member' THEN
      -- Placeholder for member creation logic
      UPDATE public.user_roles SET is_member = TRUE WHERE user_id = v_user_id;
      -- INSERT INTO public.members (user_id) VALUES (v_user_id) ON CONFLICT (user_id) DO NOTHING;
    ELSE
      RETURN jsonb_build_object('status', 'error', 'message', 'Invalid role specified.');
    END IF;

    RETURN jsonb_build_object('status', 'success', 'message', 'Request approved successfully.');

  ELSIF p_action = 'reject' THEN
    -- Update the request status
    UPDATE public.role_requests
    SET request_status = 'rejected', updated_at = NOW()
    WHERE request_id = p_request_id;

    RETURN jsonb_build_object('status', 'success', 'message', 'Request rejected successfully.');
  ELSE
    RETURN jsonb_build_object('status', 'error', 'message', 'Invalid action specified.');
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'An unexpected error occurred: ' || SQLERRM);
END;
$$;
