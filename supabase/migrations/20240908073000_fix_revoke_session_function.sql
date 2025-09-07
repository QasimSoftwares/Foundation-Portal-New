-- Fix the revoke_session function to match the actual schema
CREATE OR REPLACE FUNCTION public.revoke_session(
  p_session_id uuid,
  p_reason text DEFAULT 'user_logout'
) 
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- First get the user_id for logging
  SELECT user_id INTO v_user_id
  FROM public.sessions
  WHERE session_id = p_session_id;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Session % not found', p_session_id;
    RETURN;
  END IF;
  
  -- Revoke the session
  UPDATE public.sessions
  SET 
    revoked_at = now(),
    revoked_reason = p_reason
  WHERE session_id = p_session_id
  AND (revoked_at IS NULL OR revoked_at > now());
  
  -- Revoke all refresh tokens for this session
  -- Note: Using the correct column names from your schema
  UPDATE public.refresh_tokens
  SET 
    revoked = true,
    expires_at = now()  -- Set expiry to now to immediately invalidate
  WHERE session_id = p_session_id
  AND (expires_at IS NULL OR expires_at > now());
  
  -- Log the revocation
  INSERT INTO public.security_events (
    event_type,
    user_id,
    session_id,
    metadata
  ) VALUES (
    'session_revoked',
    v_user_id,
    p_session_id,
    jsonb_build_object('reason', p_reason)
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error in revoke_session: %', SQLERRM;
  RAISE;
END;
$$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION public.revoke_session(uuid, text) TO authenticated;
