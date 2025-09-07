-- Create RPC function to check admin role
CREATE OR REPLACE FUNCTION public.check_user_admin(p_user_id UUID)
RETURNS TABLE (is_admin BOOLEAN) AS $$
BEGIN
  RETURN QUERY 
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = p_user_id 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function to check user permission
CREATE OR REPLACE FUNCTION public.check_user_permission(
  p_user_id UUID,
  p_permission TEXT
) RETURNS TABLE (has_permission BOOLEAN) AS $$
BEGIN
  RETURN QUERY 
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_permissions 
    WHERE user_id = p_user_id 
    AND permission = p_permission
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_user_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_permission(UUID, TEXT) TO authenticated;
