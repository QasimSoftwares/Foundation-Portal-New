-- supabase/migrations/20250916100000_create_get_role_request_by_id_rpc.sql

CREATE OR REPLACE FUNCTION public.get_role_request_by_id(p_request_id uuid)
RETURNS TABLE (
    request_id uuid,
    user_id uuid,
    request_type text,
    request_status text,
    created_at timestamptz,
    updated_at timestamptz,
    notes text,
    full_name text,
    email text
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- This function can only be called by authenticated users.
  -- RLS policies on user_roles and profiles will determine if the user has permission.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    rr.request_id,
    rr.user_id,
    rr.request_type,
    rr.request_status,
    rr.created_at,
    rr.updated_at,
    rr.notes,
    p.full_name,
    p.email
  FROM
    public.role_requests rr
  JOIN
    public.profiles p ON rr.user_id = p.user_id
  WHERE
    rr.request_id = p_request_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_role_request_by_id(uuid) TO authenticated;
