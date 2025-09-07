-- Drop and recreate session RPCs to change OUT column names (fix 42P13)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Drop existing functions with the same argument signature
DROP FUNCTION IF EXISTS public.create_user_session(uuid, text, inet, text, text, jsonb);
DROP FUNCTION IF EXISTS public.refresh_user_session(text, text, inet, text);

-- Recreate create_user_session with distinct OUT column names
CREATE FUNCTION public.create_user_session(
  p_user_id uuid,
  p_refresh_token text,
  p_ip inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_id text DEFAULT NULL,
  p_device_info jsonb DEFAULT NULL
) RETURNS TABLE (
  out_session_id uuid,
  out_refresh_token_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id uuid;
  v_refresh_token_id uuid;
  v_ua_hash text;
  v_max_sessions int := 5;
  v_session_count int;
BEGIN
  v_session_id := gen_random_uuid();

  IF p_user_agent IS NOT NULL THEN
    v_ua_hash := encode(digest(p_user_agent, 'sha256'), 'hex');
  END IF;

  BEGIN
    INSERT INTO public.sessions (
      session_id,
      user_id,
      device_id,
      ua_hash,
      ip,
      last_seen_at
    ) VALUES (
      v_session_id,
      p_user_id,
      p_device_id,
      v_ua_hash,
      p_ip::text,
      now()
    );

    INSERT INTO public.refresh_tokens (
      user_id,
      session_id,
      token,
      token_hash,
      expires_at,
      ip_address,
      user_agent
    ) VALUES (
      p_user_id,
      v_session_id,
      p_refresh_token,
      encode(digest(p_refresh_token, 'sha256'), 'hex'),
      now() + interval '7 days',
      p_ip::text,
      p_user_agent
    )
    RETURNING public.refresh_tokens.refresh_token_id INTO v_refresh_token_id;

    INSERT INTO public.security_events (
      event_type,
      user_id,
      session_id,
      ip,
      metadata
    ) VALUES (
      'session_created',
      p_user_id,
      v_session_id,
      p_ip::text,
      jsonb_build_object(
        'user_agent', p_user_agent,
        'device_id', p_device_id,
        'device_info', p_device_info
      )
    );

    SELECT count(*)
    INTO v_session_count
    FROM public.sessions
    WHERE user_id = p_user_id
      AND revoked_at IS NULL;

    IF v_session_count > v_max_sessions THEN
      UPDATE public.sessions
      SET revoked_at = now(),
          revoked_reason = 'session_limit_reached'
      WHERE session_id IN (
        SELECT s.session_id
        FROM public.sessions s
        WHERE s.user_id = p_user_id
          AND s.revoked_at IS NULL
          AND s.session_id != v_session_id
        ORDER BY last_seen_at
        LIMIT (v_session_count - v_max_sessions + 1)
      );
    END IF;

    out_session_id := v_session_id;
    out_refresh_token_id := v_refresh_token_id;
    RETURN NEXT;

  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error in create_user_session: %', SQLERRM;
    RAISE;
  END;
END;
$$;

-- Recreate refresh_user_session with distinct OUT column names
CREATE FUNCTION public.refresh_user_session(
  p_old_refresh_token text,
  p_new_refresh_token text,
  p_ip inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS TABLE (
  out_session_id uuid,
  out_refresh_token_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
  v_new_token_id uuid;
BEGIN
  SELECT rt.user_id, rt.session_id
  INTO v_token_record
  FROM public.refresh_tokens rt
  WHERE (rt.token_hash = encode(digest(p_old_refresh_token, 'sha256'), 'hex') OR rt.token = p_old_refresh_token)
    AND (rt.revoked IS NULL OR rt.revoked = false)
    AND (rt.expires_at IS NULL OR rt.expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_refresh_token';
  END IF;

  UPDATE public.refresh_tokens
  SET revoked = true
  WHERE (token_hash = encode(digest(p_old_refresh_token, 'sha256'), 'hex') OR token = p_old_refresh_token);

  INSERT INTO public.refresh_tokens (
    user_id,
    session_id,
    token,
    token_hash,
    expires_at,
    ip_address,
    user_agent
  ) VALUES (
    v_token_record.user_id,
    v_token_record.session_id,
    p_new_refresh_token,
    encode(digest(p_new_refresh_token, 'sha256'), 'hex'),
    now() + interval '7 days',
    p_ip::text,
    p_user_agent
  )
  RETURNING public.refresh_tokens.refresh_token_id INTO v_new_token_id;

  UPDATE public.sessions
  SET last_seen_at = now()
  WHERE session_id = v_token_record.session_id;

  INSERT INTO public.security_events (
    event_type,
    user_id,
    session_id,
    ip,
    metadata
  ) VALUES (
    'session_refreshed',
    v_token_record.user_id,
    v_token_record.session_id,
    p_ip::text,
    jsonb_build_object(
      'user_agent', p_user_agent
    )
  );

  out_session_id := v_token_record.session_id;
  out_refresh_token_id := v_new_token_id;
  RETURN NEXT;

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error in refresh_user_session: %', SQLERRM;
  RAISE;
END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION public.create_user_session(uuid, text, inet, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_user_session(text, text, inet, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_user_session(uuid, text, inet, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_user_session(text, text, inet, text) TO authenticated;
