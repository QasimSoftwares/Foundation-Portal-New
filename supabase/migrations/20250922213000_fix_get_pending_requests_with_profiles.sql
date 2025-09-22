-- This migration fixes the get_pending_role_requests RPC to include user profile information.

-- Drop the existing function to ensure a clean update.
DROP FUNCTION IF EXISTS public.get_pending_role_requests();

-- Recreate the function with a JOIN to the profiles table.
CREATE OR REPLACE FUNCTION public.get_pending_role_requests()
RETURNS TABLE (
  request_id UUID,
  user_id UUID,
  request_type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  full_name TEXT,
  email TEXT,
  notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure the user is an admin before proceeding.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view pending requests.';
  END IF;

  -- Return all pending role requests, joining with profiles to get user details.
  RETURN QUERY
  SELECT 
    rr.request_id,
    rr.user_id,
    rr.request_type,
    rr.request_status AS status,
    rr.created_at,
    rr.updated_at,
    p.full_name,
    p.email,
    rr.notes
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

-- Grant execute permission.
GRANT EXECUTE ON FUNCTION public.get_pending_role_requests() TO authenticated;

COMMENT ON FUNCTION public.get_pending_role_requests() IS 'Returns all pending role requests with user profile data. Admin-only. SECURITY DEFINER.';
