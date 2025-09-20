-- supabase/migrations/20250916110000_create_get_user_sessions_rpc.sql

CREATE OR REPLACE FUNCTION public.get_user_sessions(p_user_id uuid)
RETURNS TABLE (
    session_id uuid,
    created_at timestamptz,
    last_seen_at timestamptz,
    ip inet,
    ua_hash text,
    device_id text,
    revoked_at timestamptz,
    revoked_reason text
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- This function can only be called by the user whose sessions are being requested.
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    s.session_id,
    s.created_at,
    s.last_seen_at,
    s.ip,
    s.ua_hash,
    s.device_id,
    s.revoked_at,
    s.revoked_reason
  FROM
    public.sessions s
  WHERE
    s.user_id = p_user_id
  ORDER BY
    s.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_sessions(uuid) TO authenticated;
