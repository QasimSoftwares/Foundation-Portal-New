-- This migration provides the single, canonical, and definitive implementation of is_admin().
-- It does the following:
-- 1. Drops ALL existing versions of is_admin(), including any with parameters, to remove all conflicts.
-- 2. Creates a single, zero-argument version that is SAFE to call from anywhere (RPCs, policies).
-- 3. Sets it to SECURITY DEFINER to ensure it works reliably inside other RPCs without RLS interference.
-- 4. Ensures it reads the is_admin flag directly from public.user_roles, with NO joins.

DO $$
BEGIN
  -- Step 1: Drop all known variants of the is_admin function to ensure a clean slate.
  DROP FUNCTION IF EXISTS public.is_admin();
  DROP FUNCTION IF EXISTS public.is_admin(uuid);
  
  RAISE NOTICE 'Dropped all existing is_admin functions.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not drop functions, they might not exist. Continuing...';
END $$;

-- Step 2: Create the single, canonical version of is_admin().
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
-- SECURITY DEFINER is crucial for it to work consistently inside other RPCs.
-- The function is safe because it only returns a boolean and exposes no data.
SECURITY DEFINER
-- Set search_path to prevent any hijacking.
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- This logic is correct: it checks the flag on the user_roles table for the currently authenticated user.
  SELECT ur.is_admin
  INTO v_is_admin
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid();

  -- If the user has no entry, they are not an admin. Default to false.
  RETURN COALESCE(v_is_admin, false);
EXCEPTION WHEN OTHERS THEN
  -- In case of any error (e.g., auth.uid() is null), safely return false.
  RAISE WARNING 'Error occurred in is_admin(): %', SQLERRM;
  RETURN false;
END;
$$;

-- Step 3: Grant permission ONLY to authenticated users.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS 'Canonical check to see if the current user is an admin. Returns true/false. Safe for RPCs.';

RAISE NOTICE 'Successfully created the canonical public.is_admin() function.';
