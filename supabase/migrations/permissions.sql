-- File: supabase/migrations/20250906030000_fix_permission_function.sql
-- Description: Fixes parameter name in has_permission function and ensures proper permissions

BEGIN;

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);

-- Recreate the function with the correct parameter name
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id UUID, p_permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON (
            (ur.is_admin AND rp.role_name = 'admin') OR
            (ur.is_donor AND rp.role_name = 'donor') OR
            (ur.is_volunteer AND rp.role_name = 'volunteer') OR
            (ur.is_member AND rp.role_name = 'member') OR
            (ur.is_viewer AND rp.role_name = 'viewer')
        )
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = p_user_id
        AND p.name = p_permission_name
    ) INTO v_has_permission;
    
    RETURN COALESCE(v_has_permission, false);
END;
$$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

COMMIT;