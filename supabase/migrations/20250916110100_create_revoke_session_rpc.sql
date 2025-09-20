-- supabase/migrations/20250916110100_create_revoke_session_rpc.sql

CREATE OR REPLACE FUNCTION public.revoke_session(p_session_id uuid, p_revoked_by_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_target_user_id uuid;
BEGIN
  -- This function can only be called by authenticated users.
  IF auth.uid() IS NULL OR auth.uid() != p_revoked_by_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get the user_id of the session being revoked
  SELECT user_id INTO v_target_user_id
  FROM public.sessions
  WHERE session_id = p_session_id;

  -- Ensure the session exists and belongs to the user requesting revocation
  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  ELSIF v_target_user_id != p_revoked_by_user_id THEN
    -- Log security event for unauthorized attempt
    INSERT INTO public.security_events (user_id, event_type, metadata)
    VALUES (p_revoked_by_user_id, 'unauthorized_session_revocation_attempt', jsonb_build_object('target_session_id', p_session_id));
    RAISE EXCEPTION 'Unauthorized to revoke this session';
  END IF;

  -- Revoke the session
  UPDATE public.sessions
  SET
    revoked_at = now(),
    revoked_reason = 'revoked_by_user'
  WHERE session_id = p_session_id;

  -- Revoke any associated refresh tokens
  UPDATE public.refresh_tokens
  SET
    revoked_at = now(),
    revoked_reason = 'session_revoked'
  WHERE session_id = p_session_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.revoke_session(uuid, uuid) TO authenticated;
