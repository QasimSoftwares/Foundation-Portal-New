-- Create RPC function to check admin status
CREATE OR REPLACE FUNCTION public.is_user_admin(p_user_id UUID)
RETURNS TABLE (is_admin BOOLEAN) AS $$
BEGIN
  RETURN QUERY 
  SELECT ur.is_admin 
  FROM public.user_roles ur
  WHERE ur.user_id = p_user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_user_admin(UUID) TO authenticated;
