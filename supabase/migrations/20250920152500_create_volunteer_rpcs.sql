-- Create volunteer-related RPCs (SECURITY INVOKER) following RPC-first and RLS-friendly patterns
-- Notes:
-- - Admins can access all records (checked via public.is_admin)
-- - Non-admins can only see their own records using auth.uid()
-- - Uses existing tables: user_roles, role_requests, profiles

-- Ensure is_admin exists (idempotent)
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id AND is_admin = TRUE
  );
$$;

-- Total volunteers (approved)
CREATE OR REPLACE FUNCTION public.get_total_volunteers()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  total_count integer := 0;
  caller_id uuid := auth.uid();
  caller_is_admin boolean;
BEGIN
  SELECT public.is_admin(caller_id) INTO caller_is_admin;

  IF caller_is_admin THEN
    SELECT COUNT(*) INTO total_count
    FROM public.user_roles ur
    WHERE ur.is_volunteer = TRUE;
  ELSE
    SELECT COUNT(*) INTO total_count
    FROM public.user_roles ur
    WHERE ur.user_id = caller_id AND ur.is_volunteer = TRUE;
  END IF;

  RETURN total_count;
END;
$$;

-- Pending volunteer requests
-- Returns: request_id, user_id, request_type, status, created_at, updated_at (nullable), full_name, email
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
SECURITY INVOKER
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_is_admin boolean;
BEGIN
  SELECT public.is_admin(caller_id) INTO caller_is_admin;

  IF caller_is_admin THEN
    RETURN QUERY
    SELECT rr.request_id,
           rr.user_id,
           rr.request_type,
           rr.request_status as status,
           rr.created_at,
           rr.updated_at,
           p.full_name,
           p.email
    FROM public.role_requests rr
    LEFT JOIN public.profiles p ON p.user_id = rr.user_id
    WHERE rr.request_type = 'volunteer' AND rr.request_status = 'pending'
    ORDER BY rr.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT rr.request_id,
           rr.user_id,
           rr.request_type,
           rr.request_status as status,
           rr.created_at,
           rr.updated_at,
           p.full_name,
           p.email
    FROM public.role_requests rr
    LEFT JOIN public.profiles p ON p.user_id = rr.user_id
    WHERE rr.request_type = 'volunteer'
      AND rr.request_status = 'pending'
      AND rr.user_id = caller_id
    ORDER BY rr.created_at DESC;
  END IF;
END;
$$;

-- Approved volunteers list (from user_roles with profile info)
CREATE OR REPLACE FUNCTION public.get_approved_volunteers()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  approved_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_is_admin boolean;
BEGIN
  SELECT public.is_admin(caller_id) INTO caller_is_admin;

  IF caller_is_admin THEN
    RETURN QUERY
    SELECT ur.user_id,
           p.full_name,
           p.email,
           ur.updated_at AS approved_at
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.is_volunteer = TRUE
    ORDER BY ur.updated_at DESC NULLS LAST;
  ELSE
    RETURN QUERY
    SELECT ur.user_id,
           p.full_name,
           p.email,
           ur.updated_at AS approved_at
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.is_volunteer = TRUE AND ur.user_id = caller_id
    ORDER BY ur.updated_at DESC NULLS LAST;
  END IF;
END;
$$;

-- Rejected volunteer requests
-- First drop the function if it exists to avoid return type conflicts
DROP FUNCTION IF EXISTS public.get_rejected_volunteers();

-- Then create the function with the correct return type
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
SECURITY INVOKER
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_is_admin boolean;
BEGIN
  SELECT public.is_admin(caller_id) INTO caller_is_admin;

  IF caller_is_admin THEN
    RETURN QUERY
    SELECT rr.request_id,
           rr.user_id,
           rr.request_type,
           rr.request_status as status,
           rr.created_at,
           rr.updated_at,
           p.full_name,
           p.email,
           rr.approved_by,
           rr.approved_at,
           rr.rejection_reason,
           rr.notes
    FROM public.role_requests rr
    LEFT JOIN public.profiles p ON p.user_id = rr.user_id
    WHERE rr.request_type = 'volunteer' AND rr.request_status = 'rejected'
    ORDER BY rr.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT rr.request_id,
           rr.user_id,
           rr.request_type,
           rr.request_status as status,
           rr.created_at,
           rr.updated_at,
           p.full_name,
           p.email,
           rr.approved_by,
           rr.approved_at,
           rr.rejection_reason,
           rr.notes
    FROM public.role_requests rr
    LEFT JOIN public.profiles p ON p.user_id = rr.user_id
    WHERE rr.request_type = 'volunteer'
      AND rr.request_status = 'rejected'
      AND rr.user_id = caller_id
    ORDER BY rr.created_at DESC;
  END IF;
END;
$$;
