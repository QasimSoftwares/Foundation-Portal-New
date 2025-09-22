-- This migration provides a comprehensive fix for all volunteer-related RPCs used on the admin dashboard.
-- It ensures all functions are SECURITY DEFINER to bypass RLS and get a complete admin view,
-- while still being protected by an is_admin() guard clause.

-- 1. Fix get_total_volunteers
DROP FUNCTION IF EXISTS public.get_total_volunteers();
CREATE OR REPLACE FUNCTION public.get_total_volunteers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can get total volunteers.';
  END IF;

  SELECT count(*)::integer
  INTO total_count
  FROM public.user_roles
  WHERE is_volunteer = TRUE;

  RETURN total_count;
END;
$$;

-- 2. Fix get_pending_volunteer_requests
DROP FUNCTION IF EXISTS public.get_pending_volunteer_requests();
CREATE OR REPLACE FUNCTION public.get_pending_volunteer_requests()
RETURNS TABLE (
  request_id uuid,
  user_id uuid,
  request_type text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  full_name text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can list pending volunteer requests.';
  END IF;

  RETURN QUERY
  SELECT rr.request_id, rr.user_id, rr.request_type, rr.request_status as status, rr.created_at, rr.updated_at, p.full_name, p.email
  FROM public.role_requests rr
  LEFT JOIN public.profiles p ON p.user_id = rr.user_id
  WHERE rr.request_type = 'volunteer' AND rr.request_status = 'pending'
  ORDER BY rr.created_at DESC;
END;
$$;

-- 3. Fix get_approved_volunteers
DROP FUNCTION IF EXISTS public.get_approved_volunteers();
CREATE OR REPLACE FUNCTION public.get_approved_volunteers()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  approved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can list approved volunteers.';
  END IF;

  RETURN QUERY
  SELECT ur.user_id, p.full_name, p.email, ur.updated_at AS approved_at
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.is_volunteer = TRUE
  ORDER BY ur.updated_at DESC NULLS LAST;
END;
$$;

-- 4. Fix get_rejected_volunteers
DROP FUNCTION IF EXISTS public.get_rejected_volunteers();
CREATE OR REPLACE FUNCTION public.get_rejected_volunteers()
RETURNS TABLE (
  request_id uuid,
  user_id uuid,
  request_type text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  full_name text,
  email text,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can list rejected volunteers.';
  END IF;

  RETURN QUERY
  SELECT rr.request_id, rr.user_id, rr.request_type, rr.request_status as status, rr.created_at, rr.updated_at, p.full_name, p.email, rr.approved_by, rr.approved_at, rr.rejection_reason, rr.notes
  FROM public.role_requests rr
  LEFT JOIN public.profiles p ON p.user_id = rr.user_id
  WHERE rr.request_type = 'volunteer' AND rr.request_status = 'rejected'
  ORDER BY rr.created_at DESC;
END;
$$;

-- Grant permissions for all functions
GRANT EXECUTE ON FUNCTION public.get_total_volunteers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_volunteer_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_approved_volunteers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rejected_volunteers() TO authenticated;

RAISE NOTICE 'Successfully fixed all volunteer metrics RPCs.';
