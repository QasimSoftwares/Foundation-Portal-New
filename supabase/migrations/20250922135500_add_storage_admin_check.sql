-- This migration adds a dedicated admin-checking function for use in Storage RLS policies.
-- Storage policies have a different execution context where auth.uid() can be unreliable.
-- This function gets the UID from a different, more reliable source for storage operations.

CREATE OR REPLACE FUNCTION public.is_storage_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id_from_storage uuid;
  is_admin_flag boolean;
BEGIN
  -- In storage policies, the user's ID is reliably available via this setting.
  user_id_from_storage := (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;

  IF user_id_from_storage IS NULL THEN
    RETURN false;
  END IF;

  -- Check the user_roles table using the UID we found.
  SELECT is_admin
  INTO is_admin_flag
  FROM public.user_roles
  WHERE user_id = user_id_from_storage;

  RETURN COALESCE(is_admin_flag, false);
EXCEPTION
  WHEN OTHERS THEN
    -- Safely return false in case of any error.
    RAISE WARNING 'Error in is_storage_admin: %', SQLERRM;
    RETURN false;
END;
$$;

-- Grant execute permission.
GRANT EXECUTE ON FUNCTION public.is_storage_admin() TO authenticated;

COMMENT ON FUNCTION public.is_storage_admin() IS 'A special-purpose admin check specifically for use in Storage RLS policies.';

RAISE NOTICE 'Successfully created the is_storage_admin() function.';
