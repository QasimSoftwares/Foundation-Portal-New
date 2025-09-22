-- supabase/migrations/20250921223000_fix_get_user_roles_security.sql

-- This migration fixes a critical bug in the get_user_roles function that caused the admin lockout.
-- The function was incorrectly set to SECURITY DEFINER, which conflicted with the RLS policy on the user_roles table.
-- By changing it to SECURITY INVOKER, it correctly runs as the calling user, allowing RLS to work as intended.

CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
-- This is the key change. It ensures the function respects RLS.
SECURITY INVOKER
AS $function$
  SELECT jsonb_build_object(
    'is_admin', COALESCE(ur.is_admin, false),
    'is_donor', COALESCE(ur.is_donor, false),
    'is_volunteer', COALESCE(ur.is_volunteer, false),
    'is_member', COALESCE(ur.is_member, false),
    'is_viewer', COALESCE(ur.is_viewer, true)
  )
  FROM public.user_roles ur
  WHERE ur.user_id = p_user_id;
$function$;

COMMENT ON FUNCTION public.get_user_roles(uuid) IS 'Returns a JSON object with all role flags for a given user ID. SECURITY INVOKER ensures RLS is respected.';
