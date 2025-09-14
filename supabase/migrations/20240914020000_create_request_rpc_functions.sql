-- Unified Role Request RPCs
-- Depends on: public.role_requests table existing with schema as provided
-- Also depends on: public.is_user_admin(uuid) returning TABLE(is_admin boolean)

-- Helper: validate request type
CREATE OR REPLACE FUNCTION public._validate_request_type(p_type text)
RETURNS void AS $$
BEGIN
  IF p_type IS NULL OR lower(p_type) NOT IN ('donor','volunteer','member') THEN
    RAISE EXCEPTION 'invalid_request_type';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Submit role request
CREATE OR REPLACE FUNCTION public.submit_role_request(
  p_user_id uuid,
  p_type text,
  p_notes text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_request_id uuid;
  v_uid uuid := auth.uid();
  v_type text := lower(p_type);
  v_exists boolean;
BEGIN
  -- Ensure caller identity matches
  IF v_uid IS NULL OR v_uid <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Validate type
  PERFORM public._validate_request_type(v_type);

  -- Prevent duplicate pending request for the same type
  SELECT EXISTS (
    SELECT 1 FROM public.role_requests rr
    WHERE rr.user_id = p_user_id
      AND rr.request_type = v_type
      AND rr.request_status = 'pending'
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'request_already_pending';
  END IF;

  -- Insert new request as pending
  BEGIN
    INSERT INTO public.role_requests (user_id, request_type, request_status, notes)
    VALUES (p_user_id, v_type, 'pending', p_notes)
    RETURNING request_id INTO v_request_id;
  EXCEPTION WHEN unique_violation THEN
    -- Covers the partial unique index on (user_id, request_type) WHERE request_status = 'pending'
    RAISE EXCEPTION 'request_already_pending';
  END;

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all role requests for a user (self or admin)
CREATE OR REPLACE FUNCTION public.get_user_role_requests(
  p_user_id uuid
) RETURNS SETOF public.role_requests AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  -- Admins can view any user, others only self
  SELECT COALESCE((SELECT is_admin FROM public.is_user_admin(v_uid)), false) INTO v_is_admin;
  IF v_uid IS NULL OR (NOT v_is_admin AND v_uid <> p_user_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.role_requests rr
  WHERE rr.user_id = p_user_id
  ORDER BY rr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin: Get all pending role requests
CREATE OR REPLACE FUNCTION public.get_pending_role_requests()
RETURNS SETOF public.role_requests AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  SELECT COALESCE((SELECT is_admin FROM public.is_user_admin(v_uid)), false) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.role_requests rr
  WHERE rr.request_status = 'pending'
  ORDER BY rr.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin: Update request status
CREATE OR REPLACE FUNCTION public.update_role_request_status(
  p_request_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_status text := lower(p_status);
BEGIN
  SELECT COALESCE((SELECT is_admin FROM public.is_user_admin(v_uid)), false) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_status NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  UPDATE public.role_requests
  SET request_status = v_status,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE request_id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions
REVOKE ALL ON FUNCTION public.submit_role_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_role_requests(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_pending_role_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_role_request_status(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_role_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role_requests(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_role_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_role_request_status(uuid, text, text) TO authenticated;
