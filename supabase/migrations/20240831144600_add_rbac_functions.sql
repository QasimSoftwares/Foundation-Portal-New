-- Migration: Add RBAC functions and triggers

-- Function to get user roles as JSONB
CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
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

-- Function to get current user's roles
CREATE OR REPLACE FUNCTION public.my_roles()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT get_user_roles(auth.uid());
$function$;

-- Function to sync user_roles with profiles
CREATE OR REPLACE FUNCTION public.sync_user_roles_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Update email and full_name in user_roles when profiles are updated
  UPDATE public.user_roles ur
  SET 
    email = NEW.email,
    full_name = NEW.full_name,
    updated_at = NOW()
  WHERE ur.user_id = NEW.user_id;
  
  RETURN NEW;
END;
$function$;

-- Function to update user_roles updated_at
CREATE OR REPLACE FUNCTION public.update_user_roles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Create trigger to sync user_roles when profiles are updated
DROP TRIGGER IF EXISTS sync_user_roles_trigger ON public.profiles;
CREATE TRIGGER sync_user_roles_trigger
AFTER UPDATE OF email, full_name ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_roles_profile();

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_roles() TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_user_roles(uuid) IS 'Returns a JSON object with all role flags for a given user ID';
COMMENT ON FUNCTION public.my_roles() IS 'Returns the current user''s roles as a JSON object';
COMMENT ON FUNCTION public.sync_user_roles_profile() IS 'Synchronizes email and name changes from profiles to user_roles table';
COMMENT ON FUNCTION public.update_user_roles_updated_at() IS 'Updates the updated_at timestamp on user_roles table';
