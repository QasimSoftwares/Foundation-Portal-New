-- Drop existing functions if they exist to avoid conflicts
DROP FUNCTION IF EXISTS get_pending_member_requests();
DROP FUNCTION IF EXISTS get_approved_members();
DROP FUNCTION IF EXISTS get_rejected_member_requests();
DROP FUNCTION IF EXISTS count_members();
DROP FUNCTION IF EXISTS count_pending_member_requests();
DROP FUNCTION IF EXISTS count_approved_members();
DROP FUNCTION IF EXISTS count_rejected_member_requests();

-- Get pending member requests
CREATE OR REPLACE FUNCTION get_pending_member_requests()
RETURNS TABLE (
  request_id UUID,
  user_id UUID,
  full_name TEXT,
  email TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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
           p.full_name,
           p.email,
           rr.request_status as status,
           rr.created_at,
           rr.updated_at
    FROM public.role_requests rr
    LEFT JOIN public.profiles p ON p.user_id = rr.user_id
    WHERE rr.request_type = 'member' AND rr.request_status = 'pending'
    ORDER BY rr.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT rr.request_id,
           rr.user_id,
           p.full_name,
           p.email,
           rr.request_status as status,
           rr.created_at,
           rr.updated_at
    FROM public.role_requests rr
    LEFT JOIN public.profiles p ON p.user_id = rr.user_id
    WHERE rr.request_type = 'member'
      AND rr.request_status = 'pending'
      AND rr.user_id = caller_id
    ORDER BY rr.created_at DESC;
  END IF;
END;
$$;

-- Get approved members - should use members table instead of user_roles for consistency with volunteers
CREATE OR REPLACE FUNCTION get_approved_members()
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
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
    SELECT m.user_id,
           p.full_name,
           p.email,
           m.created_at AS approved_at,
           m.created_at
    FROM public.members m
    LEFT JOIN public.profiles p ON p.user_id = m.user_id
    WHERE m.status = 'active'
    ORDER BY m.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT m.user_id,
           p.full_name,
           p.email,
           m.created_at AS approved_at,
           m.created_at
    FROM public.members m
    LEFT JOIN public.profiles p ON p.user_id = m.user_id
    WHERE m.status = 'active' AND m.user_id = caller_id
    ORDER BY m.created_at DESC;
  END IF;
END;
$$;

-- Get rejected member requests
CREATE OR REPLACE FUNCTION get_rejected_member_requests()
RETURNS TABLE (
  request_id UUID,
  user_id UUID,
  full_name TEXT,
  email TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT
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
           p.full_name,
           p.email,
           rr.request_status as status,
           rr.created_at,
           rr.updated_at,
           rr.approved_by,
           rr.approved_at,
           rr.notes
    FROM public.role_requests rr
    LEFT JOIN public.profiles p ON p.user_id = rr.user_id
    WHERE rr.request_type = 'member' AND rr.request_status = 'rejected'
    ORDER BY rr.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT rr.request_id,
           rr.user_id,
           p.full_name,
           p.email,
           rr.request_status as status,
           rr.created_at,
           rr.updated_at,
           rr.approved_by,
           rr.approved_at,
           rr.notes
    FROM public.role_requests rr
    LEFT JOIN public.profiles p ON p.user_id = rr.user_id
    WHERE rr.request_type = 'member'
      AND rr.request_status = 'rejected'
      AND rr.user_id = caller_id
    ORDER BY rr.created_at DESC;
  END IF;
END;
$$;

-- Count functions - updated to use members table for consistency
CREATE OR REPLACE FUNCTION count_members()
RETURNS BIGINT
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT COUNT(*) FROM public.members WHERE status = 'active';
$$;

CREATE OR REPLACE FUNCTION count_pending_member_requests()
RETURNS BIGINT
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT COUNT(*)
  FROM public.role_requests
  WHERE request_type = 'member'
    AND request_status = 'pending';
$$;

CREATE OR REPLACE FUNCTION count_rejected_member_requests()
RETURNS BIGINT
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT COUNT(*)
  FROM public.role_requests
  WHERE request_type = 'member'
    AND request_status = 'rejected';
$$;

CREATE OR REPLACE FUNCTION count_approved_members()
RETURNS BIGINT
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT COUNT(*) FROM public.members WHERE status = 'active';
$$;
GRANT EXECUTE ON FUNCTION get_pending_member_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION get_approved_members() TO authenticated;
GRANT EXECUTE ON FUNCTION get_rejected_member_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION count_members() TO authenticated;
GRANT EXECUTE ON FUNCTION count_pending_member_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION count_approved_members() TO authenticated;
GRANT EXECUTE ON FUNCTION count_rejected_member_requests() TO authenticated;
