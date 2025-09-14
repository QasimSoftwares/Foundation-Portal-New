-- Fix donor approval workflow
-- 1. Add approved_by and approved_at columns if they don't exist
ALTER TABLE public.role_requests
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 2. Update the update_role_request_status function to handle donor approvals
CREATE OR REPLACE FUNCTION public.update_role_request_status(
  p_request_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_status text := lower(p_status);
  v_request RECORD;
  v_role_request RECORD;
BEGIN
  -- Verify admin privileges
  SELECT COALESCE((SELECT is_admin FROM public.is_user_admin(v_uid)), false) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_status NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Get the request details
  SELECT * INTO v_request FROM public.role_requests WHERE request_id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  -- Start a transaction
  BEGIN
    -- Update the role request
    UPDATE public.role_requests
    SET 
      request_status = v_status,
      notes = COALESCE(p_notes, notes),
      approved_by = CASE WHEN v_status = 'approved' THEN v_uid ELSE approved_by END,
      approved_at = CASE WHEN v_status = 'approved' AND approved_at IS NULL THEN now() ELSE approved_at END,
      updated_at = now()
    WHERE request_id = p_request_id
    RETURNING * INTO v_role_request;

    -- If approved, handle role-specific logic
    IF v_status = 'approved' AND v_role_request.request_type = 'donor' THEN
      -- Check if user already has donor role
      PERFORM 1 FROM public.user_roles WHERE user_id = v_role_request.user_id AND is_donor = TRUE;
      IF NOT FOUND THEN
        -- Call create_donor RPC which will handle both donor creation and role update
        PERFORM create_donor(v_role_request.user_id);
      END IF;
    END IF;

    -- Commit the transaction
    RETURN;
  EXCEPTION WHEN OTHERS THEN
    -- Rollback on error
    RAISE EXCEPTION 'Error processing request: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the function permissions
REVOKE ALL ON FUNCTION public.update_role_request_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_role_request_status(uuid, text, text) TO authenticated;
