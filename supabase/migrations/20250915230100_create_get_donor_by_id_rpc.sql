-- supabase/migrations/YYYYMMDDHHMMSS_create_get_donor_by_id_rpc.sql

-- RPC to get a single donor by their user_id, respecting RLS.
CREATE OR REPLACE FUNCTION public.get_donor_by_id(p_user_id uuid)
RETURNS TABLE(user_id uuid, full_name text, email text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_is_admin boolean;
BEGIN
  -- Check if the caller is an admin.
  SELECT public.is_admin(caller_id) INTO caller_is_admin;

  -- Return the query result.
  RETURN QUERY
    SELECT d.user_id, d.full_name, d.email, d.created_at
    FROM public.donors d
    WHERE d.user_id = p_user_id
      -- The caller must be an admin OR be the user they are requesting.
      AND (caller_is_admin OR d.user_id = caller_id);
END;
$$;
